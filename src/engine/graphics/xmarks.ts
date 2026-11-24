/** X marks (Postmodern photocopy, found graphic): a few hard crosses. Colour: a. */
import { val } from './params';
import type { Graphic } from './types';

export const xmarks: Graphic = {
  name: 'xmarks',
  params: {
    count: { min: 1, max: 9, def: 4, int: true },
    size: { min: 0.015, max: 0.09, def: 0.04, log: true },   // half the arm, share of the canvas width
    weight: { min: 0.12, max: 0.45, def: 0.28 },             // stroke, share of the size
  },
  draw(ctx, g, r, T) {
    const G = xmarks, R = g.box, W = Number(g.params.W), n = val(g, G, 'count'), wt = val(g, G, 'weight');
    ctx.strokeStyle = g.colours.a; ctx.lineCap = 'butt';
    for (let i = 0; i < n; i++) {
      const x = R.x + r() * R.w, y = R.y + r() * R.h, q = W * val(g, G, 'size') * (0.6 + r() * 0.8) * T.rev(i * 0.2);
      ctx.lineWidth = Math.max(1, q * wt);
      ctx.beginPath(); ctx.moveTo(x - q, y - q); ctx.lineTo(x + q, y + q); ctx.moveTo(x + q, y - q); ctx.lineTo(x - q, y + q); ctx.stroke();
    }
  },
};
