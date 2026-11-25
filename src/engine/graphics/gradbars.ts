/** Horizontal gradient bars (Vaporwave, spec 8.4): stacked bars that thin out toward one end, each a two-stop gradient. Colours: a, b. */
import { val } from './params';
import type { Graphic } from './types';

export const gradbars: Graphic = {
  name: 'gradbars',
  params: {
    count: { min: 3, max: 18, def: 8, int: true },
    weight: { min: 0.2, max: 0.9, def: 0.6 },       // the heaviest bar, share of the pitch
    prog: { min: 0, max: 1, def: 0.7 },             // 0 all alike, 1 from hairline to the heaviest
    angle: { min: 0, max: 1, def: 0, int: true },   // 0 across, 1 down
  },
  draw(ctx, g, r, T) {
    const G = gradbars, R = g.box, C = g.colours;
    const n = val(g, G, 'count'), wt = val(g, G, 'weight'), prog = val(g, G, 'prog'), down = val(g, G, 'angle');
    // grow (not a ranged parameter): 0 thickest first (top or left), 1 thinnest first; unset, the item's stream decides
    const rolled = r() < 0.5, grow = typeof g.params.grow === 'number' ? g.params.grow === 1 : rolled;
    const span = down ? R.w : R.h, pitch = span / n;
    const grad = down ? ctx.createLinearGradient(0, R.y, 0, R.y + R.h) : ctx.createLinearGradient(R.x, 0, R.x + R.w, 0);
    grad.addColorStop(0, C.a); grad.addColorStop(1, C.b);
    ctx.fillStyle = grad;
    for (let i = 0; i < n; i++) {
      const k = grow ? (i + 1) / n : (n - i) / n, th = Math.max(1, pitch * wt * (1 - prog + prog * k)) * T.rev(i * 0.1);
      if (down) ctx.fillRect(R.x + i * pitch, R.y, th, R.h); else ctx.fillRect(R.x, R.y + i * pitch, R.w, th);
    }
  },
};
