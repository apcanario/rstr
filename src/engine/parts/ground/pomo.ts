/** Postmodern ground: a faint pattern over the ground colour, the first thing on the graphic stream. */
import { mixHex } from '../../colour';
import { GRAPHICS } from '../../graphics';
import { chooseParams } from '../../graphics/params';
import { patternDraws } from '../../graphics/pattern';
import { mkGraphic } from '../../items';
import type { GroundPart } from '../types';

export const pomoGround: GroundPart = {
  id: 'pomo', uses: ['pattern'],
  ground(c) {
    const { P, W, H, spec, rg } = c, G = GRAPHICS.pattern;
    let kind = Math.floor(rg() * 3);
    const set = spec.params['g.pattern.kind'];
    if (typeof set === 'number' && [0, 1, 2].includes(set)) kind = set;
    const pr = chooseParams(G, spec.params);
    const g = mkGraphic('pattern', { x: 0, y: 0, w: W, h: H }, spec.seeds.graphic, 1, { ink: P.ink }, [mixHex(P.ground, P.ink, pr.alpha ?? G.params.alpha.def)], { kind, ...pr });
    g.layer = 'ground';
    for (let i = 0; i < patternDraws(kind, pr.count ?? G.params.count.def); i++) rg();
    return [g];
  },
};
