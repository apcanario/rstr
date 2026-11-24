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
    const t: TextItem = { ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: it.echoes?.map((e) => ({ ...e, paint: MASK, halo: e.halo && MASK })) };
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

const chan = (p: number[], c: number[]) => Math.max(Math.abs(p[0] - c[0]), Math.abs(p[1] - c[1]), Math.abs(p[2] - c[2]));

/**
 * How far pixel p lies from what the declared colours can make: a declared colour or a blend of two (antialiasing,
 * gradients). A blend of three (a corner of one graphic on the edge of another) only where `three` is set: review
 * R6 S2 found the R6 triangle loosened the check for every style. It is now limited to photocopy Scenes, whose
 * many opaque found pieces meet in threes. (The review's first fix, three areas seen around the pixel, rejected
 * real photocopy corners whose third area is a hairline that never shows unblended.)
 */
export function blendDist(p: number[], allowed: number[][], three: boolean): number {
  let best = Infinity;
  for (let u = 0; u < allowed.length && best > 6; u++) for (let v = u; v < allowed.length && best > 6; v++) best = Math.min(best, segDist(p, allowed[u], allowed[v]));
  if (best <= 6 || !three) return best;
  for (let u = 0; u < allowed.length && best > 6; u++) for (let v = u + 1; v < allowed.length && best > 6; v++) for (let k = 1; k < 10 && best > 6; k++) {
    const q = [0, 1, 2].map((c) => allowed[u][c] + ((allowed[v][c] - allowed[u][c]) * k) / 10);
    for (let w = 0; w < allowed.length && best > 6; w++) if (w !== u && w !== v) best = Math.min(best, segDist(p, q, allowed[w]));
  }
  return best;
}

/**
 * The pixel-level 9.2 for graphics (review R13 S2): what a graphic's parameters can actually break, since the
 * Scene's boxes and fills are set at placement. Paint the design without text, once with its graphics and
 * once without, and look only inside every text item's painted mask (fill, outline, echoes):
 * - where the Scene puts no graphic behind the item, the two renders must be identical (`leaks`);
 * - where it does, every pixel must be a colour the Scene declared behind it, a blend of two, or (photocopy only)
 *   a blend of three (`stray`; see `blendDist`).
 */
export function graphicLeak(spec: Spec, use: Use = {}): { leaks: number; stray: number; masked: number; items: number; strays: { x: number; y: number; p: number[]; allowed: string[] }[] } {
  const [W, H] = FORMATS[spec.format];
  // a surface pass (the copier) is texture over everything, like a finish: what it does to text is not a graphic leak
  const sc0: Scene = sceneOf(spec, browserMeasure(), use);
  const sc: Scene = { ...sc0, items: sc0.items.filter((i) => !(i.kind === 'graphic' && i.pass)) };
  const withG = canvas(W, H), without = canvas(W, H);
  paint(withG, sc, null, { noText: true });
  paint(without, { ...sc, items: sc.items.filter((i) => i.kind !== 'graphic') }, null, { noText: true });
  const a = withG.getImageData(0, 0, W, H).data, b = without.getImageData(0, 0, W, H).data;
  let leaks = 0, stray = 0, masked = 0, items = 0;
  const strays: { x: number; y: number; p: number[]; allowed: string[] }[] = [];
  // blends of three are allowed only on a photocopy Scene (it carries the copier pass): see blendDist
  const three = sc0.items.some((i) => i.kind === 'graphic' && i.pass);
  const mask = canvas(W, H);
  sc.items.forEach((it, i) => {
    if (it.kind !== 'text') return;
    items++;
    mask.clearRect(0, 0, W, H);
    paintText(mask, { ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: it.echoes?.map((e) => ({ ...e, paint: MASK, halo: e.halo && MASK })) });
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
        const best = blendDist(p, allowed, three);
        if (best > 6) { stray++; if (strays.length < 8) strays.push({ x, y, p, allowed: behind(sc, i) }); }
      }
    }
  });
  return { leaks, stray, masked, items, strays };
}

/**
 * The photocopy ghost shows (review R6 E1): paint the design without its surface pass, once as it is and once with
 * the hot word's ghost taken away, and count pixels that differ, lie outside the word's own fill and halo, and are
 * near the spot colour. `share` is that count over the word's ink box area. Null when no word has a ghost.
 */
export function ghostShows(spec: Spec, use: Use = {}): { share: number; shown: number; box: number } | null {
  const [W, H] = FORMATS[spec.format];
  const m = browserMeasure();
  const sc0: Scene = sceneOf(spec, m, use);
  const sc: Scene = { ...sc0, items: sc0.items.filter((i) => !(i.kind === 'graphic' && i.pass)) };
  const k = sc.items.findIndex((i) => i.kind === 'text' && i.echoes?.length);
  if (k < 0) return null;
  const hot = sc.items[k] as TextItem, spot = hot.echoes![0].paint;
  if (typeof spot !== 'string') return null;
  // the word may be in two parts (sliced): take the ghost from both, and mask both
  const parts = new Set(sc.items.map((i, j) => (i.kind === 'text' && i.slot === hot.slot && (i.part === hot.part || i.part === hot.part + 'b') ? j : -1)).filter((j) => j >= 0));
  const a = canvas(W, H), b = canvas(W, H), mask = canvas(W, H);
  paint(a, sc);
  paint(b, { ...sc, items: sc.items.map((i, j) => (parts.has(j) && i.kind === 'text' ? { ...i, echoes: undefined } : i)) });
  for (const j of parts) {
    const t = sc.items[j] as TextItem;
    paintText(mask, { ...t, echoes: undefined, fill: MASK, stroke: t.stroke && { ...t.stroke, paint: MASK } });
  }
  const A = a.getImageData(0, 0, W, H).data, B = b.getImageData(0, 0, W, H).data, M = mask.getImageData(0, 0, W, H).data;
  const sp = rgbOf(spot);
  let shown = 0;
  for (let i = 0; i < A.length; i += 4) {
    if (M[i + 3] >= 128) continue;
    if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) < 12) continue;
    if (chan([A[i], A[i + 1], A[i + 2]], sp) <= 40) shown++;
  }
  const r = hot.runs[0], mt = m(r.s, hot.font, hot.size);
  const box = Math.max(1, (mt.left + mt.right) * (mt.ascent + mt.descent));
  return { share: shown / box, shown, box };
}
