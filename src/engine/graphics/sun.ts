/** The slit sun (Vaporwave). Colours: accent3, accent, sky1. Defaults are the spike's look. */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const sun: Graphic = {
  name: 'sun',
  params: {
    slits: { min: 0, max: 14, def: 8, int: true },
    gap: { min: 0.004, max: 0.02, def: 0.011 },     // how fast the slits widen, share of the radius
    start: { min: -0.3, max: 0.3, def: -0.05 },     // where the first slit sits, share of the radius from the centre
  },
  draw(ctx, g, _r, T) {
    const G = sun, C = g.colours, x = Number(g.params.x), sy = Number(g.params.y), R = Number(g.params.r);
    const n = val(g, G, 'slits'), gap = val(g, G, 'gap'), start = val(g, G, 'start');
    const y = sy + (1 - T.rev(0)) * R;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
    const grad = ctx.createLinearGradient(0, y - R, 0, y + R);
    grad.addColorStop(0, C.accent3); grad.addColorStop(0.55, C.accent); grad.addColorStop(1, C.sky1);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.rect(x - R, y - R, R * 2, R * 2.5);
    for (let i = 0; i < n; i++) {
      const yy = y + R * start + (i + (T.on ? (T.ph * 4) % 1 : 0)) * R * 0.145;
      ctx.rect(x - R, yy, R * 2, R * (0.012 + i * gap));
    }
    ctx.fill('evenodd');
  },
};
