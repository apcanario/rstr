/** Postmodern layout (spec 8.2): title block at the top or the bottom, and the tilt every strip shares. */
import type { LayoutPart } from '../types';

const LAYOUTS = ['title-top', 'title-bottom'];
const DEG = Math.PI / 180;

export const pomoLayout: LayoutPart = {
  id: 'pomo', layouts: LAYOUTS, margin: 72,
  plan(c) {
    const { W, H, spec } = c;
    const li = LAYOUTS.indexOf(spec.pick.layout ?? '');
    const titleTop = li >= 0 ? li === 0 : c.rf() < 0.5;
    const ang = c.cand([-6, -4, 3, 5]) * DEG;
    return { frame: LAYOUTS[titleTop ? 0 : 1], transform: 'none', page: { x: 0, y: 0, w: W, h: H }, boxes: {}, vals: { titleTop, ang } };
  },
};
