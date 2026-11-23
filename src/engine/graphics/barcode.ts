/** Barcode stripes (Brutalist leftover space). Colour: ink. Defaults are the spike's look. */
import { val } from './params';
import type { Graphic } from './types';

export const barcode: Graphic = {
  name: 'barcode',
  params: {
    unit: { min: 0.003, max: 0.014, def: 0.006 },   // share of the canvas width
    wide: { min: 1, max: 9, def: 5, int: true },    // widest bar, in units
    gap: { min: 1, max: 5, def: 3, int: true },     // widest gap, in units
  },
  draw(ctx, g, r, T) {
    const G = barcode, { x: X, y, w: iw, h } = g.box, W = Number(g.params.W);
    const unit = val(g, G, 'unit'), wide = val(g, G, 'wide'), gap = val(g, G, 'gap');
    ctx.fillStyle = g.colours.ink;
    let x = X;
    while (x < X + iw) {
      const w = (1 + Math.floor(r() * wide)) * W * unit;
      ctx.fillRect(x, y, Math.min(w, X + iw - x), h * T.rev(2));
      x += w + (1 + Math.floor(r() * gap)) * W * unit;
    }
  },
};
