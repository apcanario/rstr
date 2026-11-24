/** Registration marks (Postmodern photocopy, found graphic): circles with a cross, as printers trim by. Colour: a. */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const register: Graphic = {
  name: 'register',
  params: {
    count: { min: 1, max: 4, def: 2, int: true },
    size: { min: 0.02, max: 0.08, def: 0.04, log: true },      // radius, share of the canvas width
    weight: { min: 0.0015, max: 0.009, def: 0.003, log: true }, // share of the canvas width
  },
  draw(ctx, g, r, T) {
    const G = register, R = g.box, W = Number(g.params.W), n = val(g, G, 'count'), s = W * val(g, G, 'size') * T.rev(0);
    ctx.strokeStyle = g.colours.a; ctx.lineWidth = Math.max(1, W * val(g, G, 'weight'));
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]], start = Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const [u, v] = corners[(start + i) % 4];
      const x = R.x + s * 1.6 + u * (R.w - s * 3.2), y = R.y + s * 1.6 + v * (R.h - s * 3.2);
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.moveTo(x - s * 1.5, y); ctx.lineTo(x + s * 1.5, y); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x, y + s * 1.5); ctx.stroke();
    }
  },
};
