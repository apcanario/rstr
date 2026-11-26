/**
 * The finishes of spec 7.1: a pass over the composed image; any style takes any finish. Deterministic from the
 * graphic seed (each on a stream of its own, so a finish shifts nothing the graphics draw).
 *
 * - Clean: nothing.
 * - Grain, Grunge: cover everything, type included; Grunge also spreads the ink of type a little first. Then the
 *   title is stamped again at part strength so its edges hold, in register (no colour ghost).
 * - VHS, Glitch: two passes. Ground and graphics (and marks), then the effect, then every text item on top, then
 *   any surface pass that belongs to the style (the photocopy copier pass). The effects never touch text: under
 *   every glyph and HOLD px round it, pass one's pixels are held as they were, so a plate stays under its text and
 *   no displaced pixel (a mark's included) lands on or round a letter (review R7 E1, M5).
 * - Every finish ends with the guard: contrast (spec 5) is checked on the Scene before the finish, and a finish never
 *   takes a text item under 3:1. The guard reads each text item off the canvas in cells about a cap height across
 *   (ink against a ring round it, per cell), so a few lost letters count (review R7 E1). An item is put back as
 *   Clean drew it, with its ring, where any cell falls under 3:1 that Clean had at 3:1 or more, or where an item
 *   Clean reads under 3:1 as a whole loses more than 5% of it (review R7 E2).
 *
 * The pixel kernels are pure functions on RGBA arrays, so they are unit-tested without a canvas.
 */
import { contrast, toHex } from './colour';
import { MASK } from '../data/palettes/system';
import { bounds, overlaps, pad, rectQuad, type Rect } from './geom';
import type { Time } from './graphics/clock';
import type { Ctx } from './graphics/types';
import { choosePalette } from './layout';
import { knockText, paint, paintText, textSpan } from './paint';
import { base, surfaceLike, viewOf, type View } from './view';
import { mix, noiseAt, rng, type Rng } from './rng';
import type { GraphicItem, Item, Scene, TextItem } from './scene';
import type { Finish, Spec } from './spec';
import { editedForm, type Ranged } from './controls';

const SALT = 0xf1a15e;
/** Below this, a finished text item is put back as Clean drew it (spec 7.1). */
export const FINISH_MIN_RATIO = 3;
/** The ring round a text item's ink that the guard and its proof read, px at 1080 wide. */
export const RING = 4;
/** How far round each glyph VHS and Glitch hold pass one's pixels: the guard's ring and 2 px (review R7 E1). */
export const HOLD = RING + 2;
/** An item Clean reads under 3:1 as a whole may lose at most this share of its ratio to a finish (review R7 E2). */
export const LOW_KEEP = 0.95;
/** The cell the guard reads a text item in: this share of its size, at least CELL_MIN px. */
export const CELL = 0.7, CELL_MIN = 8;
/** A cell is read only with at least this many ink pixels and this many ring pixels in it. */
export const CELL_PX = 12;
/** How strongly the title is stamped again over Grain and Grunge: Clean's pixels of the title, masked to its ink. */
export const RESTAMP: Partial<Record<Finish, number>> = { grain: 0.5, grunge: 0.55 };
/** Grunge's ink spread on type, px at 1080 wide. */
export const SPREAD = 1.1;

/** The strength dial of the finish in use (spec 7.1, Advanced): `finish.<name>.strength`, 0 to 1.5, 1 when unset. */
export const strengthKey = (f: Finish) => `finish.${f}.strength`;
export function strength(spec: Spec): number {
  const v = spec.params[strengthKey(spec.finish)];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1.5, v)) : 1;
}

/** Advanced, Style tab (spec 7.1, 10.3): the strength dial of the finish in use; Clean has none. Not a facet: Shuffle keeps it. */
export function finishControls(spec: Spec): Ranged[] {
  if (spec.finish === 'clean') return [];
  const key = strengthKey(spec.finish);
  return [{ kind: 'range', id: key, label: 'Strength', where: { at: 'params', key }, facet: null, min: 0, max: 1.5, step: 0.05, shown: 1 }];
}

/** A finish's own stream: off the graphic seed, salted by the finish, so it never shifts the graphics. */
export const finishSeed = (spec: Spec) => mix(spec.seeds.graphic, SALT + ['clean', 'grain', 'grunge', 'vhs', 'glitch'].indexOf(spec.finish));

// ---------------------------------------------------------------------------------------------------------------
// pixel kernels: pure, deterministic from their seed

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** The rows a kernel's pixels hold: `d` is rows y0 to y0 + its length of a W x H image (the whole, or a strip). */
const rowsOf = (d: Uint8ClampedArray, W: number) => d.length / (4 * W);

/** Smooth value noise in [0, 1] along n samples, a knot every `knot` samples. */
export function valueNoise(r: Rng, n: number, knot: number): Float32Array {
  const k = Math.max(1, Math.round(knot)), knots = Array.from({ length: Math.ceil(n / k) + 2 }, () => r());
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i / k), t = i / k - a, s = t * t * (3 - 2 * t);
    out[i] = knots[a] * (1 - s) + knots[a + 1] * s;
  }
  return out;
}

/** Grain: fine film grain over everything and a little vignette. `d`: rows y0 on of a W x H image. */
export function grainKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, y0 = 0): void {
  const amp = 16 * k, vg = 0.16 * k, rows = rowsOf(d, W);
  const fx = new Float32Array(W);
  for (let x = 0; x < W; x++) { const v = (x - W / 2) / (W / 2); fx[x] = v * v; }
  for (let y = y0, i = 0; y < y0 + rows; y++) {
    const vy = (y - H / 2) / (H / 2), fy = vy * vy;
    for (let x = 0; x < W; x++, i += 4) {
      const p = (y * W + x) * 2, g = (noiseAt(seed, p) + noiseAt(seed, p + 1) - 1) * amp, r2 = (fx[x] + fy) / 2, f = 1 - vg * r2 * r2;
      d[i] = d[i] * f + g; d[i + 1] = d[i + 1] * f + g; d[i + 2] = d[i + 2] * f + g;
    }
  }
}

/** Where Grunge's nibbled edges may reach: px from each side, and each corner's largest bite (to stay off text). */
export interface Keep { l: number; r: number; t: number; b: number; corners: [number, number, number, number]; }

/**
 * Grunge: grain, photocopy dust, faint horizontal streaks, and nibbled edges with bigger bites at the corners,
 * none of which reaches past `keep` (the free distance to the nearest text).
 */
export function grungeKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, keep: Keep, y0 = 0): void {
  const u = W / 1080, r = rng(seed), ns = mix(seed, 1), rows = rowsOf(d, W);
  const amp = 22 * k, dust = 0.0012 * k;
  // faint streaks: a few rows a little darker, a very few a little lighter
  const streak = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const p = r();
    if (p < 0.02 * k) { const len = 1 + Math.floor(r() * 3 * u), v = -(5 + r() * 12) * k; for (let j = 0; j < len && y + j < H; j++) streak[y + j] = v; }
    else if (p > 1 - 0.004 * k) streak[y] = (4 + r() * 8) * k;
  }
  // the edges: an irregular depth along each side, never past keep
  const base = (3 + r() * 6) * u * k;
  const prof = (len: number, lim: number) => { const v = valueNoise(r, len, 28 * u); for (let i = 0; i < len; i++) v[i] = Math.min(lim, base * (0.3 + 1.6 * v[i] * v[i])); return v; };
  const dL = prof(H, keep.l), dR = prof(H, keep.r), dT = prof(W, keep.t), dB = prof(W, keep.b);
  // the corner bites: bigger, irregular round the arc
  const bite = keep.corners.map((lim) => Math.min(lim, (28 + r() * 80) * u * k));
  const arcs = bite.map(() => valueNoise(r, 64, 9));
  const maxL = Math.max(...dL, bite[0], bite[2]) + 2 * u, maxR = Math.max(...dR, bite[1], bite[3]) + 2 * u;
  const soft = 1.5 * u;
  const cornerAt = (c: number, dx: number, dy: number) => {
    const R = bite[c];
    if (R <= 0 || dx > R || dy > R) return 0;
    const ang = Math.atan2(dy, dx) / (Math.PI / 2), q = arcs[c][Math.min(63, Math.floor(ang * 63))];
    return clamp01((R * (0.55 + 0.45 * q) - Math.hypot(dx, dy)) / soft);
  };
  for (let y = y0, i = 0; y < y0 + rows; y++) for (let x = 0; x < W; x++, i += 4) {
    const p = (y * W + x) * 2, a = noiseAt(ns, p);
    let v = (a + noiseAt(ns, p + 1) - 1) * amp + streak[y];
    if (a > 1 - dust) v += 120; else if (a < dust) v -= 150;
    let e = 0;
    if (x < maxL || x > W - 1 - maxR || y < dT[x] + soft || y > H - 1 - dB[x] - soft) {
      e = Math.max(clamp01((dL[y] - x) / soft), clamp01((dR[y] - (W - 1 - x)) / soft), clamp01((dT[x] - y) / soft), clamp01((dB[x] - (H - 1 - y)) / soft));
      if (e < 1) e = Math.max(e, cornerAt(0, x, y), cornerAt(1, W - 1 - x, y), cornerAt(2, x, H - 1 - y), cornerAt(3, W - 1 - x, H - 1 - y));
    }
    const f = 1 - 0.9 * e, g = v * (1 - e);
    d[i] = d[i] * f + g; d[i + 1] = d[i + 1] * f + g; d[i + 2] = d[i + 2] * f + g;
  }
}

const row = (d: Uint8ClampedArray, W: number, y: number) => d.subarray(y * W * 4, (y + 1) * W * 4);
const wrap = (x: number, W: number) => ((x % W) + W) % W;
const edge = (x: number, W: number) => (x < 0 ? 0 : x >= W ? W - 1 : x);

/**
 * Hold: where the mask `m` (one byte a pixel) is full, put back the pixels `keep` had (pass one before the effect);
 * where it is partial, blend by it. Pure, so it is unit-tested: whatever an effect does, nothing changes under a
 * full mask (review R7 E1).
 */
export function holdMask(d: Uint8ClampedArray, keep: Uint8ClampedArray, m: Uint8Array): void {
  for (let i = 0; i < d.length; i += 4) {
    const a = m[i >> 2];
    if (!a) continue;
    if (a === 255) { d[i] = keep[i]; d[i + 1] = keep[i + 1]; d[i + 2] = keep[i + 2]; d[i + 3] = keep[i + 3]; continue; }
    const t = a / 255;
    for (let c = 0; c < 4; c++) d[i + c] = keep[i + c] * t + d[i + c] * (1 - t);
  }
}

/** VHS: chroma bleed, scanlines, streak grain, a tracking band, head-switching noise at the bottom. `d`: rows y0 on. */
export function vhsKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, y0 = 0): void {
  const u = W / 1080, r = rng(seed), ns = mix(seed, 1), nb = mix(seed, 3), nh = mix(seed, 4), src = d.slice(), rows = rowsOf(d, W), y1 = y0 + rows;
  // chroma bleed: red +2 px, blue -2 px
  const sh = Math.max(1, Math.round(2 * u * Math.min(1, k + 0.25)));
  for (let y = 0; y < rows; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    d[i] = src[(y * W + Math.max(0, x - sh)) * 4];
    d[i + 2] = src[(y * W + Math.min(W - 1, x + sh)) * 4 + 2];
  }
  // streak grain: noise blurred 11 x 1 horizontally; scanlines: every other row at 0.90
  const rad = Math.max(1, Math.round(5 * u)), raw = new Float32Array(W), amp = 30 * k, scan = 1 - 0.1 * Math.min(1, k);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) { const p = (y * W + x) * 2; raw[x] = noiseAt(ns, p) + noiseAt(ns, p + 1) - 1; }
    const line = Math.floor(y / Math.max(1, Math.round(u))) & 1 ? scan : 1;
    let acc = 0;
    for (let x = -rad; x <= rad; x++) acc += raw[wrap(x, W)];
    for (let x = 0, i = (y - y0) * W * 4; x < W; x++, i += 4) {
      const g = (acc / (2 * rad + 1)) * amp;
      d[i] = d[i] * line + g; d[i + 1] = d[i + 1] * line + g; d[i + 2] = d[i + 2] * line + g;
      acc += raw[wrap(x + rad + 1, W)] - raw[wrap(x - rad, W)];
    }
  }
  // a tracking band: 46 px of jittered rows with 10% white noise
  const bh = Math.round(46 * u), b0 = Math.floor((0.15 + 0.7 * r()) * (H - bh)), jit = (4 + 10 * r()) * u * k;
  const offs = Array.from({ length: Math.max(0, bh) }, () => Math.round((r() - 0.5) * 2 * jit));
  for (let y = Math.max(b0, y0); y < Math.min(b0 + bh, y1); y++) {
    const off = offs[y - b0], line = row(d, W, y - y0).slice();
    for (let x = 0, i = (y - y0) * W * 4; x < W; x++, i += 4) {
      const j = wrap(x - off, W) * 4, p = (y * W + x) * 2;
      if (noiseAt(nb, p) < 0.1 * Math.min(1, k)) { const v = 170 + 85 * noiseAt(nb, p + 1); d[i] = d[i + 1] = d[i + 2] = v; }
      else { d[i] = line[j]; d[i + 1] = line[j + 1]; d[i + 2] = line[j + 2]; }
    }
  }
  // head-switching: the bottom 36 px skewed progressively, with noise
  const hb = Math.round(36 * u);
  for (let y = Math.max(H - hb, y0); y < Math.min(H, y1); y++) {
    const j = y - (H - hb), t = (j + 1) / hb, off = Math.round(t * t * 60 * u * k), line = row(d, W, y - y0).slice();
    for (let x = 0, i = (y - y0) * W * 4; x < W; x++, i += 4) {
      const s = Math.min(W - 1, x + off) * 4, g = (noiseAt(nh, y * W + x) - 0.5) * 60 * k * t;
      d[i] = line[s] + g; d[i + 1] = line[s + 1] + g; d[i + 2] = line[s + 2] + g;
    }
  }
}

/** Where the pixel-sort smear runs: from x0 (a graphic's edge) outward in dir, rows y0 to y0 + h, length len. */
export interface Smear { x0: number; y0: number; h: number; len: number; dir: 1 | -1; }

/** Glitch: slice displacement with RGB split, scanlines, and one pixel-sort smear (corruption bars are drawn after, in
 *  palette colours). `d`: rows y0 on of a W x H image; the smear in its pixels. */
export function glitchKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, smear: Smear | null, y0 = 0): void {
  const u = W / 1080, r = rng(seed), src = d.slice(), rows = rowsOf(d, W), y1 = y0 + rows;
  const count = Math.round(18 * k);
  for (let s = 0; s < count; s++) {
    const a0 = Math.floor(r() * H), h = Math.round((3 + 47 * r()) * u), shift = Math.round((10 + 80 * r()) * u) * (r() < 0.5 ? -1 : 1), rs = Math.round((3 + 7 * r()) * u);
    for (let y = Math.max(a0, y0); y < Math.min(H, a0 + h, y1); y++) for (let x = 0; x < W; x++) {
      // shifted, not wrapped: past the edge the edge pixel is repeated (elements.md: "shifted", review R7 M3)
      const i = ((y - y0) * W + x) * 4, sx = edge(x - shift, W), b = (y - y0) * W;
      d[i] = src[(b + edge(sx - rs, W)) * 4];
      d[i + 1] = src[(b + sx) * 4 + 1];
      d[i + 2] = src[(b + edge(sx + rs, W)) * 4 + 2];
    }
  }
  const scan = 1 - 0.1 * Math.min(1, k), step = Math.max(1, Math.round(u));
  for (let y = y0; y < y1; y++) if (Math.floor(y / step) & 1) for (let x = 0, i = (y - y0) * W * 4; x < W; x++, i += 4) { d[i] *= scan; d[i + 1] *= scan; d[i + 2] *= scan; }
  if (smear) {
    // pixels just inside the graphic's edge, sorted by brightness, dragged outward and fading
    const { x0, y0: sy0, h, len, dir } = smear;
    for (let y = Math.max(0, sy0, y0); y < Math.min(H, sy0 + h, y1); y++) {
      const px: number[][] = [], b = (y - y0) * W;
      for (let j = 0; j < len; j++) { const x = x0 - dir * j; if (x < 0 || x >= W) break; const i = (b + x) * 4; px.push([d[i], d[i + 1], d[i + 2]]); }
      px.sort((a, c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11 - (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11));
      const edge = 1 - Math.abs((y - sy0) / h - 0.5) * 0.6;
      for (let j = 0; j < px.length; j++) {
        const x = x0 + dir * j;
        if (x < 0 || x >= W) break;
        const a = (1 - j / px.length) * edge * Math.min(1, k), i = (b + x) * 4, p = px[j];
        d[i] = d[i] * (1 - a) + p[0] * a; d[i + 1] = d[i + 1] * (1 - a) + p[1] * a; d[i + 2] = d[i + 2] * (1 - a) + p[2] * a;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// the passes

const texts = (sc: Scene) => sc.items.filter((i): i is TextItem => i.kind === 'text');
const textBoxes = (sc: Scene) => texts(sc).map((t) => bounds(t.quad));
const isPass = (i: Item) => i.kind === 'graphic' && !!i.pass;

/** The free distance from each side, and from each corner, to the nearest text: Grunge's edges stop short of it. */
export function keepOf(sc: Scene): Keep {
  const W = sc.w, H = sc.h, bs = textBoxes(sc), gap = 6;
  let l = W, r = W, t = H, b = H;
  const corners: [number, number, number, number] = [W, W, W, W];
  const cs: [number, number][] = [[0, 0], [W, 0], [0, H], [W, H]];
  for (const q of bs) {
    l = Math.min(l, q.x); r = Math.min(r, W - (q.x + q.w)); t = Math.min(t, q.y); b = Math.min(b, H - (q.y + q.h));
    cs.forEach(([cx, cy], i) => {
      const dx = Math.max(q.x - cx, 0, cx - (q.x + q.w)), dy = Math.max(q.y - cy, 0, cy - (q.y + q.h));
      corners[i] = Math.min(corners[i], Math.hypot(dx, dy));
    });
  }
  const f = (v: number) => Math.max(0, v - gap);
  return { l: f(l), r: f(r), t: f(t), b: f(b), corners: corners.map(f) as Keep['corners'] };
}

/** Glitch's smear: off the edge of the first graphic that has room for it outside every text item (scene px). */
function smearOf(sc: Scene, r: Rng): Smear | null {
  const u = sc.w / 1080, h = Math.round(20 * u), len = Math.round(180 * u), bs = textBoxes(sc).map((b) => rectQuad(pad(b, 8)));
  const gs = sc.items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.layer !== 'ground' && i.layer !== 'mark' && !i.pass);
  const y = r(), side = r() < 0.5 ? 1 : -1;
  for (const g of gs) {
    const B = bounds(g.quad);
    for (const dir of [side, -side] as (1 | -1)[]) {
      const x0 = Math.round(dir > 0 ? B.x + B.w - 1 : B.x), y0 = Math.round(Math.max(0, B.y) + y * Math.max(0, Math.min(B.h, sc.h - B.y) - h));
      if (x0 < 0 || x0 >= sc.w || y0 < 0 || y0 + h > sc.h) continue;
      const box = { x: dir > 0 ? x0 : x0 - len, y: y0, w: len, h };
      if (!bs.some((q) => overlaps(q, rectQuad(box)))) return { x0, y0, h, len, dir };
    }
  }
  return null;
}

/** Glitch's corruption bars: about 16 short ticks in the accents at 35 to 85%, in empty areas: off text (padded),
 *  graphics, plates and rects (elements.md, review R7 M4). A bar with no free spot in 6 tries is left out. */
export function corruptionAvoid(sc: Scene) {
  return [
    ...textBoxes(sc).map((b) => rectQuad(pad(b, HOLD * sc.w / 1080))),
    ...sc.items.filter((i) => (i.kind === 'graphic' && i.layer !== 'ground' && !i.pass) || i.kind === 'rect').map((i) => i.quad),
  ];
}
function corruption(ctx: Ctx, sc: Scene, spec: Spec, r: Rng, k: number) {
  const P = editedForm(choosePalette(spec), spec), u = sc.w / 1080, cols = [P.accent, P.accent2, P.accent3].filter((c): c is string => !!c);
  const bs = corruptionAvoid(sc);
  base(ctx);
  const n = Math.round(16 * k);
  for (let i = 0; i < n; i++) {
    const h = Math.round((2 + 6 * r()) * u), w = Math.round((30 + 190 * r()) * u), col = cols[Math.floor(r() * cols.length)], a = 0.35 + 0.5 * r();
    for (let tries = 0; tries < 6; tries++) {
      const b: Rect = { x: Math.floor(r() * (sc.w - w)), y: Math.floor(r() * (sc.h - h)), w, h };
      if (bs.some((q) => overlaps(q, rectQuad(b)))) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
      break;
    }
  }
}


/** The smear in a view's pixels (R16: the effect runs on the export's own pixels). */
function smearIn(m: Smear | null, v: View): Smear | null {
  if (!m) return null;
  return { x0: Math.round(m.x0 * v.sx + v.ox), y0: Math.round(m.y0 * v.sy + v.oy), h: Math.max(1, Math.round(m.h * v.sy)), len: Math.max(1, Math.round(m.len * v.sx)), dir: m.dir };
}
/** Grunge's keep in a view's pixels. */
const keepIn = (k: Keep, v: View): Keep => ({ l: k.l * v.sx, r: k.r * v.sx, t: k.t * v.sy, b: k.b * v.sy, corners: k.corners.map((c) => c * v.sx) as Keep['corners'] });

/** Run a kernel on every pixel of the canvas: rows `top` on of the view's W x H. */
function pixels(ctx: Ctx, f: (d: Uint8ClampedArray, v: View) => void) {
  const c = ctx.canvas, v = viewOf(ctx);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  f(im.data, v);
  ctx.putImageData(im, 0, 0);
}

const maskOf = (it: TextItem): TextItem => ({ ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: it.echoes?.map((e) => ({ ...e, paint: MASK, halo: e.halo && MASK })) });

/** A text item's reading: the whole ink against the whole ring, and the same per cell (null: too few pixels). */
export interface Reading { ratio: number; ink: number; ringPx: number; cells: (number | null)[]; }

/** Per cell sums of a text item's ink and ring pixels: ink r, g, b, count, ring r, g, b, count. Additive over rows. */
export type Sums = Float64Array;

/** The grid a text item is read in, in the export's pixels: its origin, cell and size in cells (depends only on the item and the view's scale). */
function gridOfItem(it: TextItem, v: View, ring: number) {
  const B = bounds(it.quad), rd = ring * v.sx;
  const gx0 = Math.floor(B.x * v.sx + v.ox) - Math.ceil(rd) - 2, gy0 = Math.floor(B.y * v.sy + v.oy) - Math.ceil(rd) - 2;
  const gx1 = Math.ceil((B.x + B.w) * v.sx + v.ox) + Math.ceil(rd) + 2, gy1 = Math.ceil((B.y + B.h) * v.sy + v.oy) + Math.ceil(rd) + 2;
  const c = Math.max(CELL_MIN, Math.round(CELL * it.px * v.sx));
  return { gx0, gy0, gx1, gy1, c, cw: Math.ceil((gx1 - gx0) / c), ch: Math.ceil((gy1 - gy0) / c) };
}

/**
 * Add a text item's ink and ring pixels on ctx to its per-cell sums: the mean colour of its full ink pixels against a
 * ring `ring` scene px wide round its ink, per cell of a grid laid over it in the export's pixels (cells about a cap
 * height across: CELL of its size). Only canvas rows [r0, r1) are read, so a big render read strip by strip adds up
 * to the whole (R16). `mask` is a scratch canvas like ctx's. Returns the sums (made if none were given), or null when
 * the item is off these rows.
 */
export function cellSums(ctx: Ctx, mask: Ctx, it: TextItem, ring = RING, S: Sums | null = null, r0 = 0, r1 = Infinity): Sums | null {
  const v = viewOf(ctx), W = ctx.canvas.width, Hc = ctx.canvas.height, G = gridOfItem(it, v, ring);
  S ??= new Float64Array(G.cw * G.ch * 8);
  const x0 = Math.max(0, G.gx0), x1 = Math.min(W, G.gx1), y0 = Math.max(0, r0, G.gy0 - v.top), y1 = Math.min(Hc, r1, G.gy1 - v.top);
  if (x1 <= x0 || y1 <= y0) return S;
  const w = x1 - x0, h = y1 - y0;
  mask.setTransform(1, 0, 0, 1, 0, 0);
  mask.clearRect(x0, y0, w, h);
  base(mask);
  paintText(mask, maskOf(it));
  mask.setTransform(1, 0, 0, 1, 0, 0);
  const A = mask.getImageData(x0, y0, w, h).data;
  mask.clearRect(x0, y0, w, h);
  base(mask);
  knockText(mask, it, ring);
  mask.setTransform(1, 0, 0, 1, 0, 0);
  const R = mask.getImageData(x0, y0, w, h).data, C = ctx.getImageData(x0, y0, w, h).data;
  const c = G.c;
  for (let y = 0, i = 0; y < h; y++) {
    const cy = Math.floor((y + y0 + v.top - G.gy0) / c) * G.cw;
    for (let x = 0; x < w; x++, i += 4) {
      const o = (cy + Math.floor((x + x0 - G.gx0) / c)) * 8;
      if (A[i + 3] === 255) { S[o] += C[i]; S[o + 1] += C[i + 1]; S[o + 2] += C[i + 2]; S[o + 3]++; }
      else if (A[i + 3] === 0 && R[i + 3] >= 128) { S[o + 4] += C[i]; S[o + 5] += C[i + 1]; S[o + 6] += C[i + 2]; S[o + 7]++; }
    }
  }
  return S;
}

/** The reading of an item's sums; null when it has no full ink pixel or no ring pixel. */
export function readingOf(S: Sums | null): Reading | null {
  if (!S) return null;
  const n = S.length / 8, hex = (r: number, g: number, b: number, k: number) => toHex([r / k, g / k, b / k]);
  const T = [0, 0, 0, 0, 0, 0, 0, 0], cells: (number | null)[] = [];
  for (let j = 0; j < n; j++) {
    const o = j * 8;
    for (let q = 0; q < 8; q++) T[q] += S[o + q];
    cells.push(S[o + 3] >= CELL_PX && S[o + 7] >= CELL_PX ? contrast(hex(S[o], S[o + 1], S[o + 2], S[o + 3]), hex(S[o + 4], S[o + 5], S[o + 6], S[o + 7])) : null);
  }
  if (!T[3] || !T[7]) return null;
  return { ratio: contrast(hex(T[0], T[1], T[2], T[3]), hex(T[4], T[5], T[6], T[7])), ink: T[3], ringPx: T[7], cells };
}

/**
 * A text item's contrast as painted on ctx (the whole canvas): see cellSums. Null when the item has no full ink
 * pixel on the canvas. `mask` is a scratch canvas the size of ctx's.
 */
export function textContrast(ctx: Ctx, mask: Ctx, it: TextItem, ring = RING): Reading | null {
  return readingOf(cellSums(ctx, mask, it, ring));
}

/**
 * Whether a finish took a text item too low, from its reading on Clean and on the finished canvas: a cell under
 * 3:1 that Clean has at 3:1 or more (local loss, review R7 E1), or an item Clean reads under 3:1 that lost more
 * than LOW_KEEP of its ratio (review R7 E2). Pure: the guard and the proof both use it.
 */
export function tooLow(clean: Reading | null, fin: Reading | null): { cell: number; clean: number; fin: number } | null {
  if (!clean || !fin) return null;
  for (let j = 0; j < clean.cells.length; j++) {
    const a = clean.cells[j], b = fin.cells[j];
    if (a != null && b != null && a >= FINISH_MIN_RATIO && b < FINISH_MIN_RATIO - 1e-6) return { cell: j, clean: a, fin: b };
  }
  if (clean.ratio < FINISH_MIN_RATIO && fin.ratio < clean.ratio * LOW_KEEP - 1e-6) return { cell: -1, clean: clean.ratio, fin: fin.ratio };
  return null;
}

/** Whether a finished reading needs a look at Clean: any cell, or the whole, under 3:1. */
export const readsLow = (m: Reading | null): boolean => !!m && !(m.ratio >= FINISH_MIN_RATIO && m.cells.every((v) => v == null || v >= FINISH_MIN_RATIO));

/** A mask of text items: their ink (padPx null) or their ink and a pad round it, on a canvas like `like`. */
function maskLayer(like: Ctx, items: TextItem[], padPx: number | null): Ctx {
  const M = surfaceLike(like);
  for (const it of items) { if (padPx == null) paintText(M, maskOf(it)); else knockText(M, it, padPx); }
  return M;
}

/**
 * Clean's pixels laid over ctx at alpha a where the mask covers (by its alpha): the title's restamp, the guard's
 * put-back. Done on the bytes, a band of rows at a time (R16): the browser's own copy from one canvas to another is
 * not the same at every canvas size, and a strip of a big render must give the pixels of the whole.
 */
function overMasked(ctx: Ctx, clean: Ctx, M: Ctx, a: number, items: TextItem[], pad: number) {
  const W = ctx.canvas.width, H = ctx.canvas.height, step = 256, v = viewOf(ctx);
  // only the rows the items can reach (the mask is empty elsewhere)
  let r0 = H, r1 = 0;
  for (const it of items) {
    const [s0, s1] = textSpan(it, pad);
    r0 = Math.min(r0, Math.floor(s0 * v.sy + v.oy - v.top)); r1 = Math.max(r1, Math.ceil(s1 * v.sy + v.oy - v.top));
  }
  for (let y = Math.max(0, r0); y < Math.min(H, r1); y += step) {
    const h = Math.min(step, Math.min(H, r1) - y), D = ctx.getImageData(0, y, W, h), d = D.data;
    const c = clean.getImageData(0, y, W, h).data, m = M.getImageData(0, y, W, h).data;
    let any = false;
    for (let i = 0; i < d.length; i += 4) {
      const t = (a * m[i + 3] * c[i + 3]) / 65025;
      if (t <= 0) continue;
      any = true;
      d[i] = d[i] + (c[i] - d[i]) * t; d[i + 1] = d[i + 1] + (c[i + 1] - d[i + 1]) * t; d[i + 2] = d[i + 2] + (c[i + 2] - d[i + 2]) * t;
      d[i + 3] = d[i + 3] + (255 - d[i + 3]) * t;
    }
    if (any) ctx.putImageData(D, 0, y);
  }
}

/** Put text items and their rings back as Clean drew them, in order. */
export function restoreItems(ctx: Ctx, clean: Ctx, items: TextItem[], ring = RING) {
  for (const it of items) overMasked(ctx, clean, maskLayer(ctx, [it], ring + 2), 1, [it], ring + 2);
}

/** A Clean render like ctx (same size and view). */
export function cleanOf(ctx: Ctx, sc: Scene, t: Time | null): Ctx {
  const c = surfaceLike(ctx);
  paint(c, sc, t);
  return c;
}

/**
 * The guard of spec 7.1: no finish takes a text item under 3:1. Every text item is read in cells on the finished
 * canvas; where any cell is under 3:1, or the whole item is, it is read again on Clean, and put back as Clean drew
 * it if `tooLow` says the finish took it there. `clean` is a Clean render if the caller has one.
 * Returns how many items it put back. (A big render drawn in strips runs the same rounds over its strips: export.ts.)
 */
export function guard(ctx: Ctx, sc: Scene, t: Time | null, clean: Ctx | null = null): number {
  const mask = surfaceLike(ctx), done = new Set<TextItem>(), restored = new Set<TextItem>();
  for (let round = 0; round < GUARD_ROUNDS; round++) {
    const bad = texts(sc).filter((it) => {
      if (done.has(it)) return false;
      const m = textContrast(ctx, mask, it);
      if (!readsLow(m)) return false;
      clean ??= cleanOf(ctx, sc, t);
      if (!tooLow(textContrast(clean, mask, it), m)) { done.add(it); return false; }
      return true;
    });
    if (!bad.length) break;
    restoreItems(ctx, clean!, bad);
    for (const it of bad) { done.add(it); restored.add(it); }
  }
  return restored.size;
}
export const GUARD_ROUNDS = 4;

/** Grow a one-byte-a-pixel mask by r px (a square max filter, rows then columns). Pure. */
export function dilate(a: Uint8Array, W: number, H: number, r: number): Uint8Array {
  if (r <= 0) return a;
  const t = new Uint8Array(a.length), o = new Uint8Array(a.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 0;
    for (let j = Math.max(0, x - r); j <= Math.min(W - 1, x + r) && m < 255; j++) m = Math.max(m, a[y * W + j]);
    t[y * W + x] = m;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 0;
    for (let j = Math.max(0, y - r); j <= Math.min(H - 1, y + r) && m < 255; j++) m = Math.max(m, t[j * W + x]);
    o[y * W + x] = m;
  }
  return o;
}

/**
 * What VHS and Glitch hold: every text item's glyphs and echoes with the guard's ring (knockText at RING, the mask
 * the guard and the proof read), grown by HOLD - RING px (at 1080 wide). Grown in pixels, not by a wider stroke:
 * Chrome's text stroke leaves holes in small glyphs when it is much wider than they are (seen at 8 px round a full
 * stop). One byte per pixel of ctx's canvas.
 */
export function heldMask(sc: Scene, ctx?: Ctx): Uint8Array {
  const M = ctx ? surfaceLike(ctx) : surfaceLike(blank(sc.w, sc.h)), v = viewOf(M), W = M.canvas.width, H = M.canvas.height;
  for (const it of texts(sc)) knockText(M, it, RING);
  const d = M.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  return dilate(a, W, H, Math.round((HOLD - RING) * v.sx));
}
function blank(w: number, h: number): Ctx {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c.getContext('2d') as Ctx;
}

/** What paintFinished did, for the tools: ms per stage and how many text items the guard put back. */
export interface FinishReport { paint: number; effect: number; text: number; guard: number; restored: number; }

/**
 * A finish, the guard aside (spec 7.1): Clean is paint alone; the two-pass rule for VHS and Glitch; cover and
 * restamp for Grain and Grunge. Returns the Clean render it made (Grain, Grunge), for the guard. Works on any canvas
 * with a view (R16): the effects run on the export's own pixels, a strip's rows as the same rows of the whole.
 */
export function finishBody(ctx: Ctx, sc: Scene, spec: Spec, t: Time | null, rep: FinishReport): Ctx | null {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  let t0 = now();
  const f = spec.finish, k = strength(spec), seed = finishSeed(spec), v = viewOf(ctx), u = v.sx;
  if (f === 'clean') { paint(ctx, sc, t); rep.paint = now() - t0; return null; }
  let clean: Ctx | null = null;
  if (f === 'grain' || f === 'grunge') {
    paint(ctx, sc, t, f === 'grunge' ? { spread: SPREAD * k } : {});
    rep.paint = now() - t0; t0 = now();
    const keep = f === 'grunge' ? keepIn(keepOf(sc), v) : null;
    pixels(ctx, (d, V) => (f === 'grain' ? grainKernel(d, V.W, V.H, seed, k, V.top) : grungeKernel(d, V.W, V.H, seed, k, keep!, V.top)));
    rep.effect = now() - t0; t0 = now();
    // the title again at part strength, so its edges hold: Clean's own pixels of the title's ink (fill, outline,
    // echoes), so it is in register and in Clean's colours, any surface pass included (review R7 E2)
    clean = cleanOf(ctx, sc, t);
    const titles = texts(sc).filter((it) => it.slot === 'title');
    overMasked(ctx, clean, maskLayer(ctx, titles, null), (RESTAMP[f] ?? 0.5) * Math.min(1, k), titles, 0);
    rep.text = now() - t0;
  } else {
    // pass one: everything under the text; the effect; pass two: the text, then any surface pass of the style
    paint(ctx, sc, t, { only: (i) => i.kind !== 'text' && !isPass(i) });
    rep.paint = now() - t0; t0 = now();
    const r = rng(mix(seed, 2)), held = heldMask(sc, ctx);
    // the effect, then pass one's pixels held under and round every glyph: plates stay under their text (review R7 E1)
    if (f === 'vhs') pixels(ctx, (d, V) => { const keep = d.slice(); vhsKernel(d, V.W, V.H, seed, k, V.top); holdMask(d, keep, held); });
    else {
      const sm = smearIn(smearOf(sc, r), v);
      pixels(ctx, (d, V) => { const keep = d.slice(); glitchKernel(d, V.W, V.H, seed, k, sm, V.top); holdMask(d, keep, held); });
      corruption(ctx, sc, spec, r, k);
    }
    rep.effect = now() - t0; t0 = now();
    paint(ctx, sc, t, { only: (i) => i.kind === 'text' || isPass(i), noGround: true });
    rep.text = now() - t0;
  }
  void u;
  return clean;
}

/**
 * Paint a Scene with the spec's finish (spec 4 stage 3, spec 7.1), then the guard after every finish but Clean.
 */
export function paintFinished(ctx: Ctx, sc: Scene, spec: Spec, t: Time | null = null, o: { guard?: boolean } = {}): FinishReport {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const rep: FinishReport = { paint: 0, effect: 0, text: 0, guard: 0, restored: 0 };
  const clean = finishBody(ctx, sc, spec, t, rep);
  if (spec.finish === 'clean' || o.guard === false) return rep;
  const t0 = now();
  rep.restored = guard(ctx, sc, t, clean);
  rep.guard = now() - t0;
  return rep;
}
