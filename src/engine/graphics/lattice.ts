/** The Swiss grid made visible (spec 8.1, 'grid'; named lattice because 'grid' is Vaporwave's floor): module lines with some cells filled. Colours: ink (lines), a (cells). */
import { val } from './params';
import type { Graphic } from './types';

export const lattice: Graphic = {
  name: 'lattice',
  params: {
    cols: { min: 2, max: 24, def: 6, int: true },
    weight: { min: 0.001, max: 0.03, def: 0.003, log: true },   // share of the canvas width
    filled: { min: 0, max: 0.5, def: 0.12 },                    // share of cells filled
    square: { min: 0, max: 1, def: 1, int: true },              // square cells, else as many rows as columns
  },
  draw(ctx, g, r, T) {
    const G = lattice, R = g.box, C = g.colours, W = Number(g.params.W);
    const cols = val(g, G, 'cols'), lw = Math.max(1, W * val(g, G, 'weight')), fill = val(g, G, 'filled');
    const cw = R.w / cols, rows = val(g, G, 'square') ? Math.max(1, Math.round(R.h / cw)) : cols, rh = R.h / rows;
    ctx.fillStyle = C.a;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (r() < fill) {
      const e = T.rev((i + j) * 0.05);
      ctx.fillRect(R.x + i * cw, R.y + j * rh + rh * (1 - e), cw, rh * e);
    }
    ctx.fillStyle = C.ink;
    const e = T.rev(0);
    for (let i = 0; i <= cols; i++) ctx.fillRect(R.x + i * cw - lw / 2, R.y, lw, R.h * e);
    for (let j = 0; j <= rows; j++) ctx.fillRect(R.x, R.y + j * rh - lw / 2, R.w * e, lw);
  },
};
