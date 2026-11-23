/** A row of asterisks (Brutalist). Colour: ink. Defaults are the spike's look. */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const asterisks: Graphic = {
  name: 'asterisks',
  params: {
    density: { min: 0.3, max: 3, def: 1, log: true },
    arms: { min: 2, max: 6, def: 3, int: true },
    weight: { min: 0.06, max: 0.4, def: 0.16 },   // arm half-thickness, share of the radius
  },
  draw(ctx, g, _r, T) {
    const G = asterisks, { x: X, y, w: iw, h } = g.box;
    const arms = val(g, G, 'arms'), wt = val(g, G, 'weight');
    ctx.fillStyle = g.colours.ink;
    const n = Math.max(3, Math.round(iw / (h * 1.2) * val(g, G, 'density')));
    for (let i = 0; i < n; i++) {
      const cx = X + iw * (i + 0.5) / n, cy = y + h / 2, r = Math.min(h, iw / n) * 0.42 * T.rev(2);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(TAU * T.ph * (T.on ? 1 : 0));
      for (let a = 0; a < arms; a++) { ctx.rotate(Math.PI / arms); ctx.fillRect(-r, -r * wt, r * 2, r * wt * 2); }
      ctx.restore();
    }
  },
};
