/** How much of its box a graphic covers with ink (row R5, moved out of proof.ts for the marks layer, review bundle 3 M1). */
import type { GraphicItem } from './scene';
import { GRAPHICS } from './graphics';
import { FILLS, blockCells } from './graphics/blocks';
import { crossGeom } from './graphics/crosshairs';
import { discGeom } from './graphics/disc';
import { numeralGeom } from './graphics/numeral';

/**
 * How much of its box a graphic reads as covering, 0 to 1, from its name and parameters (review R5 S2): a rough
 * ink density, not a measurement. A plate (a cut-in, a reversed graphic) covers its box; a solid shape covers its
 * own area, generously; a field of marks covers by its ink share, times four (a pattern at a quarter ink reads as a
 * full tone), so hairline lattices and rings, pinstripes, low-count rules and a few small crosses count for little.
 * A graphic not named here (the other styles') counts as covering its box.
 */
export function coverOf(g: GraphicItem): number {
  if (g.plate) return 1;
  const G = GRAPHICS[g.name];
  if (!G) return 1;
  const p = (k: string) => (typeof g.params[k] === 'number' ? (g.params[k] as number) : G.params[k].def);
  const R = g.box, A = Math.max(1, R.w * R.h), m = Math.max(1, Math.min(R.w, R.h));
  const W = Number(g.params.W) || 1080, mod = Number(g.params.mod) || R.w / 6;
  const tone = (share: number) => Math.min(1, 4 * Math.max(0, share));
  switch (g.name) {
    case 'disc': { const d = discGeom(R, { radius: p('radius'), cx: p('cx'), cy: p('cy'), sat: p('sat'), satAngle: p('satAngle') }); return Math.min(1, (2 * Math.PI * d.rad * d.rad) / A); }
    case 'numeral': { const { ink } = numeralGeom(R, { weight: p('weight'), scale: p('scale'), x: p('x') }); return Math.min(1, (1.5 * ink.w * ink.h) / A); }
    case 'blocks': {
      const cells = blockCells(R, { sx: p('sx'), sy: p('sy'), side: p('side') }, mod), f = FILLS[p('fill')] ?? FILLS[2];
      const big = cells.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0], rad = Math.min(big.w, big.h) * p('disc');
      const filled = cells.reduce((s, c, i) => s + (f[i] ? c.w * c.h : 0), 0) + (f[cells.indexOf(big)] ? 0 : Math.PI * rad * rad);
      return Math.min(1, filled / A);
    }
    case 'crosshairs': { const { n, L } = crossGeom(R, mod, p('count'), p('size')); return Math.min(1, (n * 0.7 * 4 * L * L) / A); }
    case 'lattice': { const cw = R.w / p('cols'), lw = Math.max(1, W * p('weight')); return Math.min(1, p('filled') + tone((2 * lw) / cw)); }
    case 'rules': { const th = Math.max(1, W * p('weight')); return tone(Math.min(1, th / (R.h / p('count'))) * (1 - p('stagger') / 2)); }
    case 'lines': case 'bars': case 'rings': return tone(p('weight') * (1 - p('prog') / 2));
    case 'waves': return tone(p('weight'));
    // Postmodern's found graphics (R6): solid ones by their ink, marks by a little
    case 'torn': return p('cover');
    case 'redact': return Math.min(1, (p('count') * W * p('height') * R.w * p('length') * 0.75) / A);
    case 'scribble': return tone(p('weight') * 6);
    case 'tape': return Math.min(1, (p('count') * W * p('length') * W * p('width')) / A);
    case 'xmarks': case 'register': return 0.1;
    case 'dots': return tone(0.785 / (1 + 2 * p('falloff')));
    case 'topo': return tone((p('levels') * W * 0.0019 * p('weight') * 3) / m);
    default: return 1;
  }
}
