/** Contrast maths (WCAG 2 relative luminance). */
function chan(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) throw new Error('bad colour ' + hex);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function toHex([r, g, b]: [number, number, number]): string {
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return ('#' + f(r) + f(g) + f(b)).toUpperCase();
}
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Linear mix in sRGB: k = 0 gives a, k = 1 gives b. */
export function mixHex(a: string, b: string, k: number): string {
  const A = parseHex(a), B = parseHex(b);
  return toHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
}
/** a mixed toward b until it is `ratio`:1 against a (b itself where b is under that already). */
export function fadeTo(a: string, b: string, ratio: number): string {
  let lo = 0, hi = 1;
  if (contrast(b, a) < ratio) return b;
  for (let i = 0; i < 24; i++) { const k = (lo + hi) / 2; if (contrast(mixHex(a, b, k), a) >= ratio) hi = k; else lo = k; }
  return mixHex(a, b, hi);
}
/**
 * A colour a style mixes from two palette colours (Carried R10 from R10, review R12 S1): `k`, the share of b
 * (`mixHex`); or `fade`, b faded toward a until it is that ratio against a (`fadeTo`).
 */
export interface Mix { a: string; b: string; k?: number; fade?: number; }
/** The colour a recipe makes, from its two colours as `f` maps them (an edit). */
export const mixOf = (m: Mix, f: (c: string) => string = (c) => c): string =>
  m.fade !== undefined ? fadeTo(f(m.a), f(m.b), m.fade) : mixHex(f(m.a), f(m.b), m.k ?? 0);
/** Size at and above which 3:1 is enough (spec 5), in px at 1080 wide. */
export const LARGE_TEXT_PX = 60;
export const needRatio = (px: number) => (px >= LARGE_TEXT_PX ? 3 : 4.5);
/** The candidate with the best contrast against every background colour. */
export function bestInk(cands: string[], bgs: string[]): string {
  let best = cands[0], score = -1;
  for (const c of cands) {
    const s = Math.min(...bgs.map((b) => contrast(c, b)));
    if (s > score + 1e-9) { score = s; best = c; }
  }
  return best;
}
/** The first candidate that reaches the ratio against every background, else the best one. */
export function firstInk(cands: string[], bgs: string[], ratio: number): string {
  for (const c of cands) if (bgs.every((b) => contrast(c, b) >= ratio)) return c;
  return bestInk(cands, bgs);
}
