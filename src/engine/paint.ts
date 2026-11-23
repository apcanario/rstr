/** paint(ctx, scene, t): draws a Scene. No decisions, no randomness beyond the seeds the Scene carries. */
import { GRAPHICS } from './graphics';
import { clock, type Time } from './graphics/clock';
import type { Ctx } from './graphics/types';
import type { Quad } from './geom';
import { rng, skip } from './rng';
import { fontCss, type GraphicItem, type Paint, type RectItem, type Scene, type TextItem } from './scene';

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

export function paintText(ctx: Ctx, it: TextItem) {
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
    for (const e of it.echoes ?? []) { ctx.fillStyle = style(ctx, e.paint, it.size); ctx.fillText(r.s, e.dx / sx, e.dy / sy); }
    if (it.stroke) {
      // an outline drawn under the fill at twice the width: only its outer half shows, so overlapping
      // contours inside a glyph never show as lines
      ctx.lineWidth = (2 * it.stroke.width) / Math.min(sx, sy);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = style(ctx, it.stroke.paint, it.size);
      ctx.strokeText(r.s, 0, 0);
    }
    ctx.fillStyle = style(ctx, it.fill, it.size);
    ctx.fillText(r.s, 0, 0);
    ctx.restore();
  }
  (ctx as any).letterSpacing = '0px';
  ctx.restore();
}

function knockText(ctx: Ctx, it: TextItem, pad: number) {
  ctx.save();
  place(ctx, it.xf);
  ctx.font = fontCss(it.font, it.size);
  (ctx as any).letterSpacing = it.tracking + 'px';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
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
  const draw = GRAPHICS[it.name];
  if (!draw) return;
  const T = clock(t);
  const run = (c: Ctx) => {
    c.save();
    c.beginPath(); c.rect(it.box.x, it.box.y, it.box.w, it.box.h); c.clip();
    place(c, it.xf);
    draw(c, it, skip(rng(it.seed), it.skip), T);
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
    L.fillStyle = '#000';
    for (const q of it.knock.boxes) { L.beginPath(); quadPath(L, q); L.fill(); }
  } else {
    L.fillStyle = '#000';
    for (const q of it.avoid) { L.beginPath(); quadPath(L, q); L.fill(); }
  }
  L.restore();
  ctx.drawImage(L.canvas as CanvasImageSource, 0, 0);
}

export interface PaintOpts {
  /** Paint no text items (the knock proof reads what lies under the text). */
  noText?: boolean;
  /** Take the no-layer path for knock-outs, as on a platform without offscreen canvases. */
  noLayer?: boolean;
}

export function paint(ctx: Ctx, scene: Scene, t: Time | null = null, o: PaintOpts = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = scene.ground;
  ctx.fillRect(0, 0, scene.w, scene.h);
  for (const it of scene.items) {
    if (it.kind === 'rect') paintRect(ctx, it);
    else if (it.kind === 'text') { if (!o.noText) paintText(ctx, it); }
    else paintGraphic(ctx, it, scene, t, o.noLayer);
  }
}
