/** A dot screen with a focus (Swiss): from a fine screen to a few huge discs. Colour: a. */
import { TAU, clamp } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const dots: Graphic = {
  name: 'dots',
  params: {
    pitch: { min: 0.012, max: 0.22, def: 0.04, log: true },   // share of the canvas width
    falloff: { min: 0.3, max: 3, def: 1.6, log: true },
    fx: { min: 0, max: 1, def: 0.5 },
    fy: { min: 0, max: 1, def: 0.5 },
    inv: { min: 0, max: 1, def: 0, int: true },
  },
  draw(ctx, g, _r, T) {
    const G = dots, R = g.box, C = g.colours, W = Number(g.params.W);
    const step = W * val(g, G, 'pitch'), fall = val(g, G, 'falloff'), inv = val(g, G, 'inv');
    const fx = R.x + R.w * (val(g, G, 'fx') + 0.12 * Math.cos(TAU * T.ph) * (T.on ? 1 : 0)), fy = R.y + R.h * (val(g, G, 'fy') + 0.12 * Math.sin(TAU * T.ph) * (T.on ? 1 : 0));
    const maxd = Math.hypot(R.w, R.h) * 0.75, e = T.rev(0);
    ctx.fillStyle = C.a;
    for (let y = R.y + step / 2; y < R.y + R.h + step / 2; y += step) for (let x = R.x + step / 2; x < R.x + R.w + step / 2; x += step) {
      let k = clamp(1 - Math.hypot(x - fx, y - fy) / maxd, 0, 1); if (inv) k = 1 - k;
      const rad = step * 0.5 * Math.pow(k, fall) * e;
      if (rad > 0.6) { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); }
    }
  },
};
