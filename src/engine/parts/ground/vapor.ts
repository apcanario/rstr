/**
 * Vaporwave ground: with a horizon, the gradient sky down to it and the floor below; without one, a field. The
 * windows layout's field is the sky gradient over the whole canvas (all its text sits on windows); the tunnel, the
 * huge sun and the orb stand on the floor colour, where ink always reads.
 */
import { mkRect } from '../../items';
import type { Linear } from '../../scene';
import type { GroundPart } from '../types';

export const vaporGround: GroundPart = {
  id: 'vapor', uses: [],
  ground(c, plan) {
    const { P, W, H } = c, sky = P.gradient ?? [P.ground, P.ground];
    const stops = sky.map((col, i): [number, string] => [i / (sky.length - 1), col]);
    if (plan.boxes.sky) {
      const hz = plan.horizon;
      const skyPaint: Linear = { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: hz, stops };
      return [mkRect({ x: 0, y: 0, w: W, h: hz }, skyPaint), mkRect({ x: 0, y: hz, w: W, h: H - hz }, P.ground)];
    }
    if (plan.frame === 'windows') return [mkRect({ x: 0, y: 0, w: W, h: H }, { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: H, stops })];
    return [mkRect({ x: 0, y: 0, w: W, h: H }, P.ground)];
  },
};
