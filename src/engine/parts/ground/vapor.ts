/** Vaporwave ground: the gradient sky down to the horizon and the floor below it. */
import { mkRect } from '../../items';
import type { Linear } from '../../scene';
import type { GroundPart } from '../types';

export const vaporGround: GroundPart = {
  id: 'vapor', uses: [],
  ground(c, plan) {
    const { P, W, H } = c, hz = plan.horizon, sky = P.gradient ?? [P.ground, P.ground];
    const skyPaint: Linear = { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: hz, stops: sky.map((col, i) => [i / (sky.length - 1), col]) };
    return [mkRect({ x: 0, y: 0, w: W, h: hz }, skyPaint), mkRect({ x: 0, y: hz, w: W, h: H - hz }, P.ground)];
  },
};
