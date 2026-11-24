/** A grid split into three blocks with a disc in the largest (Swiss). Colours: a, ink, bg (the disc on an a block). */
import type { Rect } from '../geom';
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

const P = {
  sx: { min: 0.1, max: 0.9, def: 0.4 },      // where the column split falls
  sy: { min: 0.1, max: 0.9, def: 0.5 },      // where the row split falls
  disc: { min: 0.15, max: 0.48, def: 0.3 },  // disc radius, share of the largest block's short side
  side: { min: 0, max: 1, def: 0, int: true },
  fill: { min: 0, max: 11, def: 2, int: true }, // which cells are filled, and with what (FILLS)
};

/**
 * Which colour fills each of the three cells (a, ink, or none), by the `fill` parameter, so a look can be
 * pinned (review R13 S3). Pattern 2 is the first approved look: ink, accent, an empty cell with the disc.
 */
export const FILLS: ('a' | 'ink' | null)[][] = [
  ['a', 'ink', null], ['a', null, 'ink'], ['ink', 'a', null], [null, 'a', 'ink'], ['ink', null, 'a'], [null, 'ink', 'a'],
  ['a', null, null], [null, 'a', null], [null, null, 'a'], ['ink', null, null], ['a', 'ink', 'a'], [null, null, 'ink'],
];

/** The three cells of a blocks graphic, in draw order, from its box, parameters and grid unit. Pure, so a cut-in can sit inside one. */
export function blockCells(R: Rect, p: { sx: number; sy: number; side: number }, mod: number): Rect[] {
  const cols = Math.max(2, Math.round(R.w / mod)), rows = Math.max(2, Math.round(R.h / mod));
  const cw = R.w / cols, rh = R.h / rows;
  const vc = Math.max(1, Math.min(cols - 1, Math.round(p.sx * cols))), hr = Math.max(1, Math.min(rows - 1, Math.round(p.sy * rows)));
  const cells = p.side
    ? [[0, 0, vc, rows], [vc, 0, cols - vc, hr], [vc, hr, cols - vc, rows - hr]]
    : [[0, 0, vc, hr], [0, hr, vc, rows - hr], [vc, 0, cols - vc, rows]];
  return cells.map((c) => ({ x: R.x + c[0] * cw, y: R.y + c[1] * rh, w: c[2] * cw, h: c[3] * rh }));
}

export const blocks: Graphic = {
  name: 'blocks',
  params: P,
  draw(ctx, g, _r, T) {
    const G = blocks, C = g.colours, mod = Number(g.params.mod);
    const cells = blockCells(g.box, { sx: val(g, G, 'sx'), sy: val(g, G, 'sy'), side: val(g, G, 'side') }, mod);
    const fills = FILLS[val(g, G, 'fill')].map((k) => (k ? C[k] : null));
    cells.forEach((c, i) => {
      const e = T.rev(i * 0.6), fill = fills[i];
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(c.x, c.y + c.h * (1 - e), c.w, c.h * e); }
    });
    const big = cells.slice().sort((p, q) => q.w * q.h - p.w * p.h)[0], bi = cells.indexOf(big);
    const rad = Math.min(big.w, big.h) * val(g, G, 'disc') * (1 + 0.13 * Math.sin(TAU * T.ph) * (T.on ? 1 : 0)) * T.rev(2);
    if (rad < 1) return;
    ctx.fillStyle = fills[bi] === C.a ? C.bg : fills[bi] ? C.a : C.ink;
    ctx.beginPath(); ctx.arc(big.x + big.w / 2, big.y + big.h / 2, rad, 0, TAU); ctx.fill();
  },
};
