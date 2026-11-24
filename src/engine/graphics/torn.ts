/** A torn sheet (Postmodern photocopy, found graphic): a block of colour with one ragged edge. Colour: a. */
import { val } from './params';
import type { Graphic } from './types';

export const torn: Graphic = {
  name: 'torn',
  params: {
    cover: { min: 0.25, max: 1, def: 0.6 },          // share of the box height the sheet takes
    teeth: { min: 8, max: 90, def: 34, int: true },
    depth: { min: 0.004, max: 0.05, def: 0.016, log: true },   // jag depth, share of the canvas width
  },
  draw(ctx, g, r, T) {
    const G = torn, R = g.box, W = Number(g.params.W), n = val(g, G, 'teeth'), dp = W * val(g, G, 'depth');
    const edge = R.y + R.h * val(g, G, 'cover') * T.rev(0.5);
    ctx.fillStyle = g.colours.a;
    ctx.beginPath(); ctx.moveTo(R.x, R.y); ctx.lineTo(R.x + R.w, R.y);
    for (let i = n; i >= 0; i--) ctx.lineTo(R.x + (R.w * i) / n, edge - dp + r() * dp * 2);
    ctx.closePath(); ctx.fill();
  },
};
