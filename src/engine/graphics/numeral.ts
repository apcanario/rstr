/** One huge figure used as a shape (Swiss, spec 8.1): a numeral built from strokes and arcs, no font. Colour: a. */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

type Seg = ['l', number, number, number, number] | ['a', number, number, number, number, number] | ['e', number, number, number, number];
/** The ten figures on a 6 x 10 grid: l x0 y0 x1 y1 (a line), a cx cy r t0 t1 (an arc, turns), e cx cy rx ry (an ellipse). */
const FIG: Seg[][] = [
  [['e', 3, 5, 2.6, 4.6]],
  [['l', 3.6, 0.4, 3.6, 9.6], ['l', 3.6, 0.4, 1.2, 2.4]],
  [['a', 3, 2.9, 2.5, 0.5, 1.07], ['l', 5.3, 4.1, 0.6, 9.6], ['l', 0.6, 9.6, 5.6, 9.6]],
  [['a', 3, 2.6, 2.2, 0.42, 1.25], ['a', 3, 7.1, 2.5, 0.75, 1.42]],
  [['l', 4.2, 9.6, 4.2, 0.4], ['l', 4.2, 0.4, 0.5, 6.8], ['l', 0.5, 6.8, 5.7, 6.8]],
  [['l', 5.2, 0.4, 1.2, 0.4], ['l', 1.2, 0.4, 0.9, 4.6], ['a', 3, 6.6, 2.7, 0.6, 1.45]],
  [['e', 3, 6.9, 2.6, 2.7], ['l', 4.8, 0.4, 0.5, 6.6]],
  [['l', 0.4, 0.4, 5.6, 0.4], ['l', 5.6, 0.4, 2, 9.6]],
  [['e', 3, 2.6, 2.2, 2.2], ['e', 3, 7.2, 2.6, 2.4]],
  [['e', 3, 3.1, 2.6, 2.7], ['l', 5.5, 3.4, 1.2, 9.6]],
];

export const numeral: Graphic = {
  name: 'numeral',
  params: {
    digit: { min: 0, max: 9, def: 1, int: true },
    weight: { min: 0.06, max: 0.32, def: 0.16 },   // stroke, share of the figure's height
    scale: { min: 0.55, max: 1.3, def: 0.9 },      // figure height, share of the box height (over 1 bleeds)
    x: { min: 0, max: 1, def: 0.5 },               // where it sits across the box
  },
  draw(ctx, g, _r, T) {
    const G = numeral, R = g.box, C = g.colours;
    const d = FIG[val(g, G, 'digit')], wt = val(g, G, 'weight');
    const h = Math.min(R.h * val(g, G, 'scale'), R.w * 1.5), u = h / 10, lw = h * wt;
    const fw = 6 * u, ox = R.x + lw / 2 + (R.w - fw - lw) * val(g, G, 'x'), oy = R.y + (R.h - h) / 2;
    ctx.save();
    ctx.strokeStyle = C.a; ctx.lineWidth = lw * T.rev(0); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    ctx.beginPath();
    for (const s of d) {
      if (s[0] === 'l') { ctx.moveTo(ox + s[1] * u, oy + s[2] * u); ctx.lineTo(ox + s[3] * u, oy + s[4] * u); }
      else if (s[0] === 'a') { const a0 = s[4] * TAU, a1 = s[5] * TAU; ctx.moveTo(ox + (s[1] + s[3] * Math.cos(a0)) * u, oy + (s[2] + s[3] * Math.sin(a0)) * u); ctx.arc(ox + s[1] * u, oy + s[2] * u, s[3] * u, a0, a1); }
      else { ctx.moveTo(ox + (s[1] + s[3]) * u, oy + s[2] * u); ctx.ellipse(ox + s[1] * u, oy + s[2] * u, s[3] * u, s[4] * u, 0, 0, TAU); }
    }
    ctx.stroke();
    ctx.restore();
  },
};
