/**
 * Swiss layout (spec 8.0, 8.1, 8.5): the grid is the design. Eight layouts on a 6-column grid, the axis column,
 * the position of each text slot, then the variety on top: a tilt of the whole composition or a quarter turn
 * (each about one roll in six), and the title size class. Bleeding boxes reach the canvas edge however the page
 * is turned.
 *
 * Rules from the tuning pass (docs/tuning-R5.md): no small title on a tilted or turned page (review R13 item 2)
 * or in type only; no quarter turn with the vertical title (it would read upside down); in 9:16 the graphic
 * takes more of the page, so the text block is not left small in a tall field of ground (review R1). On a tilted
 * page every layout gives its text the room to keep the title within 25% of its upright size (review R5 S1). The
 * vertical layout's and the row split's graphic bleed (review R5 S2).
 */
import { bleed, frameFor } from '../frame';
import { SIZE_CLASSES, TRANSFORMS, type LayoutPart, type Plan, type SizeClass, type Transform } from '../types';
import type { Rect } from '../../geom';
import { SLOTS, type Slot } from '../../spec';

export const SWISS_LAYOUTS = ['graphic-above', 'graphic-below', 'full-bleed', 'column', 'type-only', 'vertical', 'centred-low', 'split'];
/** The positions of each text slot (spec 8.5), the first the default; weights by repetition. */
export const SWISS_POS: Record<Slot, string[]> = { title: ['top', 'low'], subtitle: ['under', 'over'], info: ['foot', 'head'], caption: ['foot', 'head'] };
const POS_ODDS: Record<Slot, string[]> = { title: ['top', 'top', 'low'], subtitle: ['under', 'under', 'under', 'over'], info: ['foot', 'foot', 'head'], caption: ['foot', 'foot', 'head'] };

const snap = (v: number, mod: number) => Math.max(mod, Math.round(v / mod) * mod);

export const swissLayout: LayoutPart = {
  id: 'swiss', layouts: SWISS_LAYOUTS, margin: 72,
  plan(c) {
    const { W, H, spec, story } = c, prm = spec.params;
    // the layout stream, in a fixed order: layout, axis, flag, transform, tilt angle, size class, band, positions
    const li = SWISS_LAYOUTS.indexOf(spec.pick.layout ?? '');
    const ua = c.rf();
    let arche = li >= 0 ? li : Math.floor(ua * SWISS_LAYOUTS.length);
    // type only cannot carry a picked motif
    if (li < 0 && spec.pick.motif && SWISS_LAYOUTS[arche] === 'type-only') arche = 1;
    const name = SWISS_LAYOUTS[arche];
    let axis = c.cand([0, 0, 1, 2]);
    let flag = c.rf() < 0.5;
    if (typeof prm['layout.flag'] === 'number') flag = prm['layout.flag'] >= 0.5;
    if (typeof prm['layout.axis'] === 'number') axis = Math.max(0, Math.min(2, Math.round(prm['layout.axis'])));
    // the transform shapes every graphic box, so it is the same for every candidate: the type seed never moves a graphic (9.3)
    let transform: Transform = (['none', 'none', 'none', 'none', 'tilt', 'quarter'] as Transform[])[Math.floor(c.rf() * 6)];
    const u = c.rf();
    let size: SizeClass = c.cand(['small', 'normal', 'normal', 'oversize'] as SizeClass[], 'normal');
    const band = c.rf();
    const pos: Partial<Record<Slot, string>> = {};
    for (const s of SLOTS) {
      const v = c.cand(POS_ODDS[s], SWISS_POS[s][0]), set = spec.text[s].pos;
      pos[s] = set && SWISS_POS[s].includes(set) ? set : v;
    }
    // with info and caption both at the head, a title at the top too would leave the foot bare: it goes low (tuning)
    if (pos.info === 'head' && pos.caption === 'head' && !spec.text.title.pos) pos.title = 'low';
    const pt = prm['layout.transform'], ps = prm['layout.size'];
    if (name === 'vertical' && transform === 'quarter') transform = 'none';
    if (TRANSFORMS.includes(pt as Transform)) transform = pt as Transform;
    if (size === 'small' && transform !== 'none') size = 'normal';
    // type only is carried by its title alone
    if (name === 'type-only') size = 'oversize';
    if (SIZE_CLASSES.includes(ps as SizeClass)) size = ps as SizeClass;
    const deg = (u < 0.5 ? -1 : 1) * (9 + 5 * ((u * 2) % 1));
    if (transform !== 'none') axis = Math.min(axis, 1);
    const fr = frameFor(transform, deg, W, H, story), pg = fr.page;
    const M = Math.round(W * 0.0667), G = Math.round(W * 0.028), mod = (pg.w - 2 * M) / 6;
    const top = transform === 'none' ? c.top : M, bot = transform === 'none' ? c.bot : pg.h - M, innerH = bot - top, innerW = pg.w - 2 * M;
    const any = SLOTS.some((s) => spec.text[s].on);
    const turned = transform !== 'none', tilted = transform === 'tilt';
    const tall = story && transform === 'none', square = Math.abs(pg.h / pg.w - 1) < 0.05;
    /** The graphic's share of the text area's height. */
    // on a tilted page (smaller than the canvas) the graphic gives up room so the title keeps its size (spec 8.1:
    // graphics pay for the tilt); a quarter turn keeps the page's size, so its graphic keeps its share (review R5 S2)
    const gshare = tilted ? (square ? 0.3 : 0.36) : turned ? (square ? 0.4 : 0.44) : tall ? 0.6 : square ? 0.54 : 0.58;

    // on a tilted or turned page an inset graphic would float in a field of ground: it bleeds instead (tuning)
    const out = flag || turned;
    let MR: Rect | null = { ...pg }, TR: Rect = { x: M, y: top, w: innerW, h: innerH }, title: Rect | null = null;
    let panel: Rect | null = null, field: Rect | null = null, titleUp = false;
    if (any) {
      const mh = snap(innerH * gshare, mod);
      switch (name) {
        case 'graphic-above':
          MR = out ? { x: 0, y: 0, w: pg.w, h: top + mh } : { x: M, y: top, w: innerW, h: mh };
          TR = { x: M, y: top + mh + G * 1.4, w: innerW, h: innerH - mh - G * 1.4 };
          break;
        case 'graphic-below':
          MR = out ? { x: 0, y: bot - mh, w: pg.w, h: pg.h - bot + mh } : { x: M, y: bot - mh, w: innerW, h: mh };
          TR = { x: M, y: top, w: innerW, h: innerH - mh - G * 1.4 };
          break;
        case 'full-bleed': {
          // on a tilted or turned page the panel and the text take the page's whole width, so the title keeps its size (review R5 S1)
          const ph = snap(innerH * (turned ? 0.62 : tall ? 0.42 : 0.5), mod), atTop = flag;
          panel = { x: 0, y: atTop ? 0 : pg.h - (ph + (pg.h - bot) + M * 0.6), w: turned ? pg.w : M + mod * 5, h: ph + (atTop ? top : pg.h - bot) + M * 0.6 };
          TR = { x: M, y: atTop ? top : panel.y + M * 0.6, w: turned ? innerW : mod * 5 - M * 0.6, h: ph };
          break;
        }
        case 'column': {
          const cw = tilted ? 1.5 : 3, bw = M + cw * mod;
          MR = flag ? { x: 0, y: 0, w: bw, h: pg.h } : { x: pg.w - bw, y: 0, w: bw, h: pg.h };
          TR = flag ? { x: bw + G, y: top, w: pg.w - M - bw - G, h: innerH } : { x: M, y: top, w: (6 - cw) * mod - G, h: innerH };
          axis = 0;
          break;
        }
        case 'type-only':
          // the title takes the whole measure: no axis indent (review R5 S2)
          MR = null;
          axis = 0;
          // on a tilted or turned page it takes part of the margins, so a title the width binds keeps its size (S1)
          if (turned) TR = { x: M * 0.6, y: M * 0.6, w: pg.w - M * 1.2, h: pg.h - M * 1.2 };
          break;
        case 'vertical': {
          const on = spec.text.title.on && !!spec.text.title.v.trim();
          const sw = on ? (band < 0.5 && !turned ? 1.5 : 2) * mod : 0, x0 = M + (on ? sw + G : 0);
          const gh = snap(innerH * (tall ? 0.7 : square ? 0.64 : 0.7), mod);
          if (on) { title = { x: M, y: top, w: sw, h: innerH }; titleUp = true; }
          // the graphic always bleeds off the top and the side: inset beside the title strip it left a frame of bare
          // ground (review R5 S2)
          MR = { x: x0, y: 0, w: pg.w - x0, h: top + gh };
          TR = { x: x0, y: top + gh + G * 1.4, w: pg.w - M - x0, h: innerH - gh - G * 1.4 };
          axis = 0;
          break;
        }
        case 'centred-low': {
          // on a tilted or turned page: no side indent and a smaller graphic, so the title keeps its size (review R5 S1)
          const gh = snap(innerH * (tilted ? (square ? 0.26 : 0.3) : tall ? 0.56 : square ? 0.44 : 0.5), mod), ind = turned ? 0 : mod;
          field = { ...pg };
          MR = out ? { x: 0, y: 0, w: pg.w, h: top + gh } : { x: M, y: top, w: innerW, h: gh };
          TR = { x: M + ind, y: top + gh + G * 1.4, w: innerW - 2 * ind, h: innerH - gh - G * 1.4 };
          axis = 0;
          break;
        }
        case 'split': {
          if (band < 0.6) {
            // two fields meeting on a row line: the text on the coloured one, the graphic on the ground
            const th = snap(innerH * (turned ? 0.68 : tall ? 0.38 : 0.42), mod), y0 = flag ? 0 : bot - th - M * 0.6;
            field = flag ? { x: 0, y: 0, w: pg.w, h: top + th + M * 0.6 } : { x: 0, y: y0, w: pg.w, h: pg.h - y0 };
            TR = { x: M, y: flag ? top : y0 + M * 0.6, w: innerW, h: th };
            // the graphic fills the ground's field, edge to edge, so the two fields meet (review R5 S2: an inset
            // graphic left a frame of bare ground round it)
            MR = flag ? { x: 0, y: field.h, w: pg.w, h: pg.h - field.h } : { x: 0, y: 0, w: pg.w, h: y0 };
          } else {
            // on a column line: four columns of colour with the text, the other two the graphic, bleeding
            // a tilted page gives the text four and a half columns (review R5 S1)
            const fc = tilted ? 4.5 : 4, fw = M + fc * mod + G / 2;
            field = flag ? { x: 0, y: 0, w: fw, h: pg.h } : { x: pg.w - fw, y: 0, w: fw, h: pg.h };
            TR = { x: flag ? M : pg.w - fw + G, y: top, w: fc * mod - G, h: innerH };
            MR = flag ? { x: fw, y: 0, w: pg.w - fw, h: pg.h } : { x: 0, y: 0, w: pg.w - fw, h: pg.h };
          }
          axis = 0;
          break;
        }
      }
    }
    // in 9:16 a graphic that ends at the foot of the text area runs on into the bottom story zone (graphics may
    // fill it), to a margin from the edge, so no band of bare ground is left under it (review R1, tuning)
    if (tall && MR && Math.abs(MR.y + MR.h - bot) < 1) MR = { ...MR, h: H - M - MR.y };
    if (transform !== 'none') {
      if (MR) MR = bleed(MR, pg, fr.canvas);
      if (panel) panel = bleed(panel, pg, fr.canvas);
      if (field) field = bleed(field, pg, fr.canvas);
    }
    const plan: Plan = {
      frame: name, transform, xf: fr.xf, page: pg, boxes: { text: TR, title: title ?? TR },
      margin: M, module: mod, gutter: G, axis, size,
      titleSide: pos.title === 'low' ? 'bottom' : 'top', side: 'left',
      horizon: pg.y + pg.h, slant: 0, emphasis: 0, pos, titleUp,
    };
    if (MR) plan.boxes.graphic = MR;
    if (panel) plan.boxes.panel = panel;
    if (field) plan.boxes.field = field;
    return plan;
  },
};
