/**
 * Postmodern layout (spec 8.0, 8.2, 8.5): the dialect, then the layout within it, a transform on top, the zone the
 * title block takes, and the position of each text slot.
 *
 * Ice cream: the title block (strips or tiles) at the top, the bottom or the middle, as a staircase down the whole
 * page, set up the left edge, or over one huge shape. Photocopy: the words stacked from the top, low, in the middle,
 * in a column beside the found graphics, or covering the page. A tilt of the whole composition (about one roll in
 * six; photocopy also a quarter turn, one in eight each).
 *
 * The dialect, layout, transform and zones come from the layout stream in a fixed order (c.rf), the same for every
 * candidate, so the type seed never moves a graphic (9.3); the slant, size class and positions are candidate
 * decisions (c.cand), read by type only.
 */
import { FOUND } from '../../graphics/found';
import { SHAPE_NAMES } from '../../graphics/shape';
import type { Rect } from '../../geom';
import { DIALECTS, SLOTS, type Dialect, type Slot } from '../../spec';
import { bleed, frameFor } from '../frame';
import { basePlan, SIZE_CLASSES, TRANSFORMS, type LayoutPart, type SizeClass, type Transform } from '../types';

export const ICE_LAYOUTS = ['title-top', 'title-bottom', 'title-middle', 'stairs', 'title-side', 'big-shape'];
export const COPY_LAYOUTS = ['copy-stack', 'copy-low', 'copy-centre', 'copy-column', 'copy-cover'];
export const POMO_LAYOUTS = [...ICE_LAYOUTS, ...COPY_LAYOUTS];
const OF: Record<Dialect, string[]> = { icecream: ICE_LAYOUTS, photocopy: COPY_LAYOUTS };
/**
 * Positions per slot (spec 8.5), the first the default. Title: the side the block hugs. Subtitle: under or over the
 * title. Info: the right or left of the free end. Caption: the left or right edge (ice cream, running up or down
 * it) or corner (photocopy, three fading copies).
 */
export const POMO_POS: Record<Slot, string[]> = { title: ['left', 'right'], subtitle: ['under', 'over'], info: ['right', 'left'], caption: ['left', 'right'] };
const POS_ODDS: Record<Slot, string[]> = { title: ['left', 'left', 'right'], subtitle: ['under', 'under', 'under', 'over'], info: ['right', 'right', 'left'], caption: ['left', 'left', 'right'] };
const DEG = Math.PI / 180;

/** The dialect a spec asks for: pick.dialect, else that of a picked layout, else that of a picked motif; null: the stream decides. */
export function askedDialect(pick: { dialect: Dialect | null; layout: string | null; motif: string | null }): Dialect | null {
  if (pick.dialect && DIALECTS.includes(pick.dialect)) return pick.dialect;
  if (pick.layout && ICE_LAYOUTS.includes(pick.layout)) return 'icecream';
  if (pick.layout && COPY_LAYOUTS.includes(pick.layout)) return 'photocopy';
  if (pick.motif && FOUND.includes(pick.motif)) return 'photocopy';
  if (pick.motif && SHAPE_NAMES.includes(pick.motif)) return 'icecream';
  return null;
}

export const pomoLayout: LayoutPart = {
  id: 'pomo', layouts: POMO_LAYOUTS, margin: 72, dialects: DIALECTS, layoutsOf: OF,
  plan(c) {
    const { W, H, spec, story } = c, prm = spec.params;
    // the layout stream, in a fixed order: dialect, layout, transform, tilt angle, zone jitter
    const ud = c.rf(), ul = c.rf(), ut = c.rf(), ua = c.rf(), uz = c.rf();
    const dialect: Dialect = askedDialect(spec.pick) ?? (ud < 0.5 ? 'icecream' : 'photocopy');
    const list = OF[dialect];
    const name = list.includes(spec.pick.layout ?? '') ? spec.pick.layout! : list[Math.floor(ul * list.length)];
    const odds: Transform[] = dialect === 'icecream' ? ['none', 'none', 'none', 'none', 'none', 'tilt'] : ['none', 'none', 'none', 'none', 'none', 'none', 'tilt', 'quarter'];
    let transform = odds[Math.floor(ut * odds.length)];
    // a title already set up the edge is not turned again, nor is a staircase that needs the page's height
    if (name === 'title-side' || name === 'stairs') transform = 'none';
    // a 9:16 page turned on its side leaves the words small in a band (tuning pass, R6)
    if (story && transform === 'quarter') transform = 'tilt';
    if (TRANSFORMS.includes(prm['layout.transform'] as Transform)) transform = prm['layout.transform'] as Transform;
    const deg = (ua < 0.5 ? -1 : 1) * (9 + 5 * ((ua * 2) % 1));
    const fr = frameFor(transform, deg, W, H, story), pg = fr.page;
    const M = Math.round(W * 0.0667);
    const T0 = transform === 'none' ? c.top : M * 0.6, B0 = transform === 'none' ? c.bot : pg.h - M * 0.6;
    const text: Rect = { x: M, y: T0, w: pg.w - 2 * M, h: B0 - T0 };
    const plan = basePlan(name, pg, M);
    plan.transform = transform;
    plan.xf = fr.xf;
    plan.dialect = dialect;

    // candidate decisions, read by type only
    const slant = c.cand([-6, -4, 3, 5], -4) * DEG;
    let size: SizeClass = c.cand(['small', 'normal', 'normal', 'oversize'] as SizeClass[], 'normal');
    const pos: Partial<Record<Slot, string>> = {};
    for (const s of SLOTS) {
      const v = c.cand(POS_ODDS[s], POMO_POS[s][0]), set = spec.text[s].pos;
      pos[s] = set && POMO_POS[s].includes(set) ? set : v;
    }
    plan.emphasis = c.cand([0, 1, 2], 0);
    if (SIZE_CLASSES.includes(prm['layout.size'] as SizeClass)) size = prm['layout.size'] as SizeClass;
    if (name === 'copy-cover') size = 'oversize';
    if (size === 'small' && transform !== 'none') size = 'normal';
    plan.size = size;
    plan.slant = dialect === 'icecream' ? slant : 0;
    plan.pos = pos;

    // zones: where the title block goes and where the graphics gather (spec 8.0 depth: shapes go everywhere)
    const j = (uz - 0.5) * 0.08 * text.h;
    const band = (y0: number, h: number): Rect => ({ x: text.x, y: Math.max(text.y, Math.min(text.y + text.h - h, text.y + y0)), w: text.w, h });
    let title: Rect, graphic: Rect;
    const th = text.h;
    switch (name) {
      case 'title-top': title = band(0, th * 0.56); graphic = { x: 0, y: text.y + th * 0.5, w: pg.w, h: pg.h - text.y - th * 0.5 }; plan.titleSide = 'top'; break;
      case 'title-bottom': title = band(th * 0.44, th * 0.56); graphic = { x: 0, y: 0, w: pg.w, h: text.y + th * 0.5 }; plan.titleSide = 'bottom'; break;
      case 'title-middle': case 'big-shape': title = band(th * 0.2 + j, th * 0.6); graphic = { ...pg }; plan.titleSide = 'top'; break;
      case 'stairs': title = band(0, th); graphic = { ...pg }; plan.titleSide = 'top'; break;
      case 'title-side': {
        // the block reads up the page in a strip beside the left margin; the shapes take the rest
        const w = Math.round(text.w * 0.58);
        title = { x: text.x + M * 0.5, y: text.y, w, h: text.h };
        graphic = { x: title.x + w, y: 0, w: pg.w - title.x - w, h: pg.h };
        plan.titleUp = true; plan.titleSide = 'top';
        break;
      }
      case 'copy-stack': title = band(0, th * 0.74); graphic = { x: 0, y: text.y + th * 0.5, w: pg.w, h: pg.h - text.y - th * 0.5 }; plan.titleSide = 'top'; break;
      case 'copy-low': title = band(th * 0.24, th * 0.76); graphic = { x: 0, y: 0, w: pg.w, h: text.y + th * 0.55 }; plan.titleSide = 'bottom'; break;
      case 'copy-centre': title = band(th * 0.1 + j, th * 0.7); graphic = { ...pg }; plan.titleSide = 'top'; break;
      case 'copy-column': {
        const w = Math.round(text.w * 0.66);
        title = { x: text.x, y: text.y, w, h: th * 0.7 };
        graphic = { x: text.x + w * 0.8, y: 0, w: pg.w - text.x - w * 0.8, h: pg.h };
        plan.titleSide = 'top';
        break;
      }
      default: title = band(0, th * 0.78); graphic = { x: 0, y: text.y + th * 0.6, w: pg.w, h: pg.h - text.y - th * 0.6 }; plan.titleSide = 'top';
    }
    plan.boxes = { text, title, graphic: bleed(graphic, pg, fr.canvas) };
    plan.side = pos.info === 'left' ? 'left' : 'right';
    return plan;
  },
};
