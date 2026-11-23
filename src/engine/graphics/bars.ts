/** Angled bars in a weight progression (Swiss). Colours: a, ink (every n-th bar). */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const bars: Graphic = {
  name: 'bars',
  params: {
    angle: { min: -75, max: 75, def: 45 },               // degrees
    count: { min: 3, max: 24, def: 8, int: true },
    weight: { min: 0.1, max: 0.95, def: 0.55 },          // the heaviest bar, share of the pitch
    prog: { min: 0, max: 1, def: 0.8 },                  // 0 all alike, 1 from hairline to the heaviest
    inkEvery: { min: 0, max: 6, def: 4, int: true },     // 0: no ink bar
  },
  draw(ctx, g, r, T) {
    const G = bars, R = g.box, C = g.colours;
    const n = val(g, G, 'count'), wt = val(g, G, 'weight'), prog = val(g, G, 'prog'), every = val(g, G, 'inkEvery');
    const ang = val(g, G, 'angle') * Math.PI / 180 + (T.on ? 0.03 * Math.sin(TAU * T.ph) : 0);
    const span = Math.hypot(R.w, R.h), pitch = span / n, grow = r() < 0.5;
    ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.rotate(ang);
    for (let i = 0; i < n; i++) {
      const k = grow ? (i + 1) / n : (n - i) / n, w = pitch * wt * (1 - prog + prog * k), e = T.rev(i * 0.35);
      ctx.fillStyle = every && i % every === every - 1 ? C.ink : C.a;
      ctx.fillRect(-span / 2 + i * pitch, -span, w, span * 2 * e);
    }
    ctx.restore();
  },
};
