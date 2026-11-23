/** Postmodern layout (spec 8.2): title block at the top or the bottom, and the tilt every strip shares. */
import { basePlan, type LayoutPart } from '../types';

const LAYOUTS = ['title-top', 'title-bottom'];
const DEG = Math.PI / 180;

export const pomoLayout: LayoutPart = {
  id: 'pomo', layouts: LAYOUTS, margin: 72,
  plan(c) {
    const { W, H, spec, top, bot } = c;
    const li = LAYOUTS.indexOf(spec.pick.layout ?? '');
    const titleTop = li >= 0 ? li === 0 : c.rf() < 0.5;
    const ang = c.cand([-6, -4, 3, 5]) * DEG;
    const M = Math.round(W * 0.0667), page = { x: 0, y: 0, w: W, h: H };
    const plan = basePlan(LAYOUTS[titleTop ? 0 : 1], page, M);
    const text = { x: M, y: top, w: W - 2 * M, h: bot - top };
    plan.boxes = { text, title: text, graphic: page };
    plan.titleSide = titleTop ? 'top' : 'bottom';
    plan.slant = ang;
    return plan;
  },
};
