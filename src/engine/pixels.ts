/** Pixel reads for the tools: a hash of a render, and the knock-out proof. Kept in the engine (CLAUDE.md). */
import { MARKER, MASK } from '../data/palettes/system';
import { FORMATS } from './formats';
import { bounds, contains, overlaps } from './geom';
import type { Ctx } from './graphics/types';
import { behind, haloOf, inkOf } from './invariants';
import { knockText, paint, paintText } from './paint';
import { CELL, CELL_MIN, CELL_PX, RING, paintFinished, textContrast, tooLow } from './finish';
import { contrast, needRatio, toHex } from './colour';
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

/**
 * The finish proofs of spec 7.1 (row R7), on one spec with a finish other than Clean. The Scene is drawn as Clean,
 * with the finish but no guard, and with the finish and its guard; every text item is read off them:
 * - `inkDiff`: pixels the text item's fill alone covers fully that differ from Clean at all, after the finish
 *   (review R7 M1: no allowance). VHS and Glitch must have none: the effect never touches text (two-pass rule).
 *   Grain and Grunge cover text on purpose. `maxDelta` is the largest channel difference over the whole ink (fill,
 *   outline, echoes), for the record. `ringDiff`: pixels of the ring round the ink (RING px) that differ from
 *   Clean: VHS and Glitch hold them, so none either (review R7 E1, M5).
 * - `rawLow`: text items the finish took too low before the guard ran (`tooLow`, read in cells): VHS and Glitch
 *   must have none, so the guard is a net and not the fix. `low`: the same after the guard: none for any finish.
 */
export function finishProof(spec: Spec, use: Use = {}): { items: number; inkPx: number; inkDiff: number; maxDelta: number; ringDiff: number; ringMax: number; byPart: Record<string, number>; rawLow: { part: string; cell: number; clean: number; fin: number }[]; low: { part: string; cell: number; clean: number; fin: number }[]; restored: number } {
  const [W, H] = FORMATS[spec.format];
  const sc = sceneOf(spec, browserMeasure(), use);
  const a = canvas(W, H), raw = canvas(W, H), b = canvas(W, H), mask = canvas(W, H), fillMask = canvas(W, H), ring = canvas(W, H);
  paint(a, sc);
  paintFinished(raw, sc, spec, null, { guard: false });
  const rep = paintFinished(b, sc, spec);
  const A = a.getImageData(0, 0, W, H).data, B = b.getImageData(0, 0, W, H).data;
  let items = 0, inkPx = 0, inkDiff = 0, ringDiff = 0, ringMax = 0;
  const byPart: Record<string, number> = {};
  let maxDelta = 0;
  const low: { part: string; cell: number; clean: number; fin: number }[] = [], rawLow: typeof low = [];
  for (const it of sc.items) {
    if (it.kind !== 'text') continue;
    items++;
    const part = it.slot + '.' + it.part;
    mask.clearRect(0, 0, W, H);
    paintText(mask, { ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: it.echoes?.map((e) => ({ ...e, paint: MASK, halo: e.halo && MASK })) });
    fillMask.clearRect(0, 0, W, H);
    paintText(fillMask, { ...it, fill: MASK, stroke: undefined, echoes: undefined });
    ring.clearRect(0, 0, W, H);
    knockText(ring, it, RING);
    const r = bounds(it.quad), x0 = Math.max(0, Math.floor(r.x) - RING - 2), y0 = Math.max(0, Math.floor(r.y) - RING - 2);
    const x1 = Math.min(W, Math.ceil(r.x + r.w) + RING + 2), y1 = Math.min(H, Math.ceil(r.y + r.h) + RING + 2);
    if (x1 > x0 && y1 > y0) {
      const m = mask.getImageData(x0, y0, x1 - x0, y1 - y0).data, fm = fillMask.getImageData(x0, y0, x1 - x0, y1 - y0).data, rm = ring.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const q = ((y - y0) * (x1 - x0) + (x - x0)) * 4 + 3, o = (y * W + x) * 4;
        const dd = Math.max(Math.abs(A[o] - B[o]), Math.abs(A[o + 1] - B[o + 1]), Math.abs(A[o + 2] - B[o + 2]));
        if (m[q] === 255) {
          inkPx++;
          if (dd > maxDelta) maxDelta = dd;
          if (fm[q] === 255 && dd > 0) { inkDiff++; byPart[part] = (byPart[part] ?? 0) + 1; }
        } else if (m[q] === 0 && rm[q] >= 128 && dd > 0) { ringDiff++; if (dd > ringMax) ringMax = dd; }
      }
    }
    const ca = textContrast(a, mask, it), cr = tooLow(ca, textContrast(raw, mask, it)), cb = tooLow(ca, textContrast(b, mask, it));
    if (cr) rawLow.push({ part, ...cr });
    if (cb) low.push({ part, ...cb });
  }
  return { items, inkPx, inkDiff, maxDelta, ringDiff, ringMax, byPart, rawLow, low, restored: rep.restored };
}

/**
 * The copier pass keeps photocopy title words legible (review bundle 3 M5): each title word's fill read in cells
 * (as the finish guard reads them) against its paper halo, or a boxed word's paper against the toner box round it
 * (a ring of 3 px), on the Clean render (which includes the pass) and on the same Scene drawn without the pass.
 * `low`: cells at `needRatio` of the word's size or more without the pass and under it with the pass (the copier
 * took them under: must be empty). `before`: cells under it already without the pass (not the copier's doing:
 * colliding words, reported). Pixels any later text item paints over are left out. Words with rule 4 waived
 * (paper edge off) are not read. `wash` (a test of the check): the paper colour over the Clean render at that alpha.
 */
export function copierProof(spec: Spec, use: Use = {}, wash = 0): { words: number; cells: number; low: { part: string; cell: number; ratio: number; need: number }[]; before: { part: string; cell: number; ratio: number; need: number }[] } | null {
  const [W, H] = FORMATS[spec.format];
  const sc = sceneOf(spec, browserMeasure(), use);
  if (!sc.items.some((i) => i.kind === 'graphic' && i.pass)) return null;
  const a = canvas(W, H), z = canvas(W, H);
  paint(a, sc);
  paint(z, sc, null, { only: (i) => !(i.kind === 'graphic' && i.pass) });
  if (wash > 0) { a.globalAlpha = wash; a.fillStyle = sc.ground; a.fillRect(0, 0, W, H); a.globalAlpha = 1; }
  const fm = canvas(W, H), sm = canvas(W, H), om = canvas(W, H);
  const texts = sc.items.filter((i): i is TextItem => i.kind === 'text');
  const low: { part: string; cell: number; ratio: number; need: number }[] = [], before: typeof low = [];
  let words = 0, cells = 0;
  texts.forEach((it, k) => {
    if (it.slot !== 'title' || it.waive?.includes(4)) return;
    words++;
    const B = bounds(it.quad), x0 = Math.max(0, Math.floor(B.x) - 6), y0 = Math.max(0, Math.floor(B.y) - 6);
    const x1 = Math.min(W, Math.ceil(B.x + B.w) + 6), y1 = Math.min(H, Math.ceil(B.y + B.h) + 6), w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    for (const m of [fm, sm, om]) { m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, W, H); }
    paintText(fm, { ...it, fill: MASK, stroke: undefined, echoes: undefined });
    if (it.stroke?.halo) paintText(sm, { ...it, fill: MASK, stroke: { ...it.stroke, paint: MASK }, echoes: undefined });
    else knockText(sm, { ...it, echoes: undefined }, 3);
    for (const o of texts.slice(k + 1)) paintText(om, { ...o, fill: MASK, stroke: o.stroke && { ...o.stroke, paint: MASK }, echoes: o.echoes?.map((e) => ({ ...e, paint: MASK, halo: e.halo && MASK })) });
    const F = fm.getImageData(x0, y0, w, h).data, S = sm.getImageData(x0, y0, w, h).data, O = om.getImageData(x0, y0, w, h).data;
    const c = Math.max(CELL_MIN, Math.round(CELL * it.px)), cw = Math.ceil(w / c), n = cw * Math.ceil(h / c);
    const read = (C: Uint8ClampedArray) => {
      const T = new Float64Array(n * 8);
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
        if (O[i + 3]) continue;
        const o = (Math.floor(y / c) * cw + Math.floor(x / c)) * 8;
        if (F[i + 3] === 255) { T[o] += C[i]; T[o + 1] += C[i + 1]; T[o + 2] += C[i + 2]; T[o + 3]++; }
        else if (F[i + 3] === 0 && S[i + 3] === 255) { T[o + 4] += C[i]; T[o + 5] += C[i + 1]; T[o + 6] += C[i + 2]; T[o + 7]++; }
      }
      return Array.from({ length: n }, (_, j) => {
        const o = j * 8;
        if (T[o + 3] < CELL_PX || T[o + 7] < CELL_PX) return null;
        return contrast(toHex([T[o] / T[o + 3], T[o + 1] / T[o + 3], T[o + 2] / T[o + 3]]), toHex([T[o + 4] / T[o + 7], T[o + 5] / T[o + 7], T[o + 6] / T[o + 7]]));
      });
    };
    const withPass = read(a.getImageData(x0, y0, w, h).data), without = read(z.getImageData(x0, y0, w, h).data), need = needRatio(it.px);
    for (let j = 0; j < n; j++) {
      const r = withPass[j], r0 = without[j];
      if (r == null || r0 == null) continue;
      cells++;
      const at = { part: it.part, cell: j, ratio: Math.round(r * 100) / 100, need };
      if (r0 < need - 1e-6) before.push({ ...at, ratio: Math.round(r0 * 100) / 100 });
      else if (r < need - 1e-6) low.push(at);
    }
  });
  return { words, cells, low, before };
}

/** Time one render of a spec, by stage (row R7: export timing), and the JPEG encode of it. ms. */
export async function bench(spec: Spec, use: Use = {}): Promise<{ scene: number; paint: number; effect: number; text: number; guard: number; restored: number; pass: number; encode: number; total: number }> {
  const [W, H] = FORMATS[spec.format];
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = c.getContext('2d') as Ctx;
  const t0 = performance.now();
  const sc = sceneOf(spec, browserMeasure(), use);
  const t1 = performance.now();
  const rep = paintFinished(ctx, sc, spec);
  const t2 = performance.now();
  // the surface pass alone (the photocopy copier), drawn again over the finished canvas: its cost, not part of total
  let pass = 0;
  if (sc.items.some((i) => i.kind === 'graphic' && i.pass)) {
    const tp = performance.now();
    paint(ctx, sc, null, { only: (i) => i.kind === 'graphic' && !!i.pass, noGround: true });
    pass = performance.now() - tp;
    paintFinished(ctx, sc, spec);
  }
  const t3 = performance.now();
  if ('convertToBlob' in c) await (c as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  else await new Promise<Blob | null>((r) => (c as HTMLCanvasElement).toBlob(r, 'image/jpeg', 0.92));
  const t4 = performance.now();
  return { scene: t1 - t0, paint: rep.paint, effect: rep.effect, text: rep.text, guard: rep.guard, restored: rep.restored, pass, encode: t4 - t3, total: t2 - t0 + (t4 - t3) };
}

/**
 * Row R14 (spec 9.4: text over the photo passes contrast measured on pixels): paint the design with its photo and
 * without its text, then read every pixel inside each text item's painted mask, for each item the photo lies under,
 * against the colours that carry it (`inkOf`). `low` counts mask pixels under the ratio of spec 5. `measured`: items
 * the photo was measured under (no plate); `plated`: items on a plate over it.
 */
export function photoPixels(spec: Spec, use: Use = {}): { items: number; measured: number; plated: number; masked: number; low: number; worst: number; lows: { part: string; ratio: number }[] } {
  const [W, H] = FORMATS[spec.format];
  const sc0: Scene = sceneOf(spec, browserMeasure(), use);
  const sc: Scene = { ...sc0, items: sc0.items.filter((i) => !(i.kind === 'graphic' && i.pass)) };
  const at = sc.items.findIndex((i) => i.kind === 'graphic' && i.name === 'photo');
  const out = { items: 0, measured: 0, plated: 0, masked: 0, low: 0, worst: Infinity, lows: [] as { part: string; ratio: number }[] };
  if (at < 0) return out;
  const g = sc.items[at] as import('./scene').GraphicItem;
  const base = canvas(W, H), mask = canvas(W, H);
  paint(base, sc, null, { noText: true });
  const a = base.getImageData(0, 0, W, H).data;
  sc.items.forEach((it, i) => {
    if (i <= at || it.kind !== 'text' || !overlaps(g.quad, it.quad) || haloOf(it) || it.waive?.includes(4)) return;
    out.items++;
    if (g.regions?.some((r) => contains(r.quad, it.quad))) out.measured++;
    else if (sc.items.slice(at + 1, i).some((p) => p.kind === 'rect' && p.plate && contains(p.quad, it.quad))) out.plated++;
    mask.clearRect(0, 0, W, H);
    paintText(mask, { ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: undefined });
    const r = bounds(it.quad), x0 = Math.max(0, Math.floor(r.x) - 2), y0 = Math.max(0, Math.floor(r.y) - 2);
    const x1 = Math.min(W, Math.ceil(r.x + r.w) + 2), y1 = Math.min(H, Math.ceil(r.y + r.h) + 2);
    if (x1 <= x0 || y1 <= y0) return;
    const m = mask.getImageData(x0, y0, x1 - x0, y1 - y0).data, need = needRatio(it.px);
    const inks = inkOf(it);
    let worst = Infinity;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (m[((y - y0) * (x1 - x0) + (x - x0)) * 4 + 3] < 128) continue;
      out.masked++;
      const o = (y * W + x) * 4, hex = toHex([a[o], a[o + 1], a[o + 2]]);
      const c = Math.min(...inks.map((k) => contrast(k, hex)));
      if (c < worst) worst = c;
      if (c < need - 1e-6) out.low++;
    }
    out.worst = Math.min(out.worst, worst);
    if (worst < need - 1e-6 && out.lows.length < 6) out.lows.push({ part: `${it.slot}.${it.part}`, ratio: Math.round(worst * 100) / 100 });
  });
  return out;
}
