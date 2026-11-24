/** A pen scribble (Postmodern photocopy, found graphic): a jagged random walk. Colour: a. */
import { val } from './params';
import type { Graphic } from './types';

export const scribble: Graphic = {
  name: 'scribble',
  params: {
    points: { min: 8, max: 60, def: 30, int: true },
    weight: { min: 0.002, max: 0.02, def: 0.007, log: true },   // share of the canvas width
    spread: { min: 0.12, max: 0.6, def: 0.3 },                  // step, share of the box
  },
  draw(ctx, g, r, T) {
    const G = scribble, R = g.box, W = Number(g.params.W), n = val(g, G, 'points'), sp = val(g, G, 'spread');
    ctx.strokeStyle = g.colours.a; ctx.lineWidth = Math.max(1, W * val(g, G, 'weight')); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let x = R.x + R.w * (0.3 + r() * 0.4), y = R.y + R.h * (0.3 + r() * 0.4);
    ctx.beginPath(); ctx.moveTo(x, y);
    const k = Math.max(1, Math.round(n * T.rev(1)));
    for (let i = 0; i < k; i++) {
      x = Math.max(R.x, Math.min(R.x + R.w, x + (r() - 0.5) * R.w * sp * 2));
      y = Math.max(R.y, Math.min(R.y + R.h, y + (r() - 0.5) * R.h * sp));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
};
