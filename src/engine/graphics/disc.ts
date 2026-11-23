/** One big disc with a satellite (Swiss). Colours: a (disc), ink (satellite). */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const disc: Graphic = {
  name: 'disc',
  params: {
    radius: { min: 0.2, max: 0.72, def: 0.55 },   // share of the box's short side
    cx: { min: 0.25, max: 0.75, def: 0.5 },
    cy: { min: 0.3, max: 0.8, def: 0.55 },
    sat: { min: 0, max: 0.14, def: 0.1 },         // satellite radius, share of the short side
    satAngle: { min: 0, max: 1, def: 0.6 },       // turns
  },
  draw(ctx, g, _r, T) {
    const G = disc, R = g.box, C = g.colours;
    const m = Math.min(R.w, R.h), cx = R.x + R.w * val(g, G, 'cx'), cy = R.y + R.h * val(g, G, 'cy');
    const rad = m * val(g, G, 'radius') * T.rev(0);
    ctx.fillStyle = C.a; ctx.beginPath(); ctx.arc(cx + m * 0.02 * Math.cos(TAU * T.ph) * (T.on ? 1 : 0), cy, rad, 0, TAU); ctx.fill();
    const a2 = val(g, G, 'satAngle') * TAU + TAU * T.ph * (T.on ? 1 : 0), r2 = m * val(g, G, 'sat') * T.rev(1.5);
    if (r2 < 1) return;
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * rad * 0.98, cy + Math.sin(a2) * rad * 0.98, r2, 0, TAU); ctx.fill();
  },
};
