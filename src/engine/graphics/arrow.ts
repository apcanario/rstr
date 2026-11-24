/** Blunt arrows (Brutalist leftover space, spec 8.3): a row of thick arrows across the box. Colour: ink. */
import { val } from './params';
import type { Graphic } from './types';

export const arrow: Graphic = {
  name: 'arrow',
  params: {
    dir: { min: 0, max: 3, def: 0, int: true },        // right, left, up, down
    count: { min: 1, max: 5, def: 1, int: true },       // arrows in a row
    weight: { min: 0.18, max: 0.5, def: 0.34 },         // shaft thickness, share of the arrow's height
    head: { min: 0.25, max: 0.6, def: 0.4 },            // head length, share of the arrow's length
  },
  draw(ctx, g, _r, T) {
    const G = arrow, { x: X, y: Y, w: bw, h: bh } = g.box;
    const dir = val(g, G, 'dir'), n = val(g, G, 'count'), wt = val(g, G, 'weight'), hd = val(g, G, 'head');
    ctx.fillStyle = g.colours.ink;
    const across = dir < 2;   // arrows along x
    // n arrows side by side across the other axis, each in its own cell
    for (let i = 0; i < n; i++) {
      const cx = across ? X : X + (bw * i) / n, cy = across ? Y + (bh * i) / n : Y;
      const cw = across ? bw : bw / n, ch = across ? bh / n : bh;
      const L = (across ? cw : ch) * T.rev(2), A = (across ? ch : cw) * 0.9, sh = A * wt, hl = Math.min(L * hd, A * 1.2);
      if (L < 2 || A < 2) continue;
      ctx.save();
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.rotate([0, Math.PI, -Math.PI / 2, Math.PI / 2][dir]);
      const l = (across ? cw : ch) / 2, x0 = -l, x1 = -l + L;
      ctx.beginPath();
      ctx.moveTo(x0, -sh / 2); ctx.lineTo(x1 - hl, -sh / 2); ctx.lineTo(x1 - hl, -A / 2); ctx.lineTo(x1, 0);
      ctx.lineTo(x1 - hl, A / 2); ctx.lineTo(x1 - hl, sh / 2); ctx.lineTo(x0, sh / 2); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },
};
