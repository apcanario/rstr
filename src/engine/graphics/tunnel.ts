/** A grid tunnel (Vaporwave, spec 8.4): frames converging on the box's centre, joined by rays. Colour: line. */
import { val } from './params';
import type { Graphic } from './types';

export const tunnel: Graphic = {
  name: 'tunnel',
  params: {
    depth: { min: 4, max: 22, def: 10, int: true },   // frames
    rays: { min: 2, max: 12, def: 6, int: true },     // rays along each side
    curve: { min: 1.2, max: 3.5, def: 2.2 },          // how the frames crowd toward the centre
    hole: { min: 0.03, max: 0.25, def: 0.1 },         // the far end, share of the box
  },
  draw(ctx, g, _r, T) {
    const G = tunnel, R = g.box, W = Number(g.params.W) || R.w;
    const n = val(g, G, 'depth'), rays = val(g, G, 'rays'), curve = val(g, G, 'curve'), hole = val(g, G, 'hole');
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2, off = T.on ? (T.ph * 4) % 1 : 0;
    ctx.strokeStyle = g.colours.line; ctx.lineWidth = Math.max(2, W * 0.003); ctx.shadowColor = g.colours.line; ctx.shadowBlur = W * 0.012;
    ctx.beginPath();
    const fr = (z: number) => { const k = hole + (1 - hole) * Math.pow(z, curve); return { w: R.w * k / 2, h: R.h * k / 2 }; };
    for (let i = 0; i <= n; i++) { const f = fr(Math.min(1, (i + off) / n)); ctx.rect(cx - f.w, cy - f.h, 2 * f.w, 2 * f.h); }
    const far = fr(0), nearF = { w: R.w / 2, h: R.h / 2 };
    for (let i = 0; i <= rays; i++) {
      const u = -1 + (2 * i) / rays;
      for (const [sx, sy] of [[u, -1], [u, 1], [-1, u], [1, u]]) { ctx.moveTo(cx + sx * far.w, cy + sy * far.h); ctx.lineTo(cx + sx * nearF.w, cy + sy * nearF.h); }
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  },
};
