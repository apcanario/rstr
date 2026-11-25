/**
 * Postmodern ground (spec 8.2). Ice cream: a faint pattern over the ground colour (dots, grid, confetti, ruled lines
 * or hatching), the first thing on the graphic stream. Photocopy: the paper, and the copier pass over everything
 * once the type is set (spec 8.7: a pass that belongs to the surface is the ground's).
 */
import { bounds } from '../../geom';
import { GRAPHICS } from '../../graphics';
import { chooseParams } from '../../graphics/params';
import { PATTERN_KINDS, patternDraws, patternFill } from '../../graphics/pattern';
import { mkGraphic, mkRect } from '../../items';
import { mix } from '../../rng';
import type { GroundPart } from '../types';
import { libraryControls, paramChoice } from '../../controls';

const PATTERN_NAMES = ['Dots', 'Grid', 'Confetti', 'Lines', 'Hatch'];

export const pomoGround: GroundPart = {
  id: 'pomo', uses: ['pattern', 'copier'],
  // the ice cream pattern's kind and its parameters; the copier pass's (photocopy)
  controls: (q) => [
    ...(q.scene.items.some((i) => i.kind === 'graphic' && i.name === 'pattern') ? [paramChoice('g.pattern.kind', 'Pattern', [0, 1, 2, 3, 4], (v) => PATTERN_NAMES[Number(v)] ?? String(v))] : []),
    ...libraryControls(q, ['pattern', 'copier']),
  ],
  pickFor: (g) => (g === 'pattern' ? { dialect: 'icecream' } : g === 'copier' ? { dialect: 'photocopy' } : {}),
  ground(c, plan) {
    const { P, W, H, spec, rg } = c;
    if (plan.dialect === 'photocopy') {
      // the paper: a rect, so what is behind any text ends here
      return [mkRect({ x: -2, y: -2, w: W + 4, h: H + 4 }, P.paper ?? P.ground)];
    }
    const G = GRAPHICS.pattern;
    let kind = Math.floor(rg() * PATTERN_KINDS);
    const set = spec.params['g.pattern.kind'];
    if (typeof set === 'number' && Number.isInteger(set) && set >= 0 && set < PATTERN_KINDS) kind = set;
    const pr = chooseParams(G, spec.params);
    const g = mkGraphic('pattern', { x: 0, y: 0, w: W, h: H }, spec.seeds.graphic, 1, { ink: P.ink }, [patternFill(P.ground, P.ink, pr)], { kind, ...pr });
    g.layer = 'ground';
    for (let i = 0; i < patternDraws(kind, pr.count ?? G.params.count.def); i++) rg();
    return [g];
  },
  pass(c, plan, items) {
    if (plan.dialect !== 'photocopy') return [];
    const { W, H, spec } = c, G = GRAPHICS.copier;
    // the dark edges keep off every text item (review R6 S3): the free distance from each side to the text
    let kL = W, kR = W, kT = H;
    for (const it of items) {
      if (it.kind !== 'text') continue;
      const b = bounds(it.quad);
      kL = Math.min(kL, b.x); kR = Math.min(kR, W - (b.x + b.w)); kT = Math.min(kT, b.y);
    }
    
    // its own stream off the graphic seed: the pass never shifts what the graphics draw
    const g = mkGraphic('copier', { x: 0, y: 0, w: W, h: H }, mix(spec.seeds.graphic, 0xc0b1e5), 0, {}, [], { ...chooseParams(G, spec.params) });
    g.keep = { l: Math.max(0, kL) / W, r: Math.max(0, kR) / W, t: Math.max(0, kT) / H };
    g.layer = 'ground';
    g.pass = true;
    return [g];
  },
};
