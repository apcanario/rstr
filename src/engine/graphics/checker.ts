/** A checker floor in perspective (Vaporwave, spec 8.4): the box's top edge is the horizon. Colours: a, b. */
import { val } from './params';
import type { Graphic } from './types';

export const checker: Graphic = {
  name: 'checker',
  params: {
    cols: { min: 3, max: 16, def: 8, int: true },     // squares each side of the centre at the near edge
    rows: { min: 3, max: 24, def: 10, int: true },
    curve: { min: 1.2, max: 3.5, def: 2 },            // how the rows crowd toward the horizon
    spread: { min: 0.05, max: 1, def: 0.12 },         // width at the horizon, share of the width at the near edge
  },
  draw(ctx, g, _r, T) {
    const G = checker, R = g.box, C = g.colours;
    const n = val(g, G, 'cols'), rows = val(g, G, 'rows'), curve = val(g, G, 'curve'), far = val(g, G, 'spread');
    const cx = R.x + R.w / 2, near = R.w * 0.75, off = T.on ? (T.ph * 4) % 1 : 0;
    const at = (z: number) => R.y + R.h * Math.pow(Math.max(0, z), curve);
    const half = (z: number) => near * (far + (1 - far) * Math.pow(Math.max(0, z), curve));
    ctx.fillStyle = C.b; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.fillStyle = C.a;
    for (let k = -1; k < rows; k++) {
      const z0 = (k + off) / rows, z1 = (k + 1 + off) / rows;
      const y0 = at(z0), y1 = at(z1), h0 = half(z0), h1 = half(z1);
      for (let i = -n - 2; i < n + 2; i++) {
        if ((i + k + 1000) % 2) continue;
        ctx.beginPath();
        ctx.moveTo(cx + (i / n) * h0, y0); ctx.lineTo(cx + ((i + 1) / n) * h0, y0);
        ctx.lineTo(cx + ((i + 1) / n) * h1, y1); ctx.lineTo(cx + (i / n) * h1, y1);
        ctx.closePath(); ctx.fill();
      }
    }
  },
};
