/**
 * Where a canvas sits in an export (spec 10.1, row R16). A Scene is laid out in 1080-wide units; an export draws it at
 * 1x, 2x, 3x or Print by a transform, so every size is drawn at that size from the spec and every pixel pass (the
 * finishes, the copier pass, a treatment) runs on the export's own pixels. A canvas may hold the whole export or one
 * horizontal strip of it (big renders): `top` is the export row at the canvas's row 0.
 *
 * export px = scene px * (sx, sy) + (ox, oy); canvas px = export px - (0, top). W and H are the whole export's pixels.
 * A canvas with no view is a 1x canvas of its own size (everything before R16 draws that way).
 *
 * Bands: Chrome's rasteriser (Skia) cuts a path at the edge of the area it may draw in and works out the cut edge's
 * slope again from there, so an edge that crosses that line lands up to a pixel apart depending on where the line
 * is (seen at 3x: up to 31 levels on a hairline, 255 on a long bar edge). A strip canvas has its edges in other
 * places than the whole canvas. So at export sizes every vector drawing is done band by band, `band` export rows at
 * a time, each clipped to its band: on the whole canvas and in a strip (whose edges sit on band lines) the same path
 * is cut at the same lines, and a strip draws exactly the pixels of the same rows of the whole. Pixel passes run on
 * whole rows and need no bands.
 */
import type { Ctx } from './graphics/types';

export interface View { sx: number; sy: number; ox: number; oy: number; W: number; H: number; top: number; band?: number; }

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
const views = new WeakMap<object, View>();

export function setView(c: AnyCanvas, v: View | null): void {
  if (v) views.set(c, v); else views.delete(c);
}
export function viewOf(ctx: Ctx | AnyCanvas): View {
  const c = ('canvas' in ctx ? ctx.canvas : ctx) as AnyCanvas;
  return views.get(c) ?? { sx: 1, sy: 1, ox: 0, oy: 0, W: c.width, H: c.height, top: 0 };
}
/** Put the canvas's base transform on ctx: scene px to canvas px. */
export function base(ctx: Ctx): void {
  const v = viewOf(ctx);
  ctx.setTransform(v.sx, 0, 0, v.sy, v.ox, v.oy - v.top);
}
/** Device px per scene px (the width's): for what a transform does not scale (shadowBlur) and for sizes kept in px. */
export const scaleOf = (ctx: Ctx): number => viewOf(ctx).sx;
/** ctx's transform with its base taken out: where a drawing is in scene px, whatever the export size. */
export function localTransform(ctx: Ctx): DOMMatrix | null {
  if (typeof ctx.getTransform !== 'function') return null;
  const m = ctx.getTransform(), v = viewOf(ctx);
  if (v.sx === 1 && v.sy === 1 && v.ox === 0 && v.oy === 0 && v.top === 0) return m;
  const b = new DOMMatrix([v.sx, 0, 0, v.sy, v.ox, v.oy - v.top]);
  return b.inverse().multiply(m);
}

/** A canvas like ctx's: the same pixel size and the same view, with its base transform on. */
export function surfaceLike(ctx: Ctx, read = true): Ctx {
  const src = ctx.canvas as AnyCanvas, w = src.width, h = src.height;
  const c: AnyCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const v = views.get(src);
  if (v) views.set(c, v);
  const out = c.getContext('2d', read ? ({ willReadFrequently: true } as CanvasRenderingContext2DSettings) : undefined) as Ctx;
  base(out);
  return out;
}

/** The view of an export of W x H px of a Scene of sw x sh (the trim), strip at `top` (0: the whole). */
export const exportView = (sw: number, sh: number, W: number, H: number, top = 0, band?: number): View => ({ sx: W / sw, sy: H / sh, ox: 0, oy: 0, W, H, top, band });

let inBand = false;
const scratch = new Map<string, Ctx>();
function scratchOf(w: number, h: number): Ctx {
  const k = `${w}x${h}`;
  let x = scratch.get(k);
  if (!x) {
    const c: AnyCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    x = c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx;
    if (scratch.size >= 3) scratch.clear();
    scratch.set(k, x);
  }
  return x;
}
/**
 * Run a vector drawing on ctx band by band where its view has bands (see above); otherwise once on ctx. Each band is
 * drawn on a canvas of the band's own size: the band's pixels are copied onto it, drawn on, and copied back, so the
 * rasteriser meets the same canvas, cut at the same lines, whether ctx is the whole export or a strip of it.
 * Drawings nested in a banded one run once, on the band.
 */
export function banded(ctx: Ctx, draw: (c: Ctx) => void, span?: [number, number]): void {
  const v = viewOf(ctx);
  if (!v.band || inBand) { draw(ctx); return; }
  const ch = ctx.canvas.height, cw = ctx.canvas.width, m = ctx.getTransform(), alpha = ctx.globalAlpha;
  // `span`: the scene rows the drawing can touch (a text item's, with room to spare); bands outside it are skipped
  const lo = span ? Math.max(v.top, Math.floor(span[0] * v.sy + v.oy)) : v.top, hi = span ? Math.min(v.top + ch, Math.ceil(span[1] * v.sy + v.oy)) : v.top + ch;
  if (hi <= lo) return;
  inBand = true;
  try {
    for (let y = Math.floor(lo / v.band) * v.band; y < hi; y += v.band) {
      const bh = Math.min(v.band, v.H - y), a = y - v.top;
      if (a < 0 || a + bh > ch) throw new Error('a strip must sit on band lines');
      const S = scratchOf(cw, bh);
      setView(S.canvas as AnyCanvas, { ...v, top: y });
      // byte copies both ways (getImageData, putImageData): no compositing, no resampling
      S.putImageData(ctx.getImageData(0, a, cw, bh), 0, 0);
      // a reused canvas keeps its current path through save and restore: start each band with none
      S.beginPath();
      S.save();
      S.setTransform(m.a, m.b, m.c, m.d, m.e, m.f - a);
      S.globalAlpha = alpha;
      draw(S);
      S.restore();
      ctx.putImageData(S.getImageData(0, 0, cw, bh), 0, a);
    }
  } finally { inBand = false; }
}
