/** The perspective grid floor with a glow (Vaporwave). Colour: line. Defaults are the spike's look. */
import { val } from './params';
import type { Graphic } from './types';

export const grid: Graphic = {
  name: 'grid',
  params: {
    rays: { min: 4, max: 24, def: 14, int: true },   // rays each side of the centre
    rows: { min: 4, max: 30, def: 14, int: true },
    curve: { min: 1.2, max: 3.5, def: 2.2 },         // how the rows crowd toward the horizon
  },
  draw(ctx, g, _r, T) {
    const G = grid, C = g.colours, W = g.box.w, hz = g.box.y, H = g.box.y + g.box.h;
    const rays = val(g, G, 'rays'), rows = val(g, G, 'rows'), curve = val(g, G, 'curve');
    ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(2, W * 0.003); ctx.shadowColor = C.line; ctx.shadowBlur = W * 0.012;
    ctx.beginPath();
    for (let i = -rays; i <= rays; i++) { ctx.moveTo(W / 2 + i * W * 0.035 * 14 / rays, hz); ctx.lineTo(W / 2 + i * W * 0.42 * 14 / rays, H); }
    const off = T.on ? (T.ph * 6) % 1 : 0;
    for (let k = 0; k < rows; k++) { const z = (k + off) / rows, yy = hz + (H - hz) * Math.pow(z, curve); ctx.moveTo(0, yy); ctx.lineTo(W, yy); }
    ctx.stroke();
    ctx.shadowBlur = 0;
  },
};
