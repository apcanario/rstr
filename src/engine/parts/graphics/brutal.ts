/** Brutalist graphics: one blunt graphic in the band layout left over. */
import { GRAPHICS } from '../../graphics';
import { chooseParams } from '../../graphics/params';
import { mkGraphic } from '../../items';
import { rng } from '../../rng';
import type { GraphicsPart } from '../types';

const BLUNT = ['barcode', 'slab', 'asterisks'];

export const brutalGraphics: GraphicsPart = {
  id: 'brutal', uses: BLUNT, vocab: BLUNT, motifs: BLUNT,
  place(c, plan) {
    const { spec, P, W } = c, band = plan.boxes.band;
    if (!band) return [];
    const mi = BLUNT.indexOf(spec.pick.motif ?? '');
    const kind = mi >= 0 ? mi : Math.floor(rng(spec.seeds.graphic)() * 3);
    const g = mkGraphic(BLUNT[kind], band, spec.seeds.graphic, 1, { ink: P.ink, accent: P.accent }, kind === 1 ? [P.accent, P.ink] : [P.ink], { W, ...chooseParams(GRAPHICS[BLUNT[kind]], spec.params) });
    g.layer = 'back';
    return [g];
  },
};
