/** paint(ctx, scene, t): draws a Scene. No decisions, no randomness beyond the seeds the Scene carries. */
import { MASK } from '../data/palettes/system';
import { GRAPHICS } from './graphics';
import { drawMark } from './markdraw';
import { photoOf } from './photo';
import { isTreatment, treatColours, treatPixels, treatReach } from './treat';
import { clock, type Time } from './graphics/clock';
import type { Ctx } from './graphics/types';
import type { Quad } from './geom';
import { rng, skip } from './rng';
import { fontCss, type GraphicItem, type Item, type Paint, type RectItem, type Scene, type TextItem } from './scene';
import { banded, base, surfaceLike, viewOf } from './view';

function style(ctx: Ctx, p: Paint, size = 1): string | CanvasGradient {
  if (typeof p === 'string') return p;
  const k = p.em ? size : 1;
  const g = ctx.createLinearGradient(p.x0 * k, p.y0 * k, p.x1 * k, p.y1 * k);
  for (const [t, c] of p.stops) g.addColorStop(t, c);
  return g;
}
function place(ctx: Ctx, xf?: { x: number; y: number; rot: number }) {
  if (!xf) return;
  ctx.translate(xf.x, xf.y);
  ctx.rotate(xf.rot);
}

function paintRect(ctx: Ctx, it: RectItem) {
  ctx.save();
  place(ctx, it.xf);
  const r = it.r;
  if (it.shadow) { ctx.fillStyle = it.shadow.fill; ctx.fillRect(r.x + it.shadow.dx, r.y + it.shadow.dy, r.w, r.h); }
  ctx.fillStyle = style(ctx, it.fill);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (it.stroke) { ctx.strokeStyle = it.stroke.colour; ctx.lineWidth = it.stroke.width; ctx.strokeRect(r.x, r.y, r.w, r.h); }
  ctx.restore();
}

/**
 * The scene rows a text item's drawing can reach, with room to spare: its box, a whole size more each way (glyphs
 * past the box, a turned item's corners), its outline, echoes and any pad. Only bands of a big render that meet
 * these rows are drawn for it (R16); skipping the rest changes nothing, as nothing of it lies there.
 */
export function textSpan(it: TextItem, pad: number): [number, number] {
  const ys = it.quad.map((p) => p[1]);
  const e = Math.max(0, ...(it.echoes ?? []).map((x) => Math.abs(x.dy))), r = it.size + pad + 2 * (it.stroke?.width ?? 0) + e + 8;
  return [Math.min(...ys) - r, Math.max(...ys) + r];
}

/** spread: grunge's ink spread (spec 7.1), an outline of the fill's own colour this many px wide at part strength. */
export function paintText(ctx: Ctx, it: TextItem, spread = 0) {
  banded(ctx, (c) => paintText1(c, it, spread), textSpan(it, spread));
}
function paintText1(ctx: Ctx, it: TextItem, spread: number) {
  ctx.save();
  place(ctx, it.xf);
  if (it.clip) { ctx.beginPath(); ctx.rect(it.clip.x, it.clip.y, it.clip.w, it.clip.h); ctx.clip(); }
  ctx.font = fontCss(it.font, it.size);
  (ctx as any).letterSpacing = it.tracking + 'px';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (const r of it.runs) {
    if (!r.s) continue;
    const sx = r.sx ?? 1, sy = r.sy ?? 1;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.scale(sx, sy);
    for (const e of it.echoes ?? []) {
      if (e.halo && it.stroke) {
        ctx.lineWidth = (2 * it.stroke.width) / Math.min(sx, sy);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = style(ctx, e.halo, it.size);
        ctx.strokeText(r.s, e.dx / sx, e.dy / sy);
      }
      ctx.fillStyle = style(ctx, e.paint, it.size);
      ctx.fillText(r.s, e.dx / sx, e.dy / sy);
    }
    if (it.stroke) {
      // an outline drawn under the fill at twice the width: only its outer half shows, so overlapping
      // contours inside a glyph never show as lines
      ctx.lineWidth = (2 * it.stroke.width) / Math.min(sx, sy);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = style(ctx, it.stroke.paint, it.size);
      ctx.strokeText(r.s, 0, 0);
    }
    if (spread > 0) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * 0.45;
      ctx.lineWidth = (2 * spread) / Math.min(sx, sy);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = style(ctx, it.fill, it.size);
      ctx.strokeText(r.s, 0, 0);
      ctx.globalAlpha = a;
    }
    ctx.fillStyle = style(ctx, it.fill, it.size);
    ctx.fillText(r.s, 0, 0);
    ctx.restore();
  }
  (ctx as any).letterSpacing = '0px';
  ctx.restore();
}

/** A text item's glyphs (and echoes) in the mask colour, grown by pad px all round: what a knock-out or a finish's ring reads. */
export function knockText(ctx: Ctx, it: TextItem, pad: number) {
  banded(ctx, (c) => knockText1(c, it, pad), textSpan(it, pad));
}
function knockText1(ctx: Ctx, it: TextItem, pad: number) {
  ctx.save();
  place(ctx, it.xf);
  ctx.font = fontCss(it.font, it.size);
  (ctx as any).letterSpacing = it.tracking + 'px';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MASK;
  ctx.strokeStyle = MASK;
  ctx.lineJoin = 'round';
  const offs = [{ dx: 0, dy: 0 }, ...(it.echoes ?? [])];
  for (const r of it.runs) {
    if (!r.s) continue;
    const sx = r.sx ?? 1, sy = r.sy ?? 1;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.scale(sx, sy);
    ctx.lineWidth = (2 * pad + 2 * (it.stroke?.width ?? 0)) / Math.min(sx, sy);
    for (const o of offs) { ctx.fillText(r.s, o.dx / sx, o.dy / sy); ctx.strokeText(r.s, o.dx / sx, o.dy / sy); }
    ctx.restore();
  }
  (ctx as any).letterSpacing = '0px';
  ctx.restore();
}

function quadPath(ctx: Ctx, q: Quad) {
  ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.closePath();
}

function layer(w: number, h: number): Ctx | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h).getContext('2d');
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.getContext('2d'); }
  return null;
}

function paintGraphic(ctx: Ctx, it: GraphicItem, scene: Scene, t: Time | null, noLayer = false) {
  // a mark (spec 7.2) is drawn by the marks layer, not the graphics library
  // the photo (spec 8.9) is drawn from the picture the app registered, covering its box
  const G = it.name === 'mark' ? { draw: (c: Ctx, g: GraphicItem, r: ReturnType<typeof rng>) => drawMark(c, g, r) } : it.name === 'photo' ? { draw: drawPhoto } : GRAPHICS[it.name];
  if (!G) return;
  const T = clock(t);
  const run = (c: Ctx) => {
    c.save();
    place(c, it.frame);
    const b = it.box;
    c.beginPath();
    if (it.cut === 'disc') c.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 2, 0, Math.PI * 2);
    else c.rect(b.x, b.y, b.w, b.h);
    c.clip();
    if (it.plate) { c.fillStyle = it.plate; c.fillRect(b.x, b.y, b.w, b.h); }
    place(c, it.xf);
    G.draw(c, it, skip(rng(it.seed), it.skip), T);
    c.restore();
  };
  if (!it.avoid?.length) { run(ctx); return; }
  // draw on a layer, cut the text holes out, then lay it down (the layer is the canvas's size and view: R16)
  const L = noLayer ? null : (() => { try { return surfaceLike(ctx); } catch { return null; } })();
  if (!L) {
    // no layer to cut from: clip the whole canvas minus every avoided box (even-odd), so nothing lies behind the text
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, scene.w, scene.h);
    for (const q of it.avoid) quadPath(ctx, q);
    ctx.clip('evenodd');
    run(ctx);
    ctx.restore();
    return;
  }
  run(L);
  L.save();
  L.globalCompositeOperation = 'destination-out';
  if (it.knock) {
    // cut each glyph out with a halo of knock.pad px: the graphic shows between letters, never on them
    for (const i of it.knock.glyphs) {
      const t = scene.items[i];
      if (t && t.kind === 'text') knockText(L, t, it.knock.pad);
    }
    L.fillStyle = MASK;
    for (const q of it.knock.boxes) { L.beginPath(); quadPath(L, q); L.fill(); }
  } else {
    L.fillStyle = MASK;
    for (const q of it.avoid) { L.beginPath(); quadPath(L, q); L.fill(); }
  }
  L.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(L.canvas as CanvasImageSource, 0, 0);
  ctx.restore();
}

/**
 * Treated pictures kept for the next paint of the same design (a finish paints a Scene more than once): the stage and
 * the Style tab's four tiles make five per Shuffle, so six (review R15 M2).
 */
export const TREATED_KEEP = 6;
const treated = new Map<string, CanvasImageSource>();
/** Forget every kept treated picture (review R15 S2, M3: the determinism check and the timing treat afresh). */
export const clearTreated = (): void => treated.clear();
/** How many treated pictures are kept (tests). */
export const treatedKept = (): number => treated.size;

/**
 * The photo's box as its treatment draws it (spec 8.9, R15): the picture drawn into a canvas of the box's size in
 * device pixels (`s` per scene px), the treatment applied to those pixels, so a halftone screen or a dither pixel has
 * the same size on the poster at any scale. `fresh`: skip the kept copies (the timing). Null where there is no
 * picture or no canvas.
 */
export function treatedBox(g: GraphicItem, s: number, fresh = false): CanvasImageSource | null {
  const p = photoOf(String(g.params.id)), P = g.params as Record<string, number>, b = g.box;
  if (!p?.img) return null;
  const w = Math.max(1, Math.ceil(b.w * s)), h = Math.max(1, Math.ceil(b.h * s));
  const key = JSON.stringify([g.params, treatColours(g), s, b]);
  const kept = fresh ? undefined : treated.get(key);
  if (kept) { treated.delete(key); treated.set(key, kept); return kept; }
  const L = layer(w, h);
  if (!L) return null;
  L.imageSmoothingEnabled = true;
  L.imageSmoothingQuality = 'high';
  L.drawImage(p.img, (P.x - b.x) * s, (P.y - b.y) * s, P.w * s, P.h * s);
  const im = L.getImageData(0, 0, w, h);
  treatPixels(im.data, w, h, g.params, treatColours(g), s);
  L.putImageData(im, 0, 0);
  const out = L.canvas as CanvasImageSource;
  if (!fresh) {
    treated.set(key, out);
    while (treated.size > TREATED_KEEP) treated.delete(treated.keys().next().value as string);
  }
  return out;
}

/**
 * The photo's box in its treatment, straight on the canvas's pixel grid (R16): where the photo is not turned, the
 * treatment runs on the canvas pixels the box covers, from its origin's pixel, at the canvas's scale, so a 2x or 3x
 * export treats the photo at that size and a strip of a big render treats only its own rows (plus the rows a
 * halftone cell reads), exactly as the same rows of the whole. Null where the photo is turned (then treatedBox) or
 * nothing of the box is on the canvas.
 */
function treatedOnGrid(c: Ctx, g: GraphicItem, p: { img?: CanvasImageSource }): { img: CanvasImageSource; x: number; y: number; sy: number; h: number; w: number } | null | 'turned' {
  const m = c.getTransform();
  if (Math.abs(m.b) > 1e-9 || Math.abs(m.c) > 1e-9 || m.a <= 0 || m.d <= 0) return 'turned';
  const v = viewOf(c), cw = c.canvas.width, ch = c.canvas.height, b = g.box, P = g.params as Record<string, number>;
  const bx0 = b.x * m.a + m.e, by0 = b.y * m.d + m.f, bx1 = (b.x + b.w) * m.a + m.e, by1 = (b.y + b.h) * m.d + m.f;
  const X0 = Math.floor(bx0), Y0 = Math.floor(by0);
  // what shows: the box on this canvas; what the export holds of the box (rows in canvas px)
  const ex0 = 0, ex1 = cw, ey0 = -v.top, ey1 = v.H - v.top;
  const sx0 = Math.max(X0, ex0), sx1 = Math.min(Math.ceil(bx1), ex1), ry0 = Math.max(Y0, 0), ry1 = Math.min(Math.ceil(by1), ch);
  if (sx1 <= sx0 || ry1 <= ry0) return null;
  const s = m.a, { margin, align } = treatReach(g.params, s);
  let wy0 = Math.max(Y0, ey0, ry0 - margin);
  wy0 = Y0 + Math.floor((wy0 - Y0) / align) * align;
  const wy1 = Math.min(Math.ceil(by1), ey1, ry1 + margin), w = sx1 - sx0, h = wy1 - wy0;
  const key = JSON.stringify([g.params, treatColours(g), s, m.d, b, sx0, wy0 + v.top, w, h, X0, Y0 + v.top]);
  let T = treated.get(key);
  if (T) { treated.delete(key); treated.set(key, T); }
  else {
    const L = layer(w, h);
    if (!L) return null;
    L.imageSmoothingEnabled = true;
    L.imageSmoothingQuality = 'high';
    L.setTransform(m.a, 0, 0, m.d, m.e - sx0, m.f - wy0);
    L.drawImage(p.img!, P.x, P.y, P.w, P.h);
    L.setTransform(1, 0, 0, 1, 0, 0);
    const im = L.getImageData(0, 0, w, h);
    treatPixels(im.data, w, h, g.params, treatColours(g), s, { ox: sx0 - X0, oy: wy0 - Y0, x0: sx0 - X0, x1: sx1 - X0, y0: Math.max(Y0, ey0) - Y0, y1: Math.min(Math.ceil(by1), ey1) - Y0 });
    L.putImageData(im, 0, 0);
    T = L.canvas as CanvasImageSource;
    treated.set(key, T);
    while (treated.size > TREATED_KEEP) treated.delete(treated.keys().next().value as string);
  }
  return { img: T, x: sx0, y: ry0, sy: ry0 - wy0, h: ry1 - ry0, w };
}

/** The photo in its cover rect, in its treatment; a photo not registered (still loading, or gone) draws as a plain plate of the ground. */
function drawPhoto(c: Ctx, g: GraphicItem) {
  const p = photoOf(String(g.params.id)), P = g.params as Record<string, number>;
  if (!p?.img) { c.fillStyle = g.colours.missing; c.fillRect(g.box.x, g.box.y, g.box.w, g.box.h); return; }
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (isTreatment(g.params.treat) && g.params.treat !== 'colour') {
    const on = treatedOnGrid(c, g, p);
    if (on === null) return;
    if (on !== 'turned') {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(on.img, 0, on.sy, on.w, on.h, on.x, on.y, on.w, on.h);
      c.restore();
      return;
    }
    const m = c.getTransform(), s = Math.hypot(m.a, m.b) || 1;
    const T = treatedBox(g, s);
    if (T) { c.drawImage(T, g.box.x, g.box.y, g.box.w, g.box.h); return; }
  }
  c.drawImage(p.img, P.x, P.y, P.w, P.h);
}

export interface PaintOpts {
  /** Paint no text items (the knock proof reads what lies under the text). */
  noText?: boolean;
  /** Paint only the items this keeps (the two passes of a finish, spec 7.1); indices stay those of the Scene. */
  only?: (it: Item) => boolean;
  /** Do not fill the ground first (a second pass over what is already painted). */
  noGround?: boolean;
  /** Grunge's ink spread on type, px (spec 7.1). */
  spread?: number;
  /** Take the no-layer path for knock-outs, as on a platform without offscreen canvases. */
  noLayer?: boolean;
}

export function paint(ctx: Ctx, scene: Scene, t: Time | null = null, o: PaintOpts = {}) {
  // the canvas's base transform: scene px to the export's px (R16; identity on a 1x canvas); in bands at export sizes
  base(ctx);
  banded(ctx, (c) => paint1(c, scene, t, o));
  base(ctx);
}
function paint1(ctx: Ctx, scene: Scene, t: Time | null, o: PaintOpts) {
  base(ctx);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (!o.noGround) {
    ctx.fillStyle = scene.ground;
    ctx.fillRect(0, 0, scene.w, scene.h);
  }
  for (const it of scene.items) {
    if (o.only && !o.only(it)) continue;
    if (it.kind === 'rect') paintRect(ctx, it);
    else if (it.kind === 'text') { if (!o.noText) paintText(ctx, it, o.spread ?? 0); }
    else paintGraphic(ctx, it, scene, t, o.noLayer);
  }
}
