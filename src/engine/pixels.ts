/** Pixel reads for the tools: a hash of a render, and the knock-out proof. Kept in the engine (CLAUDE.md). */
import { MARKER, MASK } from '../data/palettes/system';
import { FORMATS } from './formats';
import { bounds, contains, overlaps } from './geom';
import type { Ctx } from './graphics/types';
import { behind } from './invariants';
import { paint, paintText } from './paint';
import { browserMeasure, scene as sceneOf } from './index';
import type { Use } from './layout';
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

export { MARKER };

/**
 * Knock-out proof (spec 9.2 rule 3 for graphics that keep off text): paint the design without its text and
 * with every graphic that has an `avoid` list in the marker colour, then count marker pixels that fall inside
 * any text item's painted mask (fill, outline and echoes). Run once with the offscreen layer and once without.
 */
export function knockLeak(spec: Spec, noLayer = false, use: Use = {}): { leaks: number; masked: number; graphics: number } {
  const [W, H] = FORMATS[spec.format];
  const sc: Scene = structuredClone(sceneOf(spec, browserMeasure(), use));
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
    const t: TextItem = { ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: it.echoes?.map((e) => ({ ...e, paint: MASK })) };
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

const rgbOf = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** Distance (per channel, max) from pixel p to the segment between colours a and b: antialiasing and gradients blend along it. */
function segDist(p: number[], a: number[], b: number[]): number {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / L)) : 0;
  return Math.max(...[0, 1, 2].map((k) => Math.abs(p[k] - (a[k] + d[k] * t))));
}

/**
 * The pixel-level 9.2 for graphics (review R13 S2): what a graphic's parameters can actually break, since the
 * Scene's boxes and fills are set at placement. Paint the design without text, once with its graphics and
 * once without, and look only inside every text item's painted mask (fill, outline, echoes):
 * - where the Scene puts no graphic behind the item, the two renders must be identical (`leaks`);
 * - where it does, every pixel must be a colour the Scene declared behind it, or a blend of two (`stray`).
 */
export function graphicLeak(spec: Spec, use: Use = {}): { leaks: number; stray: number; masked: number; items: number } {
  const [W, H] = FORMATS[spec.format];
  const sc: Scene = sceneOf(spec, browserMeasure(), use);
  const withG = canvas(W, H), without = canvas(W, H);
  paint(withG, sc, null, { noText: true });
  paint(without, { ...sc, items: sc.items.filter((i) => i.kind !== 'graphic') }, null, { noText: true });
  const a = withG.getImageData(0, 0, W, H).data, b = without.getImageData(0, 0, W, H).data;
  let leaks = 0, stray = 0, masked = 0, items = 0;
  const mask = canvas(W, H);
  sc.items.forEach((it, i) => {
    if (it.kind !== 'text') return;
    items++;
    mask.clearRect(0, 0, W, H);
    paintText(mask, { ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: it.echoes?.map((e) => ({ ...e, paint: MASK })) });
    const r = bounds(it.quad), x0 = Math.max(0, Math.floor(r.x) - 4), y0 = Math.max(0, Math.floor(r.y) - 4);
    const x1 = Math.min(W, Math.ceil(r.x + r.w) + 4), y1 = Math.min(H, Math.ceil(r.y + r.h) + 4);
    if (x1 <= x0 || y1 <= y0) return;
    const m = mask.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const graphicBehind = sc.items.slice(0, i).some((g) => g.kind === 'graphic' && overlaps(g.quad, it.quad) && !g.avoid?.some((q) => contains(q, it.quad)));
    const allowed = behind(sc, i).map(rgbOf);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (m[((y - y0) * (x1 - x0) + (x - x0)) * 4 + 3] < 128) continue;
      masked++;
      const o = (y * W + x) * 4, p = [a[o], a[o + 1], a[o + 2]];
      if (!graphicBehind) {
        if (Math.abs(a[o] - b[o]) > 2 || Math.abs(a[o + 1] - b[o + 1]) > 2 || Math.abs(a[o + 2] - b[o + 2]) > 2) leaks++;
      } else {
        let best = Infinity;
        for (let u = 0; u < allowed.length && best > 6; u++) for (let v = u; v < allowed.length && best > 6; v++) best = Math.min(best, segDist(p, allowed[u], allowed[v]));
        if (best > 6) stray++;
      }
    }
  });
  return { leaks, stray, masked, items };
}
