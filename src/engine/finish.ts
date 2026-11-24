/**
 * The finishes of spec 7.1: a pass over the composed image; any style takes any finish. Deterministic from the
 * graphic seed (each on a stream of its own, so a finish shifts nothing the graphics draw).
 *
 * - Clean: nothing.
 * - Grain, Grunge: cover everything, type included; Grunge also spreads the ink of type a little first. Then the
 *   title is stamped again at part strength so its edges hold, in register (no colour ghost).
 * - VHS, Glitch: two passes. Ground and graphics (and marks), then the effect, then every text item on top, then
 *   any surface pass that belongs to the style (the photocopy copier pass). The effects never touch text.
 * - Every finish ends with the guard: contrast (spec 5) is checked on the Scene before the finish, and a finish never
 *   takes a text item under 3:1. The guard reads each text item's ink and a ring round it off the canvas; where the
 *   two means fall under 3:1, that item and its ring are put back as Clean drew them.
 *
 * The pixel kernels are pure functions on RGBA arrays, so they are unit-tested without a canvas.
 */
import { contrast, toHex } from './colour';
import { MASK } from '../data/palettes/system';
import { bounds, overlaps, pad, rectQuad, type Rect } from './geom';
import type { Time } from './graphics/clock';
import type { Ctx } from './graphics/types';
import { choosePalette } from './layout';
import { knockText, paint, paintText } from './paint';
import { mix, rng, type Rng } from './rng';
import type { GraphicItem, Item, Scene, TextItem } from './scene';
import type { Finish, Spec } from './spec';

const SALT = 0xf1a15e;
/** Below this, a finished text item is put back as Clean drew it (spec 7.1). */
export const FINISH_MIN_RATIO = 3;
/** The ring round a text item's ink that the guard and its proof read, px at 1080 wide. */
export const RING = 4;
/** How strongly the title is stamped again over Grain and Grunge. */
export const RESTAMP: Partial<Record<Finish, number>> = { grain: 0.5, grunge: 0.55 };
/** Grunge's ink spread on type, px at 1080 wide. */
export const SPREAD = 1.1;

/** The strength dial of the finish in use (spec 7.1, Advanced): `finish.<name>.strength`, 0 to 1.5, 1 when unset. */
export const strengthKey = (f: Finish) => `finish.${f}.strength`;
export function strength(spec: Spec): number {
  const v = spec.params[strengthKey(spec.finish)];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1.5, v)) : 1;
}

/** A finish's own stream: off the graphic seed, salted by the finish, so it never shifts the graphics. */
export const finishSeed = (spec: Spec) => mix(spec.seeds.graphic, SALT + ['clean', 'grain', 'grunge', 'vhs', 'glitch'].indexOf(spec.finish));

// ---------------------------------------------------------------------------------------------------------------
// pixel kernels: pure, deterministic from their seed

/** xorshift32 in a closure: the per-pixel noise (rng is for decisions; this is for millions of draws). */
function noise(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

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

/** Grain: fine film grain over everything and a little vignette. */
export function grainKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number): void {
  const n = noise(seed), amp = 16 * k, vg = 0.16 * k;
  const fx = new Float32Array(W), fy = new Float32Array(H);
  for (let x = 0; x < W; x++) { const v = (x - W / 2) / (W / 2); fx[x] = v * v; }
  for (let y = 0; y < H; y++) { const v = (y - H / 2) / (H / 2); fy[y] = v * v; }
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
    const g = (n() + n() - 1) * amp, r2 = (fx[x] + fy[y]) / 2, f = 1 - vg * r2 * r2;
    d[i] = d[i] * f + g; d[i + 1] = d[i + 1] * f + g; d[i + 2] = d[i + 2] * f + g;
  }
}

/** Where Grunge's nibbled edges may reach: px from each side, and each corner's largest bite (to stay off text). */
export interface Keep { l: number; r: number; t: number; b: number; corners: [number, number, number, number]; }

/**
 * Grunge: grain, photocopy dust, faint horizontal streaks, and nibbled edges with bigger bites at the corners,
 * none of which reaches past `keep` (the free distance to the nearest text).
 */
export function grungeKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, keep: Keep): void {
  const u = W / 1080, r = rng(seed), n = noise(mix(seed, 1));
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
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
    const a = n();
    let v = (a + n() - 1) * amp + streak[y];
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

/** VHS: chroma bleed, scanlines, streak grain, a tracking band, head-switching noise at the bottom. */
export function vhsKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number): void {
  const u = W / 1080, r = rng(seed), n = noise(mix(seed, 1)), src = d.slice();
  // chroma bleed: red +2 px, blue -2 px
  const sh = Math.max(1, Math.round(2 * u * Math.min(1, k + 0.25)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    d[i] = src[(y * W + Math.max(0, x - sh)) * 4];
    d[i + 2] = src[(y * W + Math.min(W - 1, x + sh)) * 4 + 2];
  }
  // streak grain: noise blurred 11 x 1 horizontally; scanlines: every other row at 0.90
  const rad = Math.max(1, Math.round(5 * u)), raw = new Float32Array(W), amp = 30 * k, scan = 1 - 0.1 * Math.min(1, k);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) raw[x] = n() + n() - 1;
    const line = Math.floor(y / Math.max(1, Math.round(u))) & 1 ? scan : 1;
    let acc = 0;
    for (let x = -rad; x <= rad; x++) acc += raw[wrap(x, W)];
    for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
      const g = (acc / (2 * rad + 1)) * amp;
      d[i] = d[i] * line + g; d[i + 1] = d[i + 1] * line + g; d[i + 2] = d[i + 2] * line + g;
      acc += raw[wrap(x + rad + 1, W)] - raw[wrap(x - rad, W)];
    }
  }
  // a tracking band: 46 px of jittered rows with 10% white noise
  const bh = Math.round(46 * u), y0 = Math.floor((0.15 + 0.7 * r()) * (H - bh)), jit = (4 + 10 * r()) * u * k;
  for (let y = y0; y < y0 + bh; y++) {
    const off = Math.round((r() - 0.5) * 2 * jit), line = row(d, W, y).slice();
    for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
      const j = wrap(x - off, W) * 4;
      if (n() < 0.1 * Math.min(1, k)) { const v = 170 + 85 * n(); d[i] = d[i + 1] = d[i + 2] = v; }
      else { d[i] = line[j]; d[i + 1] = line[j + 1]; d[i + 2] = line[j + 2]; }
    }
  }
  // head-switching: the bottom 36 px skewed progressively, with noise
  const hb = Math.round(36 * u);
  for (let j = 0; j < hb; j++) {
    const y = H - hb + j, t = (j + 1) / hb, off = Math.round(t * t * 60 * u * k), line = row(d, W, y).slice();
    for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
      const s = Math.min(W - 1, x + off) * 4, g = (n() - 0.5) * 60 * k * t;
      d[i] = line[s] + g; d[i + 1] = line[s + 1] + g; d[i + 2] = line[s + 2] + g;
    }
  }
}

/** Where the pixel-sort smear runs: from x0 (a graphic's edge) outward in dir, rows y0 to y0 + h, length len. */
export interface Smear { x0: number; y0: number; h: number; len: number; dir: 1 | -1; }

/** Glitch: slice displacement with RGB split, scanlines, and one pixel-sort smear (corruption bars are drawn after, in palette colours). */
export function glitchKernel(d: Uint8ClampedArray, W: number, H: number, seed: number, k: number, smear: Smear | null): void {
  const u = W / 1080, r = rng(seed), src = d.slice();
  const count = Math.round(18 * k);
  for (let s = 0; s < count; s++) {
    const y0 = Math.floor(r() * H), h = Math.round((3 + 47 * r()) * u), shift = Math.round((10 + 80 * r()) * u) * (r() < 0.5 ? -1 : 1), rs = Math.round((3 + 7 * r()) * u);
    for (let y = y0; y < Math.min(H, y0 + h); y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, sx = wrap(x - shift, W), b = y * W;
      d[i] = src[(b + wrap(sx - rs, W)) * 4];
      d[i + 1] = src[(b + sx) * 4 + 1];
      d[i + 2] = src[(b + wrap(sx + rs, W)) * 4 + 2];
    }
  }
  const scan = 1 - 0.1 * Math.min(1, k), step = Math.max(1, Math.round(u));
  for (let y = 0; y < H; y++) if (Math.floor(y / step) & 1) for (let x = 0, i = y * W * 4; x < W; x++, i += 4) { d[i] *= scan; d[i + 1] *= scan; d[i + 2] *= scan; }
  if (smear) {
    // pixels just inside the graphic's edge, sorted by brightness, dragged outward and fading
    const { x0, y0, h, len, dir } = smear;
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) {
      const px: number[][] = [];
      for (let j = 0; j < len; j++) { const x = x0 - dir * j; if (x < 0 || x >= W) break; const i = (y * W + x) * 4; px.push([d[i], d[i + 1], d[i + 2]]); }
      px.sort((a, b) => b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11 - (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11));
      const edge = 1 - Math.abs((y - y0) / h - 0.5) * 0.6;
      for (let j = 0; j < px.length; j++) {
        const x = x0 + dir * j;
        if (x < 0 || x >= W) break;
        const a = (1 - j / px.length) * edge * Math.min(1, k), i = (y * W + x) * 4, p = px[j];
        d[i] = d[i] * (1 - a) + p[0] * a; d[i + 1] = d[i + 1] * (1 - a) + p[1] * a; d[i + 2] = d[i + 2] * (1 - a) + p[2] * a;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// the passes

function surface(w: number, h: number): Ctx {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx;
}

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

/** Glitch's smear: off the edge of the first graphic that has room for it outside every text item. */
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

/** Glitch's corruption bars: about 16 short ticks in the accents at 35 to 85%, where no text is. */
function corruption(ctx: Ctx, sc: Scene, spec: Spec, r: Rng, k: number) {
  const P = choosePalette(spec), u = sc.w / 1080, cols = [P.accent, P.accent2, P.accent3].filter((c): c is string => !!c);
  const bs = textBoxes(sc).map((b) => rectQuad(pad(b, 6)));
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

function pixels(ctx: Ctx, sc: Scene, f: (d: Uint8ClampedArray) => void) {
  const im = ctx.getImageData(0, 0, sc.w, sc.h);
  f(im.data);
  ctx.putImageData(im, 0, 0);
}

const maskOf = (it: TextItem): TextItem => ({ ...it, fill: MASK, stroke: it.stroke && { ...it.stroke, paint: MASK }, echoes: it.echoes?.map((e) => ({ ...e, paint: MASK, halo: e.halo && MASK })) });

/**
 * A text item's contrast as painted: the mean colour of its full ink pixels against the mean colour of a ring
 * `ring` px wide round its ink, read off ctx. Null when the item has no full ink pixel on the canvas.
 * `mask` is a scratch canvas the size of ctx's.
 */
export function textContrast(ctx: Ctx, mask: Ctx, it: TextItem, ring = RING): { ratio: number; ink: number; ringPx: number } | null {
  const W = ctx.canvas.width, H = ctx.canvas.height, B = bounds(it.quad);
  const x0 = Math.max(0, Math.floor(B.x) - ring - 2), y0 = Math.max(0, Math.floor(B.y) - ring - 2);
  const x1 = Math.min(W, Math.ceil(B.x + B.w) + ring + 2), y1 = Math.min(H, Math.ceil(B.y + B.h) + ring + 2);
  if (x1 <= x0 || y1 <= y0) return null;
  const w = x1 - x0, h = y1 - y0;
  mask.setTransform(1, 0, 0, 1, 0, 0);
  mask.clearRect(x0, y0, w, h);
  paintText(mask, maskOf(it));
  const A = mask.getImageData(x0, y0, w, h).data;
  mask.clearRect(x0, y0, w, h);
  knockText(mask, it, ring);
  const R = mask.getImageData(x0, y0, w, h).data, C = ctx.getImageData(x0, y0, w, h).data;
  const ink = [0, 0, 0], rg = [0, 0, 0];
  let ni = 0, nr = 0;
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3] === 255) { ink[0] += C[i]; ink[1] += C[i + 1]; ink[2] += C[i + 2]; ni++; }
    else if (A[i + 3] === 0 && R[i + 3] >= 128) { rg[0] += C[i]; rg[1] += C[i + 1]; rg[2] += C[i + 2]; nr++; }
  }
  if (!ni || !nr) return null;
  const hex = (s: number[], n: number) => toHex([s[0] / n, s[1] / n, s[2] / n]);
  return { ratio: contrast(hex(ink, ni), hex(rg, nr)), ink: ni, ringPx: nr };
}

/** Put a text item and its ring back as Clean drew it. */
function restore(ctx: Ctx, clean: Ctx, it: TextItem, ring: number) {
  // the mask on a layer of its own first: destination-in per glyph draw would keep only the last run
  const W = ctx.canvas.width, H = ctx.canvas.height, M = surface(W, H), L = surface(W, H);
  knockText(M, it, ring + 2);
  L.drawImage(clean.canvas as CanvasImageSource, 0, 0);
  L.globalCompositeOperation = 'destination-in';
  L.drawImage(M.canvas as CanvasImageSource, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(L.canvas as CanvasImageSource, 0, 0);
  ctx.restore();
}

/**
 * The guard of spec 7.1: no finish takes a text item under 3:1. An item read under 3:1 after the finish is read
 * again on a Clean render; only if Clean had it at 3:1 or more is it put back (an item Clean already reads under
 * 3:1 by this measure, such as the colliding photocopy title words, was not taken there by the finish).
 * Returns how many items it put back.
 */
function guard(ctx: Ctx, sc: Scene, t: Time | null): number {
  const mask = surface(sc.w, sc.h), done = new Set<TextItem>(), restored = new Set<TextItem>();
  let clean: Ctx | null = null;
  for (let round = 0; round < 4; round++) {
    const bad = texts(sc).filter((it) => {
      if (done.has(it)) return false;
      const m = textContrast(ctx, mask, it);
      if (!m || m.ratio >= FINISH_MIN_RATIO) return false;
      if (!clean) { clean = surface(sc.w, sc.h); paint(clean, sc, t); }
      const c = textContrast(clean, mask, it);
      if (!c || c.ratio < FINISH_MIN_RATIO) { done.add(it); return false; }
      return true;
    });
    if (!bad.length) break;
    for (const it of bad) { restore(ctx, clean!, it, RING); done.add(it); restored.add(it); }
  }
  return restored.size;
}
/** What paintFinished did, for the tools: ms per stage and how many text items the guard put back. */
export interface FinishReport { paint: number; effect: number; text: number; guard: number; restored: number; }

/**
 * Paint a Scene with the spec's finish (spec 4 stage 3, spec 7.1). Clean is paint alone. The two-pass rule for VHS
 * and Glitch; cover and restamp for Grain and Grunge; the guard after every finish.
 */
export function paintFinished(ctx: Ctx, sc: Scene, spec: Spec, t: Time | null = null): FinishReport {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const rep: FinishReport = { paint: 0, effect: 0, text: 0, guard: 0, restored: 0 };
  let t0 = now();
  const f = spec.finish, k = strength(spec), seed = finishSeed(spec), u = sc.w / 1080;
  if (f === 'clean') { paint(ctx, sc, t); rep.paint = now() - t0; return rep; }
  if (f === 'grain' || f === 'grunge') {
    paint(ctx, sc, t, f === 'grunge' ? { spread: SPREAD * u * k } : {});
    rep.paint = now() - t0; t0 = now();
    pixels(ctx, sc, (d) => (f === 'grain' ? grainKernel(d, sc.w, sc.h, seed, k) : grungeKernel(d, sc.w, sc.h, seed, k, keepOf(sc))));
    rep.effect = now() - t0; t0 = now();
    // the title again at part strength, in register, so its edges hold
    ctx.save();
    ctx.globalAlpha = (RESTAMP[f] ?? 0.5) * Math.min(1, k);
    for (const it of texts(sc)) if (it.slot === 'title') paintText(ctx, it);
    ctx.restore();
    rep.text = now() - t0;
  } else {
    // pass one: everything under the text; the effect; pass two: the text, then any surface pass of the style
    paint(ctx, sc, t, { only: (i) => i.kind !== 'text' && !isPass(i) });
    rep.paint = now() - t0; t0 = now();
    const r = rng(mix(seed, 2));
    if (f === 'vhs') pixels(ctx, sc, (d) => vhsKernel(d, sc.w, sc.h, seed, k));
    else {
      const sm = smearOf(sc, r);
      pixels(ctx, sc, (d) => glitchKernel(d, sc.w, sc.h, seed, k, sm));
      corruption(ctx, sc, spec, r, k);
    }
    rep.effect = now() - t0; t0 = now();
    paint(ctx, sc, t, { only: (i) => i.kind === 'text' || isPass(i), noGround: true });
    rep.text = now() - t0;
  }
  t0 = now();
  rep.restored = guard(ctx, sc, t);
  rep.guard = now() - t0;
  return rep;
}
