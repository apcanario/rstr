/**
 * Photo treatments (spec 8.9, row R15): colour, monochrome, duotone, halftone, threshold, posterise, dither. Picked
 * by the graphic stream (a stream of its own, derived from the graphic seed, so a design without a photo draws as
 * before) from the style's list, its favourite more often; `photo.treatment` picks one by hand (any of the seven).
 * Duotone, halftone, threshold and dither take two palette colours, posterise three to five; colour and monochrome
 * take none. Their parameters are the graphic stream's unless Advanced sets them (`photo.*` params, Graphic's facet).
 *
 * Layout records the treatment on the photo item (`params`, and its colours as `colours.t0..`, darkest first), so
 * paint makes no decision: `treatPixels` is a pure function of the pixels and those values. Text over a treated photo
 * is measured against what the treatment makes of the photo's pixels there (`treatedRange`).
 */
import { contrast, luminance, mixHex, parseHex, toHex } from './colour';
import { mix, rng } from './rng';
import type { Form } from '../data/palettes/types';
import type { GraphicItem } from './scene';
import type { Spec } from './spec';
import { PHOTO_ANY } from '../data/palettes/system';

export const TREATMENTS = ['colour', 'mono', 'duotone', 'halftone', 'threshold', 'posterise', 'dither'] as const;
export type Treatment = (typeof TREATMENTS)[number];
export const TREATMENT_LABEL: Record<Treatment, string> = { colour: 'Colour', mono: 'Mono', duotone: 'Duotone', halftone: 'Halftone', threshold: 'Threshold', posterise: 'Posterise', dither: 'Dither' };
export const isTreatment = (v: unknown): v is Treatment => typeof v === 'string' && (TREATMENTS as readonly string[]).includes(v);

/** A style's treatments (spec 8.9): the ones the graphic stream draws from, and its favourite (drawn FAV_WEIGHT times as often). */
export interface TreatList { allow: Treatment[]; favourite: Treatment; }
export const FAV_WEIGHT = 3;
/** Where a style lists none: every treatment, colour the favourite. */
export const ALL_TREATMENTS: TreatList = { allow: [...TREATMENTS], favourite: 'colour' };

/** The parameter ranges (Advanced, spec 10.3: duotone roles, halftone screen, threshold level, and the rest). Sizes at 1080 wide. */
export const TREAT_RANGE = {
  contrast: { min: 0.6, max: 1.8 },  // mono
  screen: { min: 6, max: 48 },       // halftone cell, px at 1080
  angle: { min: 0, max: 90 },        // halftone screen angle, degrees
  level: { min: 0.2, max: 0.8 },     // threshold
  levels: { min: 3, max: 5 },        // posterise colours
  dot: { min: 1, max: 8 },           // dither pixel, px at 1080
} as const;
/** The Advanced key of a parameter: `photo.<name>`; `photo.duo` names the two roles ("ink+accent"). */
export const treatKey = (k: string) => 'photo.' + k;
/** Treatments that take two palette colours. */
export const TWO_COLOUR: Treatment[] = ['duotone', 'halftone', 'threshold', 'dither'];
/** What each treatment reads from Advanced, besides the roles of the two-colour ones. */
export const TREAT_PARAMS: Record<Treatment, (keyof typeof TREAT_RANGE)[]> = {
  colour: [], mono: ['contrast'], duotone: [], halftone: ['screen', 'angle'], threshold: ['level'], posterise: ['levels'], dither: ['dot'],
};

const ROLES = ['ground', 'ink', 'accent', 'accent2', 'accent3', 'paper', 'toner', 'spot', 'window', 'windowInk', 'chrome'] as const;
type Role = (typeof ROLES)[number];

/** The palette's distinct colours, each under the first role that has it, in role order. */
export function paletteColours(P: Form): { role: Role; hex: string }[] {
  const out: { role: Role; hex: string }[] = [];
  for (const r of ROLES) {
    const v = P[r];
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) && !out.some((o) => o.hex.toLowerCase() === v.toLowerCase())) out.push({ role: r, hex: v });
  }
  return out;
}

/** The pairs of roles a two-colour treatment may take: every pair of distinct colours at 3:1 or more; none: the pair with most contrast. */
export function treatPairs(P: Form): string[] {
  const cs = paletteColours(P), out: string[] = [];
  let best = '', score = -1;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const k = contrast(cs[i].hex, cs[j].hex), id = cs[i].role + '+' + cs[j].role;
    if (k >= 3) out.push(id);
    if (k > score) { score = k; best = id; }
  }
  return out.length ? out : best ? [best] : [];
}

/** Roles that are not a palette's ground or ink (review R15 M1: a duotone of the two neutrals reads as monochrome). */
const NEUTRAL: readonly string[] = ['ground', 'ink', 'paper', 'toner', 'window', 'windowInk'];
/**
 * The pairs the graphic stream draws a duotone from (review R15 M1): those of `treatPairs` with an accent in them
 * first; only where none reaches 3:1, every pair. A pair picked by hand (`photo.duo`) may still be any of `treatPairs`.
 */
export function duoPairs(P: Form): string[] {
  const all = treatPairs(P), acc = all.filter((id) => {
    const [a, b] = id.split('+') as Role[];
    return (!NEUTRAL.includes(a) || !NEUTRAL.includes(b)) && contrast(P[a] as string, P[b] as string) >= 3;
  });
  return acc.length ? acc : all;
}

/** Posterise takes three colours at least (spec 8.9: three to five). */
export const POSTERISE_MIN = 3;
/**
 * Whether a treatment can be drawn with a palette (review R15 S1): posterise only where the palette has three
 * distinct colours or more; the rest always. Where it cannot, the tile is disabled and `treatOf` draws another.
 */
export const treatOffered = (t: Treatment, P: Form): boolean => t !== 'posterise' || paletteColours(P).length >= POSTERISE_MIN;

const num = (v: unknown, a: number, b: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : undefined);

/** What layout records on the photo item: the treatment, its values and its colours (darkest first, by luminance). */
export interface Treat {
  name: Treatment;
  colours: string[];
  /** The roles the colours came from (the two of a two-colour treatment, "a+b"). */
  duo?: string;
  contrast?: number; screen?: number; angle?: number; level?: number; levels?: number; dot?: number;
  /** Halftone: light dots on the dark colour (a dark design) rather than dark dots on the light one. */
  inv?: boolean;
}

/**
 * The treatment of a design's photo (spec 8.9): `photo.treatment` if it names one, else the graphic stream's draw
 * from the style's list. Every value is drawn from the stream in a fixed order whatever is picked, so setting one
 * never moves another. Sizes are returned at 1080 wide (the caller scales them). Pure.
 */
export function treatOf(spec: Spec, P: Form, list: TreatList = ALL_TREATMENTS): Treat {
  const r = rng(mix(spec.seeds.graphic, 0x9410));
  const u = Array.from({ length: 8 }, () => r());
  const allow = list.allow.length ? list.allow : [...TREATMENTS];
  const weight = (t: Treatment) => (t === list.favourite ? FAV_WEIGHT : 1);
  let name: Treatment = allow[allow.length - 1];
  const sum = allow.reduce((a, t) => a + weight(t), 0);
  let x = u[0] * sum;
  for (const t of allow) if ((x -= weight(t)) < 0) { name = t; break; }
  if (isTreatment(spec.photo?.treatment)) name = spec.photo!.treatment as Treatment;
  // a palette with fewer than three colours cannot posterise (review R15 S1): the style's favourite, else threshold
  if (!treatOffered(name, P)) name = treatOffered(list.favourite, P) ? list.favourite : 'threshold';
  const p = spec.params, R = TREAT_RANGE, lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const out: Treat = { name, colours: [] };
  const byLum = (a: string, b: string) => luminance(a) - luminance(b);
  if (TWO_COLOUR.includes(name)) {
    const all = treatPairs(P), pairs = name === 'duotone' ? duoPairs(P) : all, asked = typeof p['photo.duo'] === 'string' && all.includes(p['photo.duo'] as string) ? (p['photo.duo'] as string) : null;
    const duo = asked ?? pairs[Math.min(pairs.length - 1, Math.floor(u[1] * pairs.length))];
    if (duo) {
      const [a, b] = duo.split('+') as Role[];
      out.duo = duo;
      out.colours = [P[a] as string, P[b] as string].sort(byLum);
    }
  }
  if (name === 'mono') out.contrast = num(p['photo.contrast'], R.contrast.min, R.contrast.max) ?? lerp(1, 1.4, u[2]);
  if (name === 'halftone') {
    out.screen = num(p['photo.screen'], R.screen.min, R.screen.max) ?? R.screen.min * Math.pow(R.screen.max / R.screen.min, 0.15 + 0.6 * u[3]);
    out.angle = num(p['photo.angle'], R.angle.min, R.angle.max) ?? [15, 45, 75, 0][Math.floor(u[4] * 4)];
    out.inv = P.mode === 'dark';
  }
  if (name === 'threshold') out.level = num(p['photo.level'], R.level.min, R.level.max) ?? lerp(0.38, 0.62, u[5]);
  if (name === 'posterise') {
    const cs = paletteColours(P).map((c) => c.hex).sort(byLum);
    const want = Math.round(num(p['photo.levels'], R.levels.min, R.levels.max) ?? R.levels.min + Math.floor(u[6] * 3));
    const n = Math.max(POSTERISE_MIN, Math.min(want, cs.length));
    out.levels = n;
    // the darkest and the lightest always, the rest spread evenly between them by luminance
    out.colours = Array.from({ length: n }, (_, i) => cs[Math.round((i * (cs.length - 1)) / (n - 1))]);
  }
  if (name === 'dither') out.dot = num(p['photo.dot'], R.dot.min, R.dot.max) ?? lerp(1.5, 5, u[7]);
  return out;
}

/** The item fields a treatment writes: params (sizes in scene px: `k` = canvas width / 1080) and colours t0, t1, .... */
export function treatFields(t: Treat, k: number): { params: Record<string, number | string | boolean>; colours: Record<string, string> } {
  const params: Record<string, number | string | boolean> = { treat: t.name };
  if (t.duo) params.duo = t.duo;
  if (t.contrast !== undefined) params.contrast = t.contrast;
  if (t.screen !== undefined || t.dot !== undefined) params.k = k;
  if (t.screen !== undefined) params.screen = t.screen * k;
  if (t.angle !== undefined) params.angle = t.angle;
  if (t.inv !== undefined) params.inv = t.inv;
  if (t.level !== undefined) params.level = t.level;
  if (t.levels !== undefined) params.levels = t.levels;
  if (t.dot !== undefined) params.dot = t.dot * k;
  return { params, colours: Object.fromEntries(t.colours.map((c, i) => ['t' + i, c])) };
}

/** A photo item's treatment colours, t0 first. */
export const treatColours = (g: { colours: Record<string, string> }): string[] => {
  const out: string[] = [];
  for (let i = 0; 't' + i in g.colours; i++) out.push(g.colours['t' + i]);
  return out;
};

/** Whether a treatment draws only palette colours (and blends of them): every one but colour and monochrome. */
export const paletteTreat = (name: unknown) => isTreatment(name) && name !== 'colour' && name !== 'mono';

/**
 * Every colour a treated photo can show anywhere (the item's `fills`, spec 5 for text not measured): a photo's
 * anything for colour and monochrome; the duotone's two ends and three steps between; the colours of the others.
 */
export function treatFills(name: unknown, cols: string[]): string[] {
  if (!paletteTreat(name) || cols.length < 2) return [...PHOTO_ANY];
  if (name === 'duotone') return [cols[0], mixHex(cols[0], cols[1], 0.25), mixHex(cols[0], cols[1], 0.5), mixHex(cols[0], cols[1], 0.75), cols[1]];
  return [...cols];
}

const lum8 = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
/**
 * How far a measured tone may sit from the pixels drawn (the grid is read from a smaller copy): threshold and
 * posterise jump, so their bands are widened by it; mono and duotone ranges are widened by it too, before the
 * mapping, so mono's contrast stretches the slack with the tones (review R15 M6).
 */
export const TONE_SLACK = 0.06;

/**
 * What a treatment makes of the photo where its pixels run from `lo` to `hi` (the darkest and lightest the grid read
 * there): the darkest and lightest colour it draws there. Two-colour screens (halftone, dither) show both their
 * colours anywhere. Pure.
 */
export function treatedRange(g: Pick<GraphicItem, 'params' | 'colours'>, lo: string, hi: string): { lo: string; hi: string } {
  const name = g.params.treat, cols = treatColours(g);
  const tl = lum8(...parseHex(lo)), th = lum8(...parseHex(hi));
  const sl = Math.max(0, tl - TONE_SLACK), sh = Math.min(1, th + TONE_SLACK);
  if (name === 'mono') {
    const k = Number(g.params.contrast) || 1, grey = (t: number) => { const v = Math.max(0, Math.min(1, (t - 0.5) * k + 0.5)) * 255; return toHex([v, v, v]); };
    return { lo: grey(sl), hi: grey(sh) };
  }
  if (!paletteTreat(name) || cols.length < 2) return { lo, hi };
  const sorted = (a: string, b: string) => (luminance(a) <= luminance(b) ? { lo: a, hi: b } : { lo: b, hi: a });
  if (name === 'duotone') return sorted(mixHex(cols[0], cols[1], sl), mixHex(cols[0], cols[1], sh));
  if (name === 'halftone' || name === 'dither') return sorted(cols[0], cols[cols.length - 1]);
  const band = (t: number) => {
    if (name === 'threshold') return t >= Number(g.params.level) ? 1 : 0;
    return Math.max(0, Math.min(cols.length - 1, Math.floor(t * cols.length)));
  };
  const b0 = band(sl), b1 = band(sh);
  const seen = cols.slice(Math.min(b0, b1), Math.max(b0, b1) + 1);
  let a = seen[0], z = seen[0];
  for (const c of seen) { if (luminance(c) < luminance(a)) a = c; if (luminance(c) > luminance(z)) z = c; }
  return { lo: a, hi: z };
}

/** The 8 x 8 Bayer matrix, thresholds in (0, 1). */
const BAYER = (() => {
  const m = [[0, 2], [3, 1]];
  let M = m;
  while (M.length < 8) {
    const n = M.length, N: number[][] = Array.from({ length: n * 2 }, () => new Array(n * 2).fill(0));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 4 * M[y][x];
      N[y][x] = v; N[y][x + n] = v + 2; N[y + n][x] = v + 3; N[y + n][x + n] = v + 1;
    }
    M = N;
  }
  return M.map((row) => row.map((v) => (v + 0.5) / 64));
})();

/**
 * Apply a treatment to RGBA pixels w x h in place (spec 8.9). `params` and `cols` as layout recorded them; `s` the
 * device pixels per scene px (halftone screen and dither size are in scene px). Deterministic: no randomness, the
 * screens anchored at the pixels' origin. Pure apart from writing `d`.
 */
/**
 * A window onto the box (R16, big renders): the pixels `d` are the box's pixels from (ox, oy) on, in box px (device
 * px from the box's origin); the screens stay anchored at the box's origin, so a strip of the box treats exactly as
 * the same rows of the whole. Halftone reads a cell's tone at its centre, kept inside [x0, x1) x [y0, y1) (the box
 * as far as it is drawn); a window must hold every centre it reads (a screen's width more than the rows it shows).
 */
/** Rows a window of a treatment must read beyond the rows it shows (halftone: a cell's centre), and the block a
 *  window's first row must sit on (dither), in device px at `s` per scene px. */
export function treatReach(params: Record<string, unknown>, s: number): { margin: number; align: number } {
  if (params.treat === 'halftone') return { margin: Math.ceil(Math.max(2, Number(params.screen) * s)) + 2, align: 1 };
  if (params.treat === 'dither') return { margin: 0, align: Math.max(1, Math.round(Number(params.dot) * s)) };
  return { margin: 0, align: 1 };
}

export interface TreatWindow { ox: number; oy: number; x0: number; y0: number; x1: number; y1: number; }

export function treatPixels(d: Uint8ClampedArray, w: number, h: number, params: Record<string, unknown>, cols: string[], s = 1, win?: TreatWindow): void {
  const W0 = win ?? { ox: 0, oy: 0, x0: 0, y0: 0, x1: w, y1: h };
  const name = params.treat;
  if (!isTreatment(name) || name === 'colour') return;
  const C = cols.map(parseHex);
  const n = w * h;
  if (name === 'mono') {
    const k = Number(params.contrast) || 1;
    for (let i = 0; i < n * 4; i += 4) {
      const v = Math.max(0, Math.min(1, (lum8(d[i], d[i + 1], d[i + 2]) - 0.5) * k + 0.5)) * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return;
  }
  if (C.length < 2) return;
  const put = (i: number, c: number[]) => { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; };
  const [A, B] = [C[0], C[C.length - 1]];
  if (name === 'duotone') {
    for (let i = 0; i < n * 4; i += 4) {
      const t = lum8(d[i], d[i + 1], d[i + 2]);
      d[i] = A[0] + (B[0] - A[0]) * t; d[i + 1] = A[1] + (B[1] - A[1]) * t; d[i + 2] = A[2] + (B[2] - A[2]) * t;
    }
    return;
  }
  if (name === 'threshold') {
    const lv = Number(params.level);
    for (let i = 0; i < n * 4; i += 4) put(i, lum8(d[i], d[i + 1], d[i + 2]) >= lv ? B : A);
    return;
  }
  if (name === 'posterise') {
    const m = C.length;
    for (let i = 0; i < n * 4; i += 4) put(i, C[Math.max(0, Math.min(m - 1, Math.floor(lum8(d[i], d[i + 1], d[i + 2]) * m)))]);
    return;
  }
  if (name === 'dither') {
    // blocks anchored at the box's origin; each block takes the tone of its first pixel in the window (a window
    // starts on a block's edge, ditherAlign)
    const D = Math.max(1, Math.round(Number(params.dot) * s)), ox = W0.ox, oy = W0.oy;
    for (let by = Math.floor(oy / D) * D; by < oy + h; by += D) for (let bx = Math.floor(ox / D) * D; bx < ox + w; bx += D) {
      const ry = Math.max(by, oy) - oy, rx = Math.max(bx, ox) - ox, i0 = (ry * w + rx) * 4, t = lum8(d[i0], d[i0 + 1], d[i0 + 2]);
      const c = t > BAYER[(by / D) & 7][(bx / D) & 7] ? B : A;
      for (let y = ry; y < Math.min(h, by + D - oy); y++) for (let x = rx; x < Math.min(w, bx + D - ox); x++) put((y * w + x) * 4, c);
    }
    return;
  }
  // halftone: a dot per screen cell, sized by the tone at the cell's centre (read before anything is written)
  const S = Math.max(2, Number(params.screen) * s), a = (Number(params.angle) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const inv = !!params.inv, bg = inv ? A : B, dot = inv ? B : A;
  const src = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) src[i] = lum8(d[j], d[j + 1], d[j + 2]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const bxp = x + W0.ox, byp = y + W0.oy;
    const u = (bxp * ca + byp * sa) / S, v = (-bxp * sa + byp * ca) / S;
    const fu = Math.floor(u) + 0.5, fv = Math.floor(v) + 0.5;
    // the cell's centre back in box pixels, kept inside the box as drawn, then read in the window
    const cx = Math.max(W0.x0, Math.min(W0.x1 - 1, Math.round((fu * ca - fv * sa) * S))), cy = Math.max(W0.y0, Math.min(W0.y1 - 1, Math.round((fu * sa + fv * ca) * S)));
    const wx = Math.max(0, Math.min(w - 1, cx - W0.ox)), wy = Math.max(0, Math.min(h - 1, cy - W0.oy));
    const t = src[wy * w + wx], cov = inv ? t : 1 - t;
    const r = S * 0.74 * Math.sqrt(cov), dist = Math.hypot(u - fu, v - fv) * S;
    const k = Math.max(0, Math.min(1, r - dist + 0.5)), i = (y * w + x) * 4;
    d[i] = bg[0] + (dot[0] - bg[0]) * k; d[i + 1] = bg[1] + (dot[1] - bg[1]) * k; d[i + 2] = bg[2] + (dot[2] - bg[2]) * k;
  }
}
