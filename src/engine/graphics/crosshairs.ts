/**
 * Registration crosshairs on the grid (Swiss): from one huge cross to a field of small marks. Colours: a (cross),
 * ink (ring). A mark is never a speck (review R5 S7): its arm is at least half a module (or half the box's short
 * side, if that is less), and there are never more marks than the box has inner grid crossings.
 */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

/** How many marks a box takes, their arm length and its grid: pure, so a test can prove no mark is a speck. */
export function crossGeom(R: { w: number; h: number }, mod: number, count: number, size: number) {
  const cols = Math.max(1, Math.round(R.w / mod)), rows = Math.max(1, Math.round(R.h / mod)), m = Math.min(R.w, R.h);
  const n = Math.max(1, Math.min(count, Math.max(1, cols - 1) * Math.max(1, rows - 1)));
  const L = Math.max((m * size) / Math.sqrt(n), Math.min(mod * 0.5, m * 0.5));
  return { n, L, cols, rows };
}

export const crosshairs: Graphic = {
  name: 'crosshairs',
  params: {
    count: { min: 1, max: 16, def: 3, int: true },
    size: { min: 0.45, max: 0.9, def: 0.5, log: true },       // arm length, share of the box's short side
    weight: { min: 0.002, max: 0.035, def: 0.008, log: true },// share of the canvas width
    ring: { min: 0, max: 1, def: 1, int: true },              // a ring round each cross
  },
  draw(ctx, g, r, T) {
    const G = crosshairs, R = g.box, C = g.colours, W = Number(g.params.W), mod = Number(g.params.mod) || R.w / 6;
    const { n, L, cols, rows } = crossGeom(R, mod, val(g, G, 'count'), val(g, G, 'size'));
    const lw = Math.max(1, W * val(g, G, 'weight')), ring = val(g, G, 'ring');
    for (let i = 0; i < n; i++) {
      // on grid lines, so the marks register with the columns
      // a box one module across has no inner grid line: the mark goes on its centre line, never on its edge
      const at = (k: number, u: number) => (n === 1 || k < 2 ? 0.5 : (1 + Math.floor(u * (k - 1))) / k);
      const x = R.x + at(cols, r()) * R.w, y = R.y + at(rows, r()) * R.h;
      const e = L * T.rev(i * 0.15);
      ctx.fillStyle = C.a;
      ctx.fillRect(x - e, y - lw / 2, 2 * e, lw);
      ctx.fillRect(x - lw / 2, y - e, lw, 2 * e);
      // the ring stays whole inside the box; the arms may run to its edge
      const rr = Math.min(e * 0.62, x - R.x - lw, R.x + R.w - x - lw, y - R.y - lw, R.y + R.h - y - lw);
      if (ring && rr > lw) { ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke(); }
    }
  },
};
