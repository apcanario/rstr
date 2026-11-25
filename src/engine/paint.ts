/** paint(ctx, scene, t): draws a Scene. No decisions, no randomness beyond the seeds the Scene carries. */
import { MASK } from '../data/palettes/system';
import { GRAPHICS } from './graphics';
import { drawMark } from './markdraw';
import { photoOf } from './photo';
import { clock, type Time } from './graphics/clock';
import type { Ctx } from './graphics/types';
import type { Quad } from './geom';
import { rng, skip } from './rng';
import { fontCss, type GraphicItem, type Item, type Paint, type RectItem, type Scene, type TextItem } from './scene';

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

/** spread: grunge's ink spread (spec 7.1), an outline of the fill's own colour this many px wide at part strength. */
export function paintText(ctx: Ctx, it: TextItem, spread = 0) {
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
  // draw on a layer, cut the text holes out, then lay it down
  const L = noLayer ? null : layer(scene.w, scene.h);
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
  ctx.drawImage(L.canvas as CanvasImageSource, 0, 0);
}

/** The photo in its cover rect; a photo not registered (still loading, or gone) draws as a plain plate of the ground. */
function drawPhoto(c: Ctx, g: GraphicItem) {
  const p = photoOf(String(g.params.id)), P = g.params as Record<string, number>;
  if (!p?.img) { c.fillStyle = g.colours.missing; c.fillRect(g.box.x, g.box.y, g.box.w, g.box.h); return; }
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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
