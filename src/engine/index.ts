/** The engine: layout -> Scene -> paint, then finish. All drawing lives under src/engine/. */
import { FORMATS } from './formats';
import { finish } from './finish';
import type { Ctx } from './graphics/types';
import { layout, type Use } from './layout';
import { canvasMeasure, type Measure } from './measure';
import { paint } from './paint';
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
  const ctx = canvas.getContext('2d') as Ctx;
  const sc = scene(spec, browserMeasure(), use);
  paint(ctx, sc, t);
  finish(ctx, spec);
  return sc;
}

export { paint } from './paint';
export { layout, solve, choosePairing, resolvePairing, type Use } from './layout';
export { check } from './invariants';
export { FORMATS } from './formats';
