/** Concentric rings in a weight progression (Swiss): from hairline target to a few thick bands. Colours: a, ink (every n-th ring). */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const rings: Graphic = {
  name: 'rings',
  params: {
    count: { min: 2, max: 40, def: 10, int: true, log: true },
    weight: { min: 0.2, max: 0.9, def: 0.4 },      // the heaviest ring, share of the pitch
    cx: { min: 0, max: 1, def: 0.5 },
    cy: { min: 0, max: 1, def: 0.5 },
    prog: { min: 0, max: 1, def: 0.6 },           // 0 all alike, 1 from hairline to the heaviest
    inkEvery: { min: 0, max: 6, def: 0, int: true },
  },
  draw(ctx, g, _r, T) {
    const G = rings, C = g.colours;
    // floor (not a ranged parameter; Vaporwave, R9 M1): the rings flattened toward the box's top by this factor, a ground plane
    const fl = Number(g.params.floor) > 0 ? Number(g.params.floor) : 1, R = fl < 1 ? { ...g.box, h: g.box.h / fl } : g.box;
    if (fl < 1) { ctx.save(); ctx.translate(0, R.y); ctx.scale(1, fl); ctx.translate(0, -R.y); }
    const n = val(g, G, 'count'), wt = val(g, G, 'weight'), prog = val(g, G, 'prog'), every = val(g, G, 'inkEvery');
    const cx = R.x + R.w * val(g, G, 'cx'), cy = R.y + R.h * val(g, G, 'cy');
    const far = Math.max(Math.hypot(cx - R.x, cy - R.y), Math.hypot(cx - R.x - R.w, cy - R.y), Math.hypot(cx - R.x, cy - R.y - R.h), Math.hypot(cx - R.x - R.w, cy - R.y - R.h));
    const pitch = far / n;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n, lw = Math.max(1, pitch * wt * (1 - prog + prog * k)), rad = (i + 0.5) * pitch * T.rev(0);
      ctx.strokeStyle = every && i % every === every - 1 ? C.ink : C.a; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
    }
    if (fl < 1) ctx.restore();
  },
};
