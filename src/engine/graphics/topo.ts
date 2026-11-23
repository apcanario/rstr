/** Contour lines over a field of hills (Swiss): from hairlines to thick bands. Colours: ink (lines), a (index lines). */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const topo: Graphic = {
  name: 'topo',
  params: {
    levels: { min: 5, max: 40, def: 16, int: true },
    weight: { min: 0.4, max: 12, def: 1, log: true },     // x the hairline
    hills: { min: 2, max: 9, def: 5, int: true },
    scale: { min: 0.08, max: 0.5, def: 0.27, log: true },  // hill radius, share of the box width
    every: { min: 2, max: 6, def: 4, int: true },          // every n-th line is an index line
  },
  draw(ctx, g, r, T) {
    const G = topo, R = g.box, C = g.colours, W = Number(g.params.W);
    const levels = val(g, G, 'levels'), wt = val(g, G, 'weight'), n = val(g, G, 'hills'), sc = val(g, G, 'scale'), every = val(g, G, 'every');
    const hills: { x: number; y: number; s: number; a: number; p: number }[] = [];
    for (let i = 0; i < n; i++) hills.push({ x: r(), y: r(), s: sc * (0.6 + r() * 0.8), a: (r() < 0.25 ? -1 : 1) * (0.5 + r()), p: r() * TAU });
    const step = W / 135, nx = Math.ceil(R.w / step) + 1, ny = Math.ceil(R.h / step) + 1, asp = R.h / R.w;
    const f = new Float32Array(nx * ny);
    let lo = 1e9, hi = -1e9;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const u = i / (nx - 1), v = (j / (ny - 1)) * asp;
      let z = 0;
      for (const h of hills) {
        const hx = h.x + 0.05 * Math.cos(TAU * T.ph + h.p), hy = (h.y + 0.05 * Math.sin(TAU * T.ph + h.p)) * asp;
        z += h.a * Math.exp(-((u - hx) * (u - hx) + (v - hy) * (v - hy)) / (h.s * h.s));
      }
      f[j * nx + i] = z; if (z < lo) lo = z; if (z > hi) hi = z;
    }
    ctx.lineCap = 'round';
    for (let k = 1; k < levels; k++) {
      const L = lo + (hi - lo) * k / levels, index = k % every === 0;
      ctx.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = f[j * nx + i], b = f[j * nx + i + 1], c = f[(j + 1) * nx + i + 1], d = f[(j + 1) * nx + i];
        const m = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (m === 0 || m === 15) continue;
        const x0 = R.x + i * step, y0 = R.y + j * step;
        const top = [x0 + step * (L - a) / (b - a), y0], rgt = [x0 + step, y0 + step * (L - b) / (c - b)];
        const bot = [x0 + step * (L - d) / (c - d), y0 + step], lft = [x0, y0 + step * (L - a) / (d - a)];
        const seg = (p: number[], q: number[]) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (m) {
          case 1: case 14: seg(lft, bot); break;
          case 2: case 13: seg(bot, rgt); break;
          case 3: case 12: seg(lft, rgt); break;
          case 4: case 11: seg(top, rgt); break;
          case 6: case 9: seg(top, bot); break;
          case 7: case 8: seg(lft, top); break;
          case 5: seg(lft, top); seg(bot, rgt); break;
          case 10: seg(lft, bot); seg(top, rgt); break;
        }
      }
      ctx.strokeStyle = index ? C.a : C.ink;
      ctx.lineWidth = W * (index ? 0.0046 : 0.0019) * wt;
      ctx.stroke();
    }
  },
};
