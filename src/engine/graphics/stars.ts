/** Sparkle stars in the sky (Vaporwave). Colours: ink, ground (for the alpha). Defaults are the spike's look. */
import { luminance } from '../colour';
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const stars: Graphic = {
  name: 'stars',
  params: {
    count: { min: 10, max: 140, def: 46, int: true },
    size: { min: 0.4, max: 2.5, def: 1, log: true },
    spread: { min: 0.3, max: 0.9, def: 0.7 },   // how far down the sky, share of the horizon height
  },
  draw(ctx, g, r, T) {
    const G = stars, W = Number(g.params.W), hz = Number(g.params.hz);
    const n = val(g, G, 'count'), k = val(g, G, 'size'), spread = val(g, G, 'spread');
    ctx.fillStyle = g.colours.ink;
    ctx.globalAlpha = luminance(g.colours.ground) < 0.2 ? 0.85 : 0.5;
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * hz * spread;
      const s = W * (0.0015 + r() * 0.003) * k * (T.on ? 0.6 + 0.4 * Math.sin(TAU * T.ph * 2 + i) : 1);
      ctx.fillRect(x - s * 3, y - s / 2, s * 6, s); ctx.fillRect(x - s / 2, y - s * 3, s, s * 6);
    }
    ctx.globalAlpha = 1;
  },
};
