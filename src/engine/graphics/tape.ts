/** Strips of tape (Postmodern photocopy, found graphic): opaque, with ragged torn ends. Colour: a. */
import { val } from './params';
import type { Graphic } from './types';

export const tape: Graphic = {
  name: 'tape',
  params: {
    count: { min: 1, max: 5, def: 2, int: true },
    length: { min: 0.12, max: 0.5, def: 0.3 },      // share of the canvas width
    width: { min: 0.035, max: 0.11, def: 0.065 },   // share of the canvas width
    turn: { min: 0, max: 1.6, def: 0.8 },           // how far a strip may turn from level, radians
  },
  draw(ctx, g, r, T) {
    const G = tape, R = g.box, W = Number(g.params.W), n = val(g, G, 'count');
    const L = W * val(g, G, 'length') * T.rev(0.5), w = W * val(g, G, 'width'), turn = val(g, G, 'turn');
    ctx.fillStyle = g.colours.a;
    for (let i = 0; i < n; i++) {
      const x = R.x + r() * R.w, y = R.y + r() * R.h, a = (r() - 0.5) * 2 * turn;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-L / 2, -w / 2); ctx.lineTo(L / 2, -w / 2);
      const teeth = 5;
      for (let k = 1; k <= teeth; k++) ctx.lineTo(L / 2 + (k % 2 ? -1 : 0) * w * 0.12 * r(), -w / 2 + (w * k) / teeth);
      ctx.lineTo(-L / 2, w / 2);
      for (let k = teeth - 1; k >= 0; k--) ctx.lineTo(-L / 2 + (k % 2 ? 1 : 0) * w * 0.12 * r(), -w / 2 + (w * k) / teeth);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  },
};
