/**
 * One huge figure used as a shape (Swiss, spec 8.1): a numeral built from strokes and arcs, no font. Colour: a.
 * The figure and its stroke stay inside the box (review R5 S3, as the disc, review bundle 1 S2): never cut flat
 * by the box's own edge.
 */
import { TAU } from './clock';
import { val } from './params';
import type { Rect } from '../geom';
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

/** The figures' ink extents on the 6 x 10 grid (strokes' centre lines): x 0.3 to 5.7, y 0.4 to 9.6. */
const X0 = 0.3, X1 = 5.7, Y0 = 0.4, Y1 = 9.6;
/**
 * Where the figures sit in a box (still): grid unit u, stroke width lw, one origin per figure and the ink rect of
 * them all. Pure, so a test can prove the stroked figures stay inside: the largest figure whose stroked extents fit
 * is scaled by `scale` (at most 1). A box much wider than a figure takes up to three figures in a row, a box much
 * taller up to three in a column, so one small figure is not left in a wide or tall field (review R5 S2).
 */
export function numeralGeom(R: Rect, p: { weight: number; scale: number; x: number }) {
  const sc = Math.min(1, p.scale), wt = p.weight * 10, fw1 = X1 - X0 + wt, fh1 = Y1 - Y0 + wt, gap = 1.2;
  // how many figures: as many as fill the box's long side at full height (or width), at most three
  const across = Math.max(1, Math.min(3, Math.floor((R.w / R.h) * (fh1 / fw1)))), down = across > 1 ? 1 : Math.max(1, Math.min(3, Math.floor((R.h / R.w) * (fw1 / fh1))));
  const u = Math.min(R.h / (down * fh1 + (down - 1) * gap), R.w / (across * fw1 + (across - 1) * gap)) * sc, lw = u * wt;
  const iw = (across * fw1 + (across - 1) * gap) * u, ih = (down * fh1 + (down - 1) * gap) * u;
  const x0 = R.x + (R.w - iw) * p.x, y0 = R.y + (R.h - ih) / 2;
  const at: [number, number][] = [];
  for (let j = 0; j < down; j++) for (let i = 0; i < across; i++) at.push([x0 + i * (fw1 + gap) * u + lw / 2 - X0 * u, y0 + j * (fh1 + gap) * u + lw / 2 - Y0 * u]);
  return { u, lw, at, ox: at[0][0], oy: at[0][1], ink: { x: x0, y: y0, w: iw, h: ih } };
}

export const numeral: Graphic = {
  name: 'numeral',
  params: {
    digit: { min: 0, max: 9, def: 1, int: true },
    weight: { min: 0.06, max: 0.22, def: 0.16 },   // stroke, share of the figure's height
    scale: { min: 0.8, max: 1, def: 0.9 },          // figure size, share of the largest that fits the box
    x: { min: 0, max: 1, def: 0.5 },               // where it sits across the box
  },
  draw(ctx, g, _r, T) {
    const G = numeral, R = g.box, C = g.colours;
    const wt = val(g, G, 'weight');
    const { u, lw, at } = numeralGeom(R, { weight: wt, scale: val(g, G, 'scale'), x: val(g, G, 'x') });
    ctx.save();
    ctx.strokeStyle = C.a; ctx.lineWidth = lw * T.rev(0); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    ctx.beginPath();
    // the figures after the first count on from it: a 2 is followed by 3, then 4 (a date, an edition)
    at.forEach(([ox, oy], k) => {
      for (const s of FIG[(val(g, G, 'digit') + k) % 10]) {
        if (s[0] === 'l') { ctx.moveTo(ox + s[1] * u, oy + s[2] * u); ctx.lineTo(ox + s[3] * u, oy + s[4] * u); }
        else if (s[0] === 'a') { const a0 = s[4] * TAU, a1 = s[5] * TAU; ctx.moveTo(ox + (s[1] + s[3] * Math.cos(a0)) * u, oy + (s[2] + s[3] * Math.sin(a0)) * u); ctx.arc(ox + s[1] * u, oy + s[2] * u, s[3] * u, a0, a1); }
        else { ctx.moveTo(ox + (s[1] + s[3]) * u, oy + s[2] * u); ctx.ellipse(ox + s[1] * u, oy + s[2] * u, s[3] * u, s[4] * u, 0, 0, TAU); }
      }
    });
    ctx.stroke();
    ctx.restore();
  },
};
