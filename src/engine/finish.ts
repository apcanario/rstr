/**
 * The finishes of spec 7.1: a pass over the composed image; any style takes any finish. Deterministic from the
 * graphic seed (each on a stream of its own, so a finish shifts nothing the graphics draw).
 *
 * - Clean: nothing.
 * - Grain, Grunge: cover everything, type included; Grunge also spreads the ink of type a little first. Then the
 *   title is stamped again at part strength so its edges hold, in register (no colour ghost); Grunge's stamp is
 *   lighter than Grain's, so its speckle and pinholes show inside the letters (row R19).
 * - Row R19 rebuilt Grain, Grunge (a photocopy of the whole page, the seven steps of spec 7.1) and VHS (the eight
 *   steps). Each kernel takes a scale per term (`Terms`), so a test can switch one off; the counts each draws come
 *   from a plan of its seed alone (`grungePlan`, `vhsPlan`), the same at every export size. Glitch is R7's.
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
import { contrast, LARGE_TEXT_PX, parseHex, toHex } from './colour';
import { MASK } from '../data/palettes/system';
import { bounds, overlaps, pad, rectQuad, type Rect } from './geom';
import type { Time } from './graphics/clock';
import type { Ctx } from './graphics/types';
import { choosePalette } from './layout';
import { knockText, paint, paintText, textSpan } from './paint';
import { base, surfaceLike, viewOf, type View } from './view';
import { mix, noiseAt, rng, shuffle, type Rng } from './rng';
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
/** How strongly the title is stamped again over Grain and Grunge: Clean's pixels of the title, masked to its ink and a
 *  STAMP_EDGE rim. Grunge's lower than Grain's (spec 7.1 step 7); Grain's down from R7's 0.5 so a page that is mostly
 *  title still changes by 7 levels (spec 9.4; at 0.5 a Brutalist A seed read 6.81). */
export const RESTAMP: Partial<Record<Finish, number>> = { grain: 0.4, grunge: 0.35 };
/**
 * Grain and Grunge stamp the title again over its ink and this edge round it, px at 1080 wide (spec 7.1: "so its
 * edges hold"). Without it Grunge's lighter stamp let the guard put back 5.4% of Postmodern's text items over 48 seeds
 * (photocopy title words Clean already reads under 3:1, their rings darkened by the tone curve and uneven toner).
 */
export const STAMP_EDGE = 2;
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

/**
 * Smooth value noise in [0, 1] on a square lattice of `cell` px, by position (a knot is a hash of its place), read a
 * row at a time: any strip of a big render reads the noise of the same rows of the whole (R16).
 */
export class Lattice {
  private nx: number; private ix: Int32Array; private fx: Float32Array; private rows = new Map<number, Float32Array>();
  constructor(private seed: number, W: number, private cell: number) {
    this.cell = Math.max(1e-3, cell);
    this.nx = Math.ceil(W / this.cell) + 2;
    this.ix = new Int32Array(W); this.fx = new Float32Array(W);
    for (let x = 0; x < W; x++) { const a = x / this.cell, i = Math.floor(a), t = a - i; this.ix[x] = i; this.fx[x] = t * t * (3 - 2 * t); }
  }
  private knots(iy: number): Float32Array {
    let k = this.rows.get(iy);
    if (!k) {
      if (this.rows.size > 3) this.rows.clear();
      k = new Float32Array(this.nx);
      for (let i = 0; i < this.nx; i++) k[i] = noiseAt(this.seed, iy * this.nx + i);
      this.rows.set(iy, k);
    }
    return k;
  }
  /** The noise along row y into out (length W). */
  row(y: number, out: Float32Array): Float32Array {
    const a = y / this.cell, iy = Math.floor(a), t = a - iy, fy = t * t * (3 - 2 * t), k0 = this.knots(iy), k1 = this.knots(iy + 1);
    for (let x = 0; x < out.length; x++) {
      const i = this.ix[x], f = this.fx[x], top = k0[i] + (k0[i + 1] - k0[i]) * f, bot = k1[i] + (k1[i + 1] - k1[i]) * f;
      out[x] = top + (bot - top) * fy;
    }
    return out;
  }
}

/** Each kernel's terms, by name: a scale on each (1 when unset, 0 off). A term can be switched off in a test (R19). */
export type Terms<T extends string> = Partial<Record<T, number>>;
const on = <T extends string>(t: Terms<T>, n: T) => t[n] ?? 1;
/** Only the one term on. */
export const only = <T extends string>(all: readonly T[], n: T): Terms<T> => Object.fromEntries(all.map((x) => [x, x === n ? 1 : 0])) as Terms<T>;
const lum = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Grain's terms (spec 7.1): fine noise, clumps, the vignette. `tone` (the weighting by tone) scales the first two. */
export const GRAIN_TERMS = ['fine', 'clump', 'vignette'] as const;
export type GrainTerm = (typeof GRAIN_TERMS)[number] | 'tone';
/** Grain at strength 1 and 1080 wide (spec 7.1): levels of 255 either way, cell px, the corners' darkening. */
export const GRAIN = { fine: 26, clump: 14, cell: 2.5, low: 0.6, vignette: 0.24 };

/**
 * Grain (spec 7.1): fine noise (one value a pixel, the same on the three channels, even across its range: R7's was
 * the sum of two, peaked at 0, which spec 9.4's floor of 9 levels showed too weak) and clumped noise (value noise on
 * cells of 2.5 px), both weighted by tone (full at mid-grey, 0.6 at black and white), and a vignette (the corners 24%
 * darker, falling off with the fourth power of the distance from the centre). Noise that would pass black or white
 * goes the other way, so black, white and near-white grain as much as mid-tones (R19: clipped, they kept half of it
 * and spec 9.4's floor of 7 levels a seed failed on Postmodern's dark pages). `d`: rows y0 on of a W x H image.
 */
export function grainKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, y0 = 0, t: Terms<GrainTerm> = {}): void {
  const u = W / 1080, rows = rowsOf(d, W), fine = GRAIN.fine * k * on(t, 'fine'), clump = GRAIN.clump * k * on(t, 'clump');
  const vg = GRAIN.vignette * k * on(t, 'vignette'), tw = (1 - GRAIN.low) * on(t, 'tone');
  const L = new Lattice(mix(seed, 5), W, GRAIN.cell * u), cl = new Float32Array(W);
  const fx = new Float32Array(W);
  for (let x = 0; x < W; x++) { const v = (x - W / 2) / (W / 2); fx[x] = v * v; }
  for (let y = y0, i = 0; y < y0 + rows; y++) {
    const vy = (y - H / 2) / (H / 2), fy = vy * vy;
    if (clump) L.row(y, cl);
    for (let x = 0; x < W; x++, i += 4) {
      const p = (y * W + x) * 2, r2 = (fx[x] + fy) / 2, f = 1 - vg * r2 * r2;
      const s = 2 * lum(d[i], d[i + 1], d[i + 2]) - 1, w = 1 - tw * s * s;
      const g = ((noiseAt(seed, p) * 2 - 1) * fine + (clump ? (cl[x] * 2 - 1) * clump : 0)) * w;
      const r = d[i] * f, gg = d[i + 1] * f, b = d[i + 2] * f, hi = Math.max(r, gg, b), lo = Math.min(r, gg, b);
      // grain that would pass white or black goes the other way, the same on the three channels
      const h = hi + g > 255 || lo + g < 0 ? -g : g;
      d[i] = r + h; d[i + 1] = gg + h; d[i + 2] = b + h;
    }
  }
}

/** Where Grunge's nibbled edges may reach: px from each side, and each corner's largest bite (to stay off text). */
export interface Keep { l: number; r: number; t: number; b: number; corners: [number, number, number, number]; }

/** Grunge's terms, the steps of spec 7.1 in order (step 7, type, is the paint's ink spread and the restamp). */
export const GRUNGE_TERMS = ['tone', 'toner', 'feed', 'speckle', 'dust', 'edge'] as const;
export type GrungeTerm = (typeof GRUNGE_TERMS)[number];
/** On the photocopy dialect Grunge is the second generation of the copy: steps 2, 4 and 5 at half (spec 7.1). */
export const SECOND_GEN: Terms<GrungeTerm> = { toner: 0.5, speckle: 0.5, dust: 0.5 };
/** Grunge's terms for a Scene: the second generation where the style has drawn its own copier pass. */
export const grungeTerms = (sc: Scene): Terms<GrungeTerm> => (sc.items.some(isPass) ? SECOND_GEN : {});
/** Toner and paper (spec 7.1), levels of 255. */
export const TONER = 22, PAPER = 240;

/** What a Grunge copy draws, from its seed alone: the counts do not depend on the size (a 3x export has as many). */
export interface GrungePlan {
  /** The feed: down the page (streaks run down columns, bands across rows) or across it. */
  across: boolean;
  /** Streaks the full length of the page: place across the feed and width, px; levels (signed, at strength 1). */
  streaks: { at: number; w: number; v: number }[];
  /** Bands across the feed: place along it and depth, px; levels. */
  bands: { at: number; h: number; v: number }[];
  dust: { x: number; y: number; r: number }[];
  /** Hairs as polylines, px, and their thickness. */
  hairs: { p: [number, number][]; w: number }[];
  /** Sides with the lid's shadow (0 left, 1 right, 2 top, 3 bottom) and its depth, px. */
  shadow: { side: number; depth: number }[];
}

export function grungePlan(W: number, H: number, seed: number): GrungePlan {
  const u = W / 1080, r = rng(seed), across = r() < 0.5, cross = across ? H : W, feed = across ? W : H;
  const sign = () => (r() < 0.55 ? -1 : 1);
  const streaks = Array.from({ length: 5 + Math.floor(r() * 5) }, () => ({ at: r() * cross, w: (1 + r() * 5) * u, v: sign() * (0.06 + r() * 0.08) * 255 }));
  const bands = Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({ at: r() * feed, h: (30 + r() * 90) * u, v: sign() * (0.04 + r() * 0.03) * 255 }));
  const dust = Array.from({ length: 20 + Math.floor(r() * 21) }, () => ({ x: r() * W, y: r() * H, r: ((2 + r() * 4) * u) / 2 }));
  const hairs = Array.from({ length: 1 + Math.floor(r() * 3) }, () => {
    const len = (80 + r() * 220) * u, x = r() * W, y = r() * H, a = r() * Math.PI * 2, bend = (r() - 0.5) * 1.6, w = (1 + r() * 0.5) * u;
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, mx = (x + ex) / 2 - Math.sin(a) * len * bend * 0.5, my = (y + ey) / 2 + Math.cos(a) * len * bend * 0.5;
    const p: [number, number][] = [];
    for (let j = 0; j <= 32; j++) { const t = j / 32, s = 1 - t; p.push([s * s * x + 2 * s * t * mx + t * t * ex, s * s * y + 2 * s * t * my + t * t * ey]); }
    return { p, w };
  });
  const sides = shuffle(r, [0, 1, 2, 3]).slice(0, 1 + Math.floor(r() * 3));
  const shadow = sides.map((side) => ({ side, depth: (24 + r() * 36) * u }));
  return { across, streaks, bands, dust, hairs, shadow };
}

/** Stamp a disc of radius rad at (cx, cy) into cover (rows y0 on, W wide), keeping the larger coverage. */
function stamp(cover: Float32Array, W: number, y0: number, rows: number, cx: number, cy: number, rad: number) {
  const ya = Math.max(y0, Math.floor(cy - rad - 1)), yb = Math.min(y0 + rows - 1, Math.ceil(cy + rad + 1));
  const xa = Math.max(0, Math.floor(cx - rad - 1)), xb = Math.min(W - 1, Math.ceil(cx + rad + 1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const c = clamp01(rad + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)), j = (y - y0) * W + x;
    if (c > cover[j]) cover[j] = c;
  }
}

/**
 * Grunge (spec 7.1): a photocopy of the whole page, steps 1 to 6 in order: tone (paper and toner, colour a fifth
 * less saturated), uneven toner, feed streaks and bands, speckle and dropout with grain, dust and hair, and the edge
 * (the lid's shadow along one to three sides, and R7's nibbles at half depth), neither past `keep` (the free
 * distance to the nearest text). `paper`: the paper colour (about 240, leaning to the ground's hue). `t`: a scale
 * per step (SECOND_GEN on the photocopy dialect). `quiet` (one byte a pixel of d, or null; `quietMask`): no uneven
 * toner on or round type, and no speck, pinhole, dust or hair on or round small type, so the copy holds its text by
 * itself (without it the guard put back 8% of Swiss text items and 6.8% of Brutalist's; spec 9.4 allows under 5%).
 * `d`: rows y0 on of a W x H image.
 */
export function grungeKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, keep: Keep, y0 = 0, t: Terms<GrungeTerm> = {}, paper: [number, number, number] = [PAPER, PAPER, PAPER], quiet: Uint8Array | null = null): void {
  const u = W / 1080, rows = rowsOf(d, W), y1 = y0 + rows, P = grungePlan(W, H, seed);
  const kTone = Math.min(1, k * on(t, 'tone')), kToner = k * on(t, 'toner'), kFeed = k * on(t, 'feed'), kSpeck = k * on(t, 'speckle'), kDust = Math.min(1, k * on(t, 'dust')), kEdge = k * on(t, 'edge');
  // 1. tone: the lightest 12% of the range to paper, the darkest 14% to toner
  const lo = 0.14, hi = 0.88;
  // 2. uneven toner: value noise on cells of about 180 px
  const T = new Lattice(mix(seed, 11), W, 180 * u), tn = new Float32Array(W);
  // 3. feed: streaks across the feed, bands along it, as levels per column or row
  const cross = new Float32Array(P.across ? H : W), along = new Float32Array(P.across ? W : H), inBand = new Uint8Array(along.length);
  for (const s of P.streaks) for (let j = Math.max(0, Math.floor(s.at)); j < Math.min(cross.length, Math.ceil(s.at + s.w)); j++) cross[j] += s.v * kFeed;
  for (const b of P.bands) for (let j = Math.max(0, Math.floor(b.at - b.h / 2)); j < Math.min(along.length, Math.ceil(b.at + b.h / 2)); j++) {
    const e = clamp01(Math.min(j - (b.at - b.h / 2), b.at + b.h / 2 - j) / (6 * u));
    along[j] += b.v * kFeed * e; inBand[j] = 1;
  }
  // 4. speckle: dark specks on light areas (about 0.6% of pixels, clumps of 1 to 3 px), pinholes in dark ones (1.2%,
  // 1 to 4 px), both twice as dense inside the bands; grain up to 18 levels either way
  // (a speck is a round clump at a place of its own inside a cell twice its largest size; the odds of a cell are
  // set so the share of pixels covered is the spec's: cell area x share / the mean clump area)
  const ns = mix(seed, 12), np = mix(seed, 13), ng = mix(seed, 14), cs = 6 * u, cp = 8 * u;
  const nxs = Math.ceil(W / cs) + 1, nxp = Math.ceil(W / cp) + 1, ps = (0.006 * 36) / 3.7, pp = (0.012 * 64) / 5.9;
  // each cell's odds, read once per row of cells; then a row's coverage by the specks of its row of cells (a speck's
  // density is set by whether its cell's centre lies in a band)
  const cellRow = (seedS: number, nx: number) => { const a = new Float32Array(nx); let at = -1; return (cy: number) => { if (cy !== at) { at = cy; for (let i = 0; i < nx; i++) a[i] = noiseAt(seedS, cy * nx + i); } return a; }; };
  const rowS = cellRow(ns, nxs), rowP = cellRow(np, nxp);
  const covS = new Float32Array(W), covP = new Float32Array(W);
  /** Coverage of row y by the specks of its cells into out: diameter 1 to n px (at 1080), odds p (in a band 2p). */
  const specks = (out: Float32Array, seedS: number, c: number, nx: number, p: number, n: number, y: number, odds: Float32Array) => {
    out.fill(0);
    const cy = Math.floor(y / c), yc = (cy + 0.5) * c;
    for (let cx = 0; cx < nx; cx++) {
      const h = odds[cx], q = p * (inBand[Math.min(inBand.length - 1, Math.floor(P.across ? (cx + 0.5) * c : yc))] ? 2 : 1);
      if (h >= q) continue;
      const j = cy * nx + cx, z = (1 + Math.floor((h / q) * n)) * u, room = c - z;
      const ox = cx * c + z / 2 + noiseAt(seedS ^ 0x5bd1e995, j) * room, oy = cy * c + z / 2 + noiseAt(seedS ^ 0x27d4eb2f, j) * room, dy = y + 0.5 - oy;
      if (Math.abs(dy) > z / 2 + 0.5) continue;
      for (let x = Math.max(0, Math.floor(ox - z / 2 - 1)); x <= Math.min(W - 1, Math.ceil(ox + z / 2 + 1)); x++) {
        const v = clamp01(z / 2 + 0.5 - Math.hypot(x + 0.5 - ox, dy));
        if (v > out[x]) out[x] = v;
      }
    }
  };
  // 5. dust and hair, as coverage on these rows
  const cover = new Float32Array(rows * W);
  if (kDust > 0) {
    for (const s of P.dust) if (s.y + s.r + 1 >= y0 && s.y - s.r - 1 < y1) stamp(cover, W, y0, rows, s.x, s.y, s.r);
    for (const h of P.hairs) for (let j = 1; j < h.p.length; j++) {
      const [ax, ay] = h.p[j - 1], [bx, by] = h.p[j], n = Math.ceil(Math.hypot(bx - ax, by - ay) / (0.5 * u)) + 1;
      if (Math.max(ay, by) + h.w < y0 || Math.min(ay, by) - h.w > y1) continue;
      for (let q = 0; q <= n; q++) stamp(cover, W, y0, rows, ax + ((bx - ax) * q) / n, ay + ((by - ay) * q) / n, h.w / 2);
    }
  }
  // 6. the edge: the lid's shadow, uneven along each side, and R7's nibbles at half depth, none past keep
  const re = rng(mix(seed, 15));
  const lim = [keep.l, keep.r, keep.t, keep.b];
  const shade = [0, 1, 2, 3].map((side) => {
    const s = P.shadow.find((q) => q.side === side), len = side < 2 ? H : W, v = valueNoise(re, len, 90 * u);
    if (!s || kEdge <= 0) return null;
    for (let i = 0; i < len; i++) v[i] = Math.min(lim[side], s.depth * (0.55 + 0.9 * v[i]));
    return v;
  });
  const base = ((3 + re() * 6) * u * kEdge) / 2;
  const prof = (len: number, l: number) => { const v = valueNoise(re, len, 28 * u); for (let i = 0; i < len; i++) v[i] = Math.min(l, base * (0.3 + 1.6 * v[i] * v[i])); return v; };
  const dL = prof(H, keep.l), dR = prof(H, keep.r), dT = prof(W, keep.t), dB = prof(W, keep.b);
  const bite = keep.corners.map((l) => Math.min(l, ((28 + re() * 80) * u * kEdge) / 2));
  const arcs = bite.map(() => valueNoise(re, 64, 9));
  const soft = 1.5 * u;
  const sh = (side: number, i: number, dist: number) => { const v = shade[side]; if (!v || v[i] <= 0 || dist >= v[i]) return 0; const q = 1 - dist / v[i]; return q * q; };
  const cornerAt = (c: number, dx: number, dy: number) => {
    const R = bite[c];
    if (R <= 0 || dx > R || dy > R) return 0;
    const ang = Math.atan2(dy, dx) / (Math.PI / 2), q = arcs[c][Math.min(63, Math.floor(ang * 63))];
    return clamp01((R * (0.55 + 0.45 * q) - Math.hypot(dx, dy)) / soft);
  };
  const maxL = Math.max(...dL, bite[0], bite[2]) + 2 * u, maxR = Math.max(...dR, bite[1], bite[3]) + 2 * u;
  const maxS = Math.max(0, ...shade.map((v) => (v ? Math.max(...v) : 0))) + 1;
  const eL = Math.max(maxL, maxS), eR = W - 1 - Math.max(maxR, maxS);
  // rows this close to the top or bottom are read in full; the others only within eL and eR of the sides
  const topB = Math.max(maxS, Math.max(...dT, ...dB, ...bite) + 2 * u) + soft + 1;
  const [pr, pg, pb] = paper, nsh = mix(seed, 16), kk = Math.min(1, kSpeck);
  // a row at a time, each step its own small loop over the row (one big loop ran at half the speed)
  const R = new Float32Array(W), G = new Float32Array(W), B = new Float32Array(W);
  const toward = (x: number, cr: number, cg: number, cb: number, a: number) => { R[x] += (cr - R[x]) * a; G[x] += (cg - G[x]) * a; B[x] += (cb - B[x]) * a; };
  for (let y = y0; y < y1; y++) {
    const o = (y - y0) * W;
    for (let x = 0, i = o * 4; x < W; x++, i += 4) { R[x] = d[i]; G[x] = d[i + 1]; B[x] = d[i + 2]; }
    // 1. tone, 2. uneven toner (dark areas lightened by up to 14%, light ones darkened by up to 5%; not on type:
    // quiet), 3. feed: one loop over the row
    if (kToner) T.row(y, tn);
    const fc = kFeed ? (P.across ? cross[y] : along[y]) : 0, fx = P.across ? along : cross;
    for (let x = 0; x < W; x++) {
      let r = R[x], g = G[x], b = B[x];
      if (kTone > 0) {
        const L = lum(r, g, b), c = clamp01((L - lo) / (hi - lo)), q = (2 * c - 1) * (2 * c - 1), sat = 0.8 * (1 - q * q), Y = L * 255;
        r += (TONER + (pr - TONER) * c + (r - Y) * sat - r) * kTone;
        g += (TONER + (pg - TONER) * c + (g - Y) * sat - g) * kTone;
        b += (TONER + (pb - TONER) * c + (b - Y) * sat - b) * kTone;
      }
      let v = kFeed ? fc + fx[x] : 0;
      if (kToner && (quiet === null || !(quiet[o + x] & QUIET_TYPE))) { const L = lum(r, g, b); v += clamp01((tn[x] - 0.2) / 0.7) * kToner * 255 * (0.14 * (1 - L) - 0.05 * L); }
      R[x] = r + v; G[x] = g + v; B[x] = b + v;
    }
    // 4. speckle and dropout (none on small type), and grain
    if (kSpeck) {
      specks(covS, ns, cs, nxs, ps * kk, 3, y, rowS(Math.floor(y / cs)));
      specks(covP, np, cp, nxp, pp * kk, 4, y, rowP(Math.floor(y / cp)));
      for (let x = 0; x < W; x++) {
        const sd = covS[x], sp = covP[x];
        if ((sd || sp) && !(quiet !== null && quiet[o + x] & QUIET_SMALL)) {
          const L = lum(R[x], G[x], B[x]);
          if (sd) toward(x, TONER, TONER, TONER, 0.85 * L * sd);
          if (sp) toward(x, pr, pg, pb, 0.9 * (1 - L) * sp);
        }
        const gn = (noiseAt(ng, y * W + x) * 2 - 1) * 18 * kSpeck;
        R[x] += gn; G[x] += gn; B[x] += gn;
      }
    }
    // 5. dust and hair: dark, as on the glass (none on small type)
    if (kDust > 0) for (let x = 0; x < W; x++) {
      const cv = cover[o + x];
      if (cv && !(quiet !== null && quiet[o + x] & QUIET_SMALL)) toward(x, TONER, TONER, TONER, 0.85 * cv * kDust);
    }
    // 6. the edge: the lid's shadow and the nibbles, near the sides only
    if (kEdge) {
      const near = y < topB || y > H - 1 - topB;
      const xs = near ? [[0, W]] : [[0, Math.min(W, Math.ceil(eL) + 1)], [Math.max(0, Math.floor(eR)), W]];
      for (const [xa, xb] of xs) for (let x = xa; x < xb; x++) {
        if (!(x < eL || x > eR || y < Math.max(maxS, dT[x] + soft) || y > H - 1 - Math.max(maxS, dB[x] + soft))) continue;
        let a = Math.max(sh(0, y, x), sh(1, y, W - 1 - x), sh(2, x, y), sh(3, x, H - 1 - y));
        if (a) { a = Math.min(1, a * 0.92 * Math.min(1, kEdge) * (0.7 + 0.6 * noiseAt(nsh, y * W + x))); toward(x, TONER, TONER, TONER, a); }
        let e = Math.max(clamp01((dL[y] - x) / soft), clamp01((dR[y] - (W - 1 - x)) / soft), clamp01((dT[x] - y) / soft), clamp01((dB[x] - (H - 1 - y)) / soft));
        if (e < 1) e = Math.max(e, cornerAt(0, x, y), cornerAt(1, W - 1 - x, y), cornerAt(2, x, H - 1 - y), cornerAt(3, W - 1 - x, H - 1 - y));
        if (e) toward(x, TONER, TONER, TONER, 0.9 * e);
      }
    }
    for (let x = 0, i = o * 4; x < W; x++, i += 4) { d[i] = R[x]; d[i + 1] = G[x]; d[i + 2] = B[x]; }
  }
}

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

/** VHS's terms, the eight steps of spec 7.1 in order. */
export const VHS_TERMS = ['colour', 'scan', 'grain', 'tracking', 'ghost', 'dropout', 'tone', 'head'] as const;
export type VhsTerm = (typeof VHS_TERMS)[number];

/** What a VHS pass draws, from its seed alone: the counts do not depend on the size. */
export interface VhsPlan {
  /** Tracking bands: first row and depth, px. */
  tracking: { y: number; h: number }[];
  /** The ghost's offset to the right, px. */
  ghost: number;
  /** White dashes: place, length and height, px. */
  dropouts: { x: number; y: number; len: number; h: number }[];
}
export function vhsPlan(W: number, H: number, seed: number): VhsPlan {
  const u = W / 1080, r = rng(seed), head = 56 * u;
  const tracking = Array.from({ length: 2 + Math.floor(r() * 2) }, () => { const h = (46 + r() * 44) * u; return { y: Math.floor(r() * Math.max(1, H - head - h)), h }; });
  const ghost = (10 + r() * 4) * u;
  const dropouts = Array.from({ length: 6 + Math.floor(r() * 9) }, () => ({ x: r() * W, y: r() * H, len: (20 + r() * 100) * u, h: (1 + r()) * u }));
  return { tracking, ghost, dropouts };
}

/**
 * VHS (spec 7.1), the eight steps in order: colour (the picture's colour, not its brightness, blurred 8 px sideways
 * and shifted 4 px, red and blue 2 px apart), scanlines (every other row at 0.80), streak grain (noise blurred 11 x 1,
 * up to 45 levels at three standard deviations, at any size), two or three tracking bands (rows jittered up to 30 px, 12% white noise), a ghost (10 to 14 px to
 * the right at 12%), dropouts (white dashes), tone (blacks lifted to about 18, saturation up a tenth) and head
 * switching (the bottom 56 px skewed by up to 90 px, with noise). Every step works within its row, so a strip draws
 * the rows of the whole. `d`: rows y0 on of a W x H image.
 */
export function vhsKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, y0 = 0, t: Terms<VhsTerm> = {}): void {
  const u = W / 1080, P = vhsPlan(W, H, seed), ns = mix(seed, 1), nb = mix(seed, 3), nh = mix(seed, 4), nj = mix(seed, 5), rows = rowsOf(d, W), y1 = y0 + rows;
  const kc = Math.min(1, k * on(t, 'colour')), scan = 1 - 0.2 * Math.min(1, k) * on(t, 'scan'), amp = 45 * k * on(t, 'grain');
  const kt = on(t, 'tracking'), kg = 0.12 * k * on(t, 'ghost'), kd = Math.min(1, k * on(t, 'dropout')), lift = 18 * k * on(t, 'tone'), sat = 0.1 * k * on(t, 'tone'), kh = on(t, 'head');
  const blur = Math.max(1, Math.round(8 * u)), shift = Math.round(4 * u), split = Math.max(1, Math.round(u)), rad = Math.max(1, Math.round(5 * u)), step = Math.max(1, Math.round(u));
  const cr = new Float32Array(W), cg = new Float32Array(W), cb = new Float32Array(W), Y = new Float32Array(W), raw = new Float32Array(W);
  const pr = new Float32Array(W + 1), pgr = new Float32Array(W + 1), pbl = new Float32Array(W + 1);
  const hb = Math.round(56 * u);
  for (let y = y0; y < y1; y++) {
    const o = (y - y0) * W * 4;
    // 1. colour: the chroma (each channel less the brightness) blurred sideways and shifted
    if (kc > 0) {
      for (let x = 0, i = o; x < W; x++, i += 4) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; Y[x] = v; cr[x] = d[i] - v; cg[x] = d[i + 1] - v; cb[x] = d[i + 2] - v; }
      pr[0] = pgr[0] = pbl[0] = 0;
      for (let x = 0; x < W; x++) { pr[x + 1] = pr[x] + cr[x]; pgr[x + 1] = pgr[x] + cg[x]; pbl[x + 1] = pbl[x] + cb[x]; }
      const box = (p: Float32Array, c: number) => { const a = edge(c - blur, W), b = edge(c + blur, W); return (p[b + 1] - p[a]) / (b - a + 1); };
      for (let x = 0, i = o; x < W; x++, i += 4) {
        const c = x - shift, R = Y[x] + box(pr, c - split), G = Y[x] + box(pgr, c), B = Y[x] + box(pbl, c + split);
        d[i] += (R - d[i]) * kc; d[i + 1] += (G - d[i + 1]) * kc; d[i + 2] += (B - d[i + 2]) * kc;
      }
    }
    // 2. scanlines
    if (scan < 1 && Math.floor(y / step) & 1) for (let x = 0, i = o; x < W; x++, i += 4) { d[i] *= scan; d[i + 1] *= scan; d[i + 2] *= scan; }
    // 3. streak grain: noise blurred 11 x 1 sideways
    if (amp) {
      for (let x = 0; x < W; x++) { const p = (y * W + x) * 2; raw[x] = noiseAt(ns, p) + noiseAt(ns, p + 1) - 1; }
      let acc = 0;
      for (let x = -rad; x <= rad; x++) acc += raw[wrap(x, W)];
      for (let x = 0, i = o; x < W; x++, i += 4) {
        const g = (acc / Math.sqrt(2 * rad + 1) / 1.22) * amp;
        d[i] += g; d[i + 1] += g; d[i + 2] += g;
        acc += raw[wrap(x + rad + 1, W)] - raw[wrap(x - rad, W)];
      }
    }
    // 4. tracking: the band's rows jittered sideways, with white noise
    if (kt > 0) for (let b = 0; b < P.tracking.length; b++) {
      const T = P.tracking[b];
      if (y < T.y || y >= T.y + T.h) continue;
      const j = Math.floor((y - T.y) / step), off = Math.round((noiseAt(nj, b * 4096 + j) - 0.5) * 2 * 30 * u * Math.min(1.5, k) * kt), line = d.slice(o, o + W * 4);
      for (let x = 0, i = o; x < W; x++, i += 4) {
        const s = wrap(x - off, W) * 4, p = (y * W + x) * 2;
        if (noiseAt(nb, p) < 0.12 * Math.min(1, k) * kt) { const v = 170 + 85 * noiseAt(nb, p + 1); d[i] = d[i + 1] = d[i + 2] = v; }
        else { d[i] = line[s]; d[i + 1] = line[s + 1]; d[i + 2] = line[s + 2]; }
      }
    }
    // 5. ghost: the row again, to the right, faint
    if (kg > 0) {
      const line = d.slice(o, o + W * 4), g = Math.round(P.ghost);
      for (let x = 0, i = o; x < W; x++, i += 4) { const s = edge(x - g, W) * 4; d[i] += (line[s] - d[i]) * kg; d[i + 1] += (line[s + 1] - d[i + 1]) * kg; d[i + 2] += (line[s + 2] - d[i + 2]) * kg; }
    }
    // 6. dropouts: white dashes
    if (kd > 0) for (const q of P.dropouts) {
      if (y < Math.floor(q.y) || y >= Math.floor(q.y) + Math.max(1, Math.round(q.h))) continue;
      for (let x = Math.max(0, Math.floor(q.x)); x < Math.min(W, Math.floor(q.x + q.len)); x++) { const i = o + x * 4; d[i] += (245 - d[i]) * kd; d[i + 1] += (245 - d[i + 1]) * kd; d[i + 2] += (245 - d[i + 2]) * kd; }
    }
    // 7. tone: blacks lifted, saturation up
    if (lift || sat) for (let x = 0, i = o; x < W; x++, i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], f = (255 - lift) / 255;
      for (let c = 0; c < 3; c++) d[i + c] = lift + (v + (d[i + c] - v) * (1 + sat)) * f;
    }
    // 8. head switching: the bottom rows skewed, more towards the bottom, with noise
    if (kh > 0 && y >= H - hb) {
      const j = y - (H - hb), tt = (j + 1) / hb, off = Math.round(tt * tt * 90 * u * k * kh), line = d.slice(o, o + W * 4);
      for (let x = 0, i = o; x < W; x++, i += 4) {
        const s = Math.min(W - 1, x + off) * 4, g = (noiseAt(nh, y * W + x) - 0.5) * 70 * Math.min(1.5, k) * kh * tt;
        d[i] = line[s] + g; d[i + 1] = line[s + 1] + g; d[i + 2] = line[s + 2] + g;
      }
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
/** Grunge's paper (spec 7.1): about 240, leaning to the ground's hue (a quarter of the ground's colour, its brightness taken out). */
export function paperOf(sc: Scene): [number, number, number] {
  let c: [number, number, number];
  try { c = parseHex(sc.ground); } catch { return [PAPER, PAPER, PAPER]; }
  if (!c.every((v) => Number.isFinite(v))) return [PAPER, PAPER, PAPER];
  const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return c.map((v) => Math.max(0, Math.min(255, PAPER + 0.25 * (v - y)))) as [number, number, number];
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
 * it if `tooLow` says the finish took it there; then every item not put back is read again, since putting back an
 * item can take a word it collides with low (row R19: a photocopy title word, under the new Grunge). `clean` is a
 * Clean render if the caller has one.
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
      // an item read fine is read again next round: putting back a neighbour it collides with can take it low (R19)
      return !!tooLow(textContrast(clean, mask, it), m);
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
/** Text under this size (scene px) is small for Grunge: its blemishes keep off it (`grungeKernel`'s quiet). */
export const QUIET_PX = LARGE_TEXT_PX;
/**
 * Where Grunge holds back (row R19): every text item's glyphs with the guard's ring, grown by 2 px (at 1080 wide),
 * get no uneven toner (it lifted black type on a mid-dark plate under 3:1: Brutalist's title on its colour band), and
 * small ones no speck, pinhole, dust or hair either. One byte per pixel of ctx's canvas (QUIET_TYPE, QUIET_SMALL
 * bits), or null when the design has no text.
 */
export function quietMask(sc: Scene, ctx: Ctx): Uint8Array | null {
  const all = texts(sc);
  if (!all.length) return null;
  const W = ctx.canvas.width, H = ctx.canvas.height, v = viewOf(ctx), grow = Math.round(2 * v.sx), out = new Uint8Array(W * H), M = surfaceLike(ctx);
  // each item is drawn alone and read over the rows it can reach only (a full-canvas read per item cost 150 ms at 9:16)
  const spans: [number, number][] = [];
  for (const it of all) {
    const [s0, s1] = textSpan(it, RING), r0 = Math.max(0, Math.floor(s0 * v.sy + v.oy - v.top)), r1 = Math.min(H, Math.ceil(s1 * v.sy + v.oy - v.top));
    if (r1 <= r0) continue;
    M.setTransform(1, 0, 0, 1, 0, 0);
    M.clearRect(0, r0, W, r1 - r0);
    base(M);
    knockText(M, it, RING);
    const d = M.getImageData(0, r0, W, r1 - r0).data, bit = it.px < QUIET_PX ? QUIET_TYPE | QUIET_SMALL : QUIET_TYPE;
    for (let i = 0, j = r0 * W; i < d.length; i += 4, j++) if (d[i + 3] >= 128 && out[j] < bit) out[j] = bit;
    spans.push([r0, r1]);
  }
  // grown by `grow` px over the rows the items reach (the bits nest, small type being type, so one max filter grows both)
  spans.sort((p, q) => p[0] - q[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of spans) { const m = merged[merged.length - 1]; if (m && a <= m[1] + 2 * grow) m[1] = Math.max(m[1], b); else merged.push([a, b]); }
  for (const [a0, b0] of merged) {
    const a = Math.max(0, a0 - grow), b = Math.min(H, b0 + grow), g = dilate(out.slice(a * W, b * W), W, b - a, grow);
    out.set(g, a * W);
  }
  return out;
}
/** quietMask's bits: under or round any text item (no uneven toner), under or round small text (no blemish either). */
export const QUIET_TYPE = 1, QUIET_SMALL = 2;
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
    const keep = f === 'grunge' ? keepIn(keepOf(sc), v) : null, gt = grungeTerms(sc), pp = paperOf(sc), qm = f === 'grunge' ? quietMask(sc, ctx) : null;
    pixels(ctx, (d, V) => (f === 'grain' ? grainKernel(d, V.W, V.H, seed, k, V.top) : grungeKernel(d, V.W, V.H, seed, k, keep!, V.top, gt, pp, qm)));
    rep.effect = now() - t0; t0 = now();
    // the title again at part strength, so its edges hold: Clean's own pixels of the title's ink (fill, outline,
    // echoes), so it is in register and in Clean's colours, any surface pass included (review R7 E2)
    clean = cleanOf(ctx, sc, t);
    const titles = texts(sc).filter((it) => it.slot === 'title');
    const rim = STAMP_EDGE;
    overMasked(ctx, clean, maskLayer(ctx, titles, rim), (RESTAMP[f] ?? 0.5) * Math.min(1, k), titles, rim);
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
