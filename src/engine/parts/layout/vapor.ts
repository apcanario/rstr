/** Vaporwave layout (spec 8.4): the horizon, the sun's place, the title in the sky or on the floor, the window's side. */
import { pick } from '../../rng';
import type { LayoutPart } from '../types';

const LAYOUTS = ['title-sky', 'title-floor'];

export const vaporLayout: LayoutPart = {
  id: 'vapor', layouts: LAYOUTS, margin: 72,
  plan(c) {
    const { W, H, spec } = c;
    // frame, in the spike's order: horizon, sun x, sun radius, sun height, then title side and window side
    const hz = Math.round(H * (0.56 + c.rf() * 0.08));
    const sunX = W * pick(c.rf, [0.5, 0.5, 0.3, 0.7]), sunR = W * (0.24 + c.rf() * 0.1);
    const sy = hz - sunR * (0.25 + c.rf() * 0.3);
    const li = LAYOUTS.indexOf(spec.pick.layout ?? '');
    const upperPos = c.cand([true, false], false);
    const isUpper = li >= 0 ? li === 0 : upperPos;
    const right = c.cand([true, false]);
    return {
      frame: isUpper ? 'title-sky' : 'title-floor', transform: 'none', page: { x: 0, y: 0, w: W, h: H },
      boxes: { sky: { x: 0, y: 0, w: W, h: hz }, floor: { x: 0, y: hz, w: W, h: H - hz } },
      vals: { hz, sunX, sunR, sy, isUpper, right },
    };
  },
};
