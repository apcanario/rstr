/**
 * The composition transforms of spec 8.0, shared by every layout part: the local page a layout fills and the
 * rigid transform that puts it on the canvas. The page always fits inside the world's text-safe area (the
 * canvas, or in 9:16 the band between the story zones), so text inside the page is legal for rule 1.
 */
import { bounds, rectQuad, unapply, type Rect, type Xf } from '../geom';
import type { Transform } from './types';

export interface Frame { page: Rect; xf?: Xf; /** The canvas in local coordinates (its bounding box): how far a bleed must reach. */ canvas: Rect; }

export function frameFor(t: Transform, deg: number, W: number, H: number, story: boolean): Frame {
  const S = { x: 0, y: story ? 260 : 0, w: W, h: story ? 1340 : H };
  if (t === 'none') return { page: { x: 0, y: 0, w: W, h: H }, canvas: { x: 0, y: 0, w: W, h: H } };
  let page: Rect, xf: Xf;
  if (t === 'quarter') {
    // drawn sideways, read from the edge: local x runs up the canvas from the bottom of the safe area
    page = { x: 0, y: 0, w: S.h, h: S.w };
    xf = { x: S.x, y: S.y + S.h, rot: -Math.PI / 2 };
  } else {
    const a = (deg * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const k = Math.min(S.w / (S.w * c + S.h * s), S.h / (S.w * s + S.h * c));
    const w = S.w * k, h = S.h * k, px = S.x + S.w / 2, py = S.y + S.h / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    page = { x: 0, y: 0, w, h };
    xf = { x: px - (w / 2) * ca + (h / 2) * sa, y: py - (w / 2) * sa - (h / 2) * ca, rot: a };
  }
  const canvas = bounds(rectQuad({ x: 0, y: 0, w: W, h: H }).map((p) => unapply(xf, p)));
  return { page, xf, canvas };
}

/** Grow a box's sides that touch the page edge out to the canvas (plus a little), so a bleed still bleeds when tilted or turned. */
export function bleed(b: Rect, page: Rect, canvas: Rect): Rect {
  const e = 2, out = { ...b };
  const L = b.x <= page.x + 1, R = b.x + b.w >= page.x + page.w - 1, T = b.y <= page.y + 1, B = b.y + b.h >= page.y + page.h - 1;
  if (L) { const x = Math.min(b.x, canvas.x - e); out.w += out.x - x; out.x = x; }
  if (R) out.w = Math.max(out.x + out.w, canvas.x + canvas.w + e) - out.x;
  if (T) { const y = Math.min(b.y, canvas.y - e); out.h += out.y - y; out.y = y; }
  if (B) out.h = Math.max(out.y + out.h, canvas.y + canvas.h + e) - out.y;
  return out;
}

