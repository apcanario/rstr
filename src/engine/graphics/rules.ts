/** Rules on the grid rhythm (Swiss): rows of rules of stepped lengths, from hairlines to heavy bars. Colours: a, ink (every n-th rule). */
import { val } from './params';
import type { Graphic } from './types';

export const rules: Graphic = {
  name: 'rules',
  params: {
    count: { min: 3, max: 30, def: 9, int: true },
    weight: { min: 0.002, max: 0.07, def: 0.012, log: true },  // share of the canvas width
    stagger: { min: 0, max: 1, def: 0.6 },                    // 0 every rule full length, 1 lengths from one column to all
    right: { min: 0, max: 1, def: 0, int: true },             // rules hang from the right edge
    inkEvery: { min: 0, max: 6, def: 3, int: true },          // 0: no ink rule
  },
  draw(ctx, g, r, T) {
    const G = rules, R = g.box, C = g.colours, W = Number(g.params.W), mod = Number(g.params.mod) || R.w / 6;
    const n = val(g, G, 'count'), th = Math.max(1, W * val(g, G, 'weight')), st = val(g, G, 'stagger'), right = val(g, G, 'right'), every = val(g, G, 'inkEvery');
    const pitch = R.h / n, cols = Math.max(1, Math.round(R.w / mod));
    for (let i = 0; i < n; i++) {
      const k = 1 - st * Math.floor(r() * cols) / cols, w = R.w * k * T.rev(i * 0.08), h = Math.min(th, pitch * 0.92);
      ctx.fillStyle = every && i % every === every - 1 ? C.ink : C.a;
      ctx.fillRect(right ? R.x + R.w - w : R.x, R.y + i * pitch + (pitch - h) / 2, w, h);
    }
  },
};
