/** The glowing horizon line (Vaporwave). Colour: accent. Defaults are the spike's look. */
import { val } from './params';
import type { Graphic } from './types';
import { scaleOf } from '../view';

export const horizon: Graphic = {
  name: 'horizon',
  params: {
    weight: { min: 0.001, max: 0.012, def: 0.004 },   // share of the canvas width
    glow: { min: 0, max: 0.06, def: 0.02 },
    alpha: { min: 0.3, max: 1, def: 1 },
  },
  draw(ctx, g, _r, _T) {
    const G = horizon, W = Number(g.params.W), hz = Number(g.params.hz), wt = val(g, G, 'weight');
    ctx.globalAlpha = val(g, G, 'alpha');
    ctx.fillStyle = g.colours.accent; ctx.shadowColor = g.colours.accent; ctx.shadowBlur = (W * val(g, G, 'glow')) * scaleOf(ctx);
    ctx.fillRect(0, hz - (W * wt) / 2, W, W * wt); ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },
};
