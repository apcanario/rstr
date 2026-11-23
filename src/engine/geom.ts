export type Pt = [number, number];
export type Quad = Pt[];
export interface Rect { x: number; y: number; w: number; h: number; }
/** Local -> world: rotate by rot (radians) about the origin, then translate by (x, y). */
export interface Xf { x: number; y: number; rot: number; }

export const rectQuad = (r: Rect): Quad => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
export function apply(xf: Xf | undefined, p: Pt): Pt {
  if (!xf) return p;
  const c = Math.cos(xf.rot), s = Math.sin(xf.rot);
  return [xf.x + p[0] * c - p[1] * s, xf.y + p[0] * s + p[1] * c];
}
/** a after b: local -> b -> a. Both rigid, so the result is rigid. */
export function compose(a: Xf | undefined, b: Xf | undefined): Xf | undefined {
  if (!a) return b;
  if (!b) return a;
  const [x, y] = apply(a, [b.x, b.y]);
  return { x, y, rot: a.rot + b.rot };
}
/** World -> local for a rigid transform. */
export function unapply(xf: Xf, p: Pt): Pt {
  const c = Math.cos(xf.rot), s = Math.sin(xf.rot), dx = p[0] - xf.x, dy = p[1] - xf.y;
  return [dx * c + dy * s, -dx * s + dy * c];
}
export const xfQuad = (xf: Xf | undefined, q: Quad): Quad => q.map((p) => apply(xf, p));
export const pad = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
export function bounds(q: Quad): Rect {
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
export function union(rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  const X = Math.max(...rs.map((r) => r.x + r.w)), Y = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: X - x, h: Y - y };
}

function axes(q: Quad): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length];
    out.push([-(b[1] - a[1]), b[0] - a[0]]);
  }
  return out;
}
function proj(q: Quad, ax: Pt): [number, number] {
  const len = Math.hypot(ax[0], ax[1]) || 1;
  let lo = Infinity, hi = -Infinity;
  for (const p of q) { const v = (p[0] * ax[0] + p[1] * ax[1]) / len; if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}
/** Convex polygons overlap by more than tol px (separating axis test). Touching is not overlap. */
export function overlaps(a: Quad, b: Quad, tol = 0.5): boolean {
  for (const ax of [...axes(a), ...axes(b)]) {
    const [a0, a1] = proj(a, ax), [b0, b1] = proj(b, ax);
    if (a1 - tol <= b0 || b1 - tol <= a0) return false;
  }
  return true;
}
/** Every point of inner lies inside the convex polygon outer (tolerance tol px). */
export function contains(outer: Quad, inner: Quad, tol = 0.5): boolean {
  for (const ax of axes(outer)) {
    const [o0, o1] = proj(outer, ax), [i0, i1] = proj(inner, ax);
    if (i0 < o0 - tol || i1 > o1 + tol) return false;
  }
  return true;
}
