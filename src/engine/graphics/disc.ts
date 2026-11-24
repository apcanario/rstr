/**
 * One big disc with a satellite (Swiss). Colours: a (disc), ink (satellite). The disc and its satellite stay
 * inside the box (review bundle 1 S2): the radius is at most half the short side less the satellite, and the
 * centre is clamped so nothing is cut flat by the box's own edge. A box that bleeds past the canvas lets the
 * disc bleed there, at the canvas edge only.
 */
import { TAU } from './clock';
import { val } from './params';
import type { Rect } from '../geom';
import type { Graphic } from './types';

/** Where the disc and its satellite sit in a box (still): pure, so a test can prove both stay inside. */
export function discGeom(R: Rect, p: { radius: number; cx: number; cy: number; sat: number; satAngle: number }) {
  const m = Math.min(R.w, R.h), r2 = m * p.sat, outer = m * p.radius;   // disc plus satellite
  const rad = Math.max(outer * 0.55, outer - r2);
  const cx = R.x + outer + (R.w - 2 * outer) * p.cx, cy = R.y + outer + (R.h - 2 * outer) * p.cy;
  const a2 = p.satAngle * TAU, s2 = Math.min(r2, outer - rad * 0.98);
  return { cx, cy, rad, sx: cx + Math.cos(a2) * rad * 0.98, sy: cy + Math.sin(a2) * rad * 0.98, sr: s2 };
}

export const disc: Graphic = {
  name: 'disc',
  params: {
    radius: { min: 0.4, max: 0.5, def: 0.42 },    // share of the box's short side, satellite included
    cx: { min: 0, max: 1, def: 0.5 },             // where the centre sits in the room it has
    cy: { min: 0, max: 1, def: 0.55 },
    sat: { min: 0, max: 0.14, def: 0.1 },         // satellite radius, share of the short side
    satAngle: { min: 0, max: 1, def: 0.6 },       // turns
  },
  draw(ctx, g, _r, T) {
    const G = disc, R = g.box, C = g.colours;
    const m = Math.min(R.w, R.h), k = (n: string) => val(g, G, n);
    const { cx, cy, rad, sr } = discGeom(R, { radius: k('radius'), cx: k('cx'), cy: k('cy'), sat: k('sat'), satAngle: k('satAngle') });
    ctx.fillStyle = C.a; ctx.beginPath(); ctx.arc(cx + m * 0.02 * Math.cos(TAU * T.ph) * (T.on ? 1 : 0), cy, rad * T.rev(0), 0, TAU); ctx.fill();
    const a2 = k('satAngle') * TAU + TAU * T.ph * (T.on ? 1 : 0), s2 = sr * T.rev(1.5);
    if (s2 < 1) return;
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * rad * 0.98, cy + Math.sin(a2) * rad * 0.98, s2, 0, TAU); ctx.fill();
  },
};
