/** A wire sphere (Vaporwave, spec 8.4): latitude and longitude lines on a disc in the box. Colour: line. */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const sphere: Graphic = {
  name: 'sphere',
  params: {
    lat: { min: 3, max: 18, def: 8, int: true },        // latitude lines
    lon: { min: 3, max: 20, def: 10, int: true },       // meridians across the front half
    tilt: { min: -0.6, max: 0.6, def: 0.25 },           // radians the axis leans
    weight: { min: 0.0015, max: 0.008, def: 0.003 },    // share of the canvas width
  },
  draw(ctx, g, _r, T) {
    const G = sphere, R = g.box, W = Number(g.params.W) || R.w;
    const nLat = val(g, G, 'lat'), nLon = val(g, G, 'lon'), tilt = val(g, G, 'tilt');
    // centre and radius from the item where it sets them (a sphere clipped by the horizon), else the box's own disc
    const has = g.params.r !== undefined;
    const cx = has ? Number(g.params.x) : R.x + R.w / 2, cy = has ? Number(g.params.y) : R.y + R.h / 2;
    const r = (has ? Number(g.params.r) : (Math.min(R.w, R.h) / 2) * 0.97) * T.rev(0);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
    ctx.strokeStyle = g.colours.line; ctx.lineWidth = Math.max(1.5, W * val(g, G, 'weight'));
    ctx.shadowColor = g.colours.line; ctx.shadowBlur = W * 0.008;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    for (let i = 1; i < nLat; i++) {
      const y = -r + (2 * r * i) / nLat, rx = Math.sqrt(Math.max(0, r * r - y * y));
      ctx.moveTo(rx, y); ctx.ellipse(0, y, rx, rx * 0.18, 0, 0, TAU);
    }
    const spin = T.on ? T.ph : 0;
    for (let i = 0; i < nLon; i++) {
      const a = ((i + 0.5) / nLon + spin) % 1, rx = Math.abs(Math.cos(a * Math.PI)) * r;
      ctx.moveTo(0, -r); ctx.ellipse(0, 0, rx, r, 0, -Math.PI / 2, Math.PI / 2, a > 0.5);
    }
    ctx.stroke(); ctx.restore();
  },
};
