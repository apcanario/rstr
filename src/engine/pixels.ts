/** Pixel reads for the tools: a hash of a render, and the knock-out proof. Kept in the engine (CLAUDE.md). */
import { FORMATS } from './formats';
import type { Ctx } from './graphics/types';
import { paint, paintText } from './paint';
import { scene as sceneOf } from './index';
import type { Scene, TextItem } from './scene';
import type { Spec } from './spec';

function canvas(w: number, h: number): Ctx {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx;
}

/** FNV-1a over the RGBA pixels of a canvas. */
export function pixelHash(c: HTMLCanvasElement | OffscreenCanvas): string {
  const d = (c.getContext('2d') as Ctx).getImageData(0, 0, c.width, c.height).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16) + ':' + d.length;
}

export const MARKER = '#13F7A9';

/**
 * Knock-out proof (spec 9.2 rule 3 for graphics that keep off text): paint the design without its text and
 * with every graphic that has an `avoid` list in the marker colour, then count marker pixels that fall inside
 * any text item's painted mask (fill, outline and echoes). Run once with the offscreen layer and once without.
 */
export function knockLeak(spec: Spec, noLayer = false): { leaks: number; masked: number; graphics: number } {
  const [W, H] = FORMATS[spec.format];
  const sc: Scene = structuredClone(sceneOf(spec));
  let graphics = 0;
  for (const it of sc.items) {
    if (it.kind !== 'graphic' || !it.avoid?.length) continue;
    graphics++;
    for (const k of Object.keys(it.colours)) it.colours[k] = MARKER;
  }
  const main = canvas(W, H);
  paint(main, sc, null, { noText: true, noLayer });
  const mask = canvas(W, H);
  for (const it of sc.items) {
    if (it.kind !== 'text') continue;
    const t: TextItem = { ...it, fill: '#000000', stroke: it.stroke && { ...it.stroke, paint: '#000000' }, echoes: it.echoes?.map((e) => ({ ...e, paint: '#000000' })) };
    paintText(mask, t);
  }
  const a = main.getImageData(0, 0, W, H).data, b = mask.getImageData(0, 0, W, H).data;
  const mr = parseInt(MARKER.slice(1, 3), 16), mg = parseInt(MARKER.slice(3, 5), 16), mb = parseInt(MARKER.slice(5, 7), 16);
  let leaks = 0, masked = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (b[i + 3] < 128) continue;
    masked++;
    if (Math.abs(a[i] - mr) < 40 && Math.abs(a[i + 1] - mg) < 40 && Math.abs(a[i + 2] - mb) < 40) leaks++;
  }
  return { leaks, masked, graphics };
}
