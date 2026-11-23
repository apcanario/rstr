/** Postmodern graphics (ice cream): five to eight shapes on a jittered lattice, each with a hard ink shadow. */
import { GRAPHICS } from '../../graphics';
import { chooseParams } from '../../graphics/params';
import { SHAPE_NAMES, SHAPES } from '../../graphics/shape';
import { mkGraphic } from '../../items';
import { shuffle } from '../../rng';
import type { GraphicsPart } from '../types';

export const pomoGraphics: GraphicsPart = {
  id: 'pomo', uses: ['shape'], vocab: SHAPE_NAMES, motifs: [],
  place(c) {
    const { W, H, spec, P, story, rg } = c;
    const d = W * 0.013;
    const A = { ink: P.ink, ground: P.ground, accent: P.accent, accent2: P.accent2 ?? P.accent, accent3: P.accent3 ?? P.ground };
    const pr = chooseParams(GRAPHICS.shape, spec.params);
    // an Advanced scale or spin moves the shape's reach; without one the extent is the spike's
    const reach = 0.55 * (pr.scale ?? 1) * (pr.spin ? 1.2 : 1), dd = d * (pr.shadow ?? 1);
    const gx = 3, gy = story ? 5 : spec.format === '3:4' ? 4 : 3;
    const cells: [number, number][] = [];
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) cells.push([i, j]);
    shuffle(rg, cells);
    const count = Math.min(cells.length, story ? 8 : 6);
    return cells.slice(0, count).map((cell, k) => {
      const cw = W / gx, ch = H / gy, s = Math.min(cw, ch) * (0.7 + rg() * 0.55);
      const x = (cell[0] + 0.5 + (rg() - 0.5) * 0.5) * cw, y = (cell[1] + 0.5 + (rg() - 0.5) * 0.5) * ch;
      const rot = (rg() - 0.5) * 1.4;
      const name = SHAPE_NAMES[(Math.floor(rg() * SHAPE_NAMES.length) + k) % SHAPE_NAMES.length];
      const params = SHAPES[name].choose(rg, A);
      const g = mkGraphic('shape', { x: 0, y: 0, w: W, h: H }, spec.seeds.graphic, 0, A, Object.values(A), { ...params, shape: name, s, d, k, ...pr },
        { xf: { x, y, rot }, extent: { x: -s * reach, y: -s * reach, w: s * reach * 2 + dd, h: s * reach * 2 + dd } });
      g.layer = 'front';
      g.tag = name;
      return g;
    });
  },
};
