/** Parallel sine lines (Swiss): from a calm hairline swell to thick tight waves. Colours: a, ink (every n-th line). */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const waves: Graphic = {
  name: 'waves',
  params: {
    count: { min: 3, max: 40, def: 12, int: true, log: true },
    amp: { min: 0.005, max: 0.2, def: 0.04, log: true },    // share of the box height
    freq: { min: 0.5, max: 8, def: 2 },                     // cycles across the box
    weight: { min: 0.2, max: 0.9, def: 0.3 },               // share of the pitch
    shift: { min: 0, max: 1, def: 0.15 },                   // phase step from line to line, turns
    inkEvery: { min: 0, max: 6, def: 0, int: true },
  },
  draw(ctx, g, _r, T) {
    const G = waves, R = g.box, C = g.colours;
    const n = val(g, G, 'count'), amp = R.h * val(g, G, 'amp'), f = val(g, G, 'freq'), sh = val(g, G, 'shift'), every = val(g, G, 'inkEvery');
    const pitch = (R.h + 2 * amp) / n, lw = Math.max(1, pitch * val(g, G, 'weight')), steps = Math.max(24, Math.ceil(f * 32));
    ctx.lineWidth = lw * T.rev(0); ctx.lineJoin = 'round';
    for (let i = 0; i <= n; i++) {
      const y0 = R.y - amp + i * pitch, ph = i * sh * TAU + (T.on ? T.ph * TAU : 0);
      ctx.strokeStyle = every && i % every === every - 1 ? C.ink : C.a;
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) { const u = s / steps, x = R.x - lw + (R.w + 2 * lw) * u, y = y0 + amp * Math.sin(u * f * TAU + ph); if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
  },
};
