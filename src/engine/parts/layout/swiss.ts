/**
 * Swiss layout (spec 8.0, 8.1): the grid is the design. Three archetypes on a 6-column grid, the axis column,
 * then the variety on top: a tilt of the whole composition or a quarter turn (each about one roll in six),
 * and the title size class. Bleeding boxes reach the canvas edge however the page is turned.
 */
import { bleed, frameFor } from '../frame';
import { SIZE_CLASSES, TRANSFORMS, type LayoutPart, type Plan, type SizeClass, type Transform } from '../types';
import type { Rect } from '../../geom';
import { SLOTS } from '../../spec';

const LAYOUTS = ['graphic-above', 'graphic-below', 'full-bleed'];

export const swissLayout: LayoutPart = {
  id: 'swiss', layouts: LAYOUTS, margin: 72,
  plan(c) {
    const { W, H, spec, story } = c;
    // the layout stream, in a fixed order: archetype, axis, bleed or panel side, transform, tilt angle, size class
    const li = LAYOUTS.indexOf(spec.pick.layout ?? '');
    const arche = li >= 0 ? li : Math.floor(c.rf() * 3);
    const axis = c.cand([0, 0, 1, 2]);
    const flag = c.rf() < 0.5;
    let transform: Transform = c.cand(['none', 'none', 'none', 'none', 'tilt', 'quarter'] as Transform[], 'none');
    const u = c.rf();
    let size: SizeClass = c.cand(['small', 'normal', 'normal', 'oversize'] as SizeClass[], 'normal');
    const pt = spec.params['layout.transform'], ps = spec.params['layout.size'];
    if (TRANSFORMS.includes(pt as Transform)) transform = pt as Transform;
    if (SIZE_CLASSES.includes(ps as SizeClass)) size = ps as SizeClass;
    const deg = (u < 0.5 ? -1 : 1) * (9 + 5 * ((u * 2) % 1));
    const fr = frameFor(transform, deg, W, H, story), pg = fr.page;
    const M = Math.round(W * 0.0667), G = Math.round(W * 0.028), mod = (pg.w - 2 * M) / 6;
    const top = transform === 'none' ? c.top : M, bot = transform === 'none' ? c.bot : pg.h - M, innerH = bot - top;
    const any = SLOTS.some((s) => spec.text[s].on);

    let MR: Rect = { ...pg }, TR: Rect = { x: M, y: top, w: pg.w - 2 * M, h: innerH }, panel: Rect | null = null;
    if (any && arche === 2) {
      const ph = Math.round(innerH * (story && transform === 'none' ? 0.4 : 0.5) / mod) * mod, atTop = flag;
      panel = { x: 0, y: atTop ? 0 : pg.h - (ph + (pg.h - bot) + M * 0.6), w: M + mod * 5, h: ph + (atTop ? top : pg.h - bot) + M * 0.6 };
      TR = { x: M, y: atTop ? top : panel.y + M * 0.6, w: mod * 5 - M * 0.6, h: ph };
    } else if (any) {
      const square = Math.abs(pg.h / pg.w - 1) < 0.05;
      const mh = Math.round(innerH * (square ? 0.47 : 0.52) / mod) * mod, bl = flag;
      if (arche === 0) {
        MR = bl ? { x: 0, y: 0, w: pg.w, h: top + mh } : { x: M, y: top, w: pg.w - 2 * M, h: mh };
        TR = { x: M, y: top + mh + G * 1.4, w: pg.w - 2 * M, h: innerH - mh - G * 1.4 };
      } else {
        MR = bl ? { x: 0, y: bot - mh, w: pg.w, h: pg.h - bot + mh } : { x: M, y: bot - mh, w: pg.w - 2 * M, h: mh };
        TR = { x: M, y: top, w: pg.w - 2 * M, h: innerH - mh - G * 1.4 };
      }
    }
    if (transform !== 'none') {
      MR = bleed(MR, pg, fr.canvas);
      if (panel) panel = bleed(panel, pg, fr.canvas);
    }
    const plan: Plan = {
      frame: LAYOUTS[arche], transform, xf: fr.xf, page: pg,
      boxes: { graphic: MR, text: TR }, vals: { axis, mod, M, G, size, any, deg: transform === 'tilt' ? deg : 0 },
    };
    if (panel) plan.boxes.panel = panel;
    return plan;
  },
};
