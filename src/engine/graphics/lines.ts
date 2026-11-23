/** Parallel lines in a weight progression (Swiss, spec 8.1): from pinstripe to slab. Colours: a, ink (every n-th line). */
import { val } from './params';
import type { Graphic } from './types';

export const lines: Graphic = {
  name: 'lines',
  params: {
    count: { min: 3, max: 48, def: 12, int: true, log: true },
    weight: { min: 0.04, max: 0.95, def: 0.6 },       // the heaviest line, share of the pitch
    prog: { min: 0, max: 1, def: 0.7 },               // 0 all alike, 1 from hairline to the heaviest
    vertical: { min: 0, max: 1, def: 0, int: true },
    inkEvery: { min: 0, max: 6, def: 5, int: true },  // 0: no ink line
  },
  draw(ctx, g, r, T) {
    const G = lines, R = g.box, C = g.colours;
    const n = val(g, G, 'count'), wt = val(g, G, 'weight'), prog = val(g, G, 'prog'), vert = val(g, G, 'vertical'), every = val(g, G, 'inkEvery');
    const grow = r() < 0.6, pitch = (vert ? R.w : R.h) / n;
    for (let i = 0; i < n; i++) {
      const k = grow ? (i + 1) / n : 1 - i / n, th = Math.max(1, pitch * wt * (1 - prog + prog * k)) * T.rev(i * 0.1);
      ctx.fillStyle = every && i % every === every - 1 ? C.ink : C.a;
      if (vert) ctx.fillRect(R.x + i * pitch, R.y, th, R.h); else ctx.fillRect(R.x, R.y + i * pitch, R.w, th);
    }
  },
};
