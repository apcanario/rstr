/** Brutalist leftover graphics: one blunt thing in the space the type leaves. */
import { TAU } from './clock';
import type { Draw } from './types';

export const barcode: Draw = (ctx, g, r, T) => {
  const { x: X, y, w: iw, h } = g.box, W = Number(g.params.W);
  ctx.fillStyle = g.colours.ink;
  let x = X;
  while (x < X + iw) {
    const w = (1 + Math.floor(r() * 5)) * W * 0.006;
    ctx.fillRect(x, y, Math.min(w, X + iw - x), h * T.rev(2));
    x += w + (1 + Math.floor(r() * 3)) * W * 0.006;
  }
};
export const slab: Draw = (ctx, g, _r, T) => {
  const { x, y, w: iw, h } = g.box;
  ctx.fillStyle = g.colours.accent; ctx.fillRect(x, y, iw * T.rev(2), h);
  ctx.fillStyle = g.colours.ink;
  const d = Math.min(h * 0.8, iw * 0.3);
  ctx.beginPath(); ctx.arc(x + iw - d * 0.75, y + h / 2, d / 2, 0, TAU); ctx.fill();
};
export const asterisks: Draw = (ctx, g, _r, T) => {
  const { x: X, y, w: iw, h } = g.box;
  ctx.fillStyle = g.colours.ink;
  const n = Math.max(3, Math.round(iw / (h * 1.2)));
  for (let i = 0; i < n; i++) {
    const cx = X + iw * (i + 0.5) / n, cy = y + h / 2, r = Math.min(h, iw / n) * 0.42 * T.rev(2);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(TAU * T.ph * (T.on ? 1 : 0));
    for (let a = 0; a < 3; a++) { ctx.rotate(Math.PI / 3); ctx.fillRect(-r, -r * 0.16, r * 2, r * 0.32); }
    ctx.restore();
  }
};
