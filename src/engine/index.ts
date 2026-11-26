/** The engine: layout -> Scene -> paint, then finish. All drawing lives under src/engine/. */
import { FORMATS } from './formats';
import { paintFinished } from './finish';
import type { Ctx } from './graphics/types';
import { layout, type Use } from './layout';
import { canvasMeasure, type Measure } from './measure';
import type { Scene } from './scene';
import type { Spec } from './spec';

let shared: Measure | null = null;
/** A Measure on a small canvas of its own, cached across calls. */
export function browserMeasure(): Measure {
  if (shared) return shared;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : Object.assign(document.createElement('canvas'), { width: 8, height: 8 });
  shared = canvasMeasure(c.getContext('2d') as Ctx);
  return shared;
}

export function scene(spec: Spec, m: Measure = browserMeasure(), use: Use = {}): Scene {
  return layout(spec, m, use);
}

/** Draw a spec at full size on the given canvas (the canvas is resized to the format). */
export function render(canvas: HTMLCanvasElement | OffscreenCanvas, spec: Spec, t: null = null, use: Use = {}): Scene {
  const [W, H] = FORMATS[spec.format];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  // the same context as an export's (review R16 M3): the stage and the 1x file draw the same pixels
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx;
  const sc = scene(spec, browserMeasure(), use);
  // paint and finish (spec 4 stages 2 and 3): the finish needs the Scene for its two passes and its guard. An HTML
  // canvas (the stage) is drawn on an offscreen one, as every export is, and its pixels copied over: Chrome
  // rasterises some edges of the same drawing differently on the two kinds (review R16 M3: 5 of 16 designs differed)
  if (typeof OffscreenCanvas !== 'undefined' && !(canvas instanceof OffscreenCanvas)) {
    work ??= new OffscreenCanvas(W, H);
    // setting the size clears the canvas and its state, as a new one
    work.width = W; work.height = H;
    const w = work.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx;
    paintFinished(w, sc, spec, t);
    ctx.putImageData(w.getImageData(0, 0, W, H), 0, 0);
  } else paintFinished(ctx, sc, spec, t);
  return sc;
}
let work: OffscreenCanvas | null = null;

let full: HTMLCanvasElement | OffscreenCanvas | null = null;
/**
 * A small copy of a design (style tiles, Kept): drawn at full size offscreen, then scaled down onto the canvas,
 * `w` device pixels wide. The poster itself is never drawn from this (spec 4: export draws at full size).
 */
export function thumb(canvas: HTMLCanvasElement, spec: Spec, w: number, use: Use = {}): void {
  full ??= typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : document.createElement('canvas');
  render(full, spec, null, use);
  const [W, H] = FORMATS[spec.format];
  const tw = Math.max(1, Math.round(w)), th = Math.max(1, Math.round((w * H) / W));
  if (canvas.width !== tw) canvas.width = tw;
  if (canvas.height !== th) canvas.height = th;
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full as CanvasImageSource, 0, 0, tw, th);
}

export { paint } from './paint';
export { paintFinished } from './finish';
export { layout, solve, choosePairing, resolvePairing, type Use } from './layout';
export { check } from './invariants';
export { FORMATS } from './formats';
