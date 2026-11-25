/**
 * Brutalist layout (spec 8.0, 8.3): eight layouts built from the same rows (caption strip, title block, a band for
 * blunt graphics, subtitle bar, info table) in different orders, plus the title up the edge, the boxed page and the
 * slab; a tilt of the whole composition or a quarter turn on top (each about one roll in six); the title size class.
 *
 * The band is what the title leaves: the size class sets the share of the title area the title takes (small 50%,
 * normal 70%, oversize all of it), held between the height the rule's own lines need at the least stretch (one word
 * per line, by the tallest bundled face) and the most the title takes at the greatest stretch. The band never takes
 * height those lines need: words join onto fewer lines only where the area itself is too low for them (spec 8.3). Those heights are measured with the bundled display faces of the
 * style's pairings, never the pairing in use, so the type seed cannot move the band (9.3), and only core faces count:
 * they are always loaded (review R1, the band risk). Every face then stretches to fill its own area.
 *
 * Everything that shapes a graphic box comes from the layout stream in a fixed order (c.rf), the same for every
 * candidate; the emphasised line is a candidate decision read by type only.
 */
import { isCoreFace, PAIRINGS } from '../../../data/pairings';
import type { Rect } from '../../geom';
import { bleed, frameFor } from '../frame';
import { breaksFrom, brutalHeightAt, brutalLines, brutalMetrics, brutalMinHeight, blockInk, KY_MAX, KY_MIN } from '../shared/brutal';
import { basePlan, SIZE_CLASSES, TRANSFORMS, type LayoutPart, type SizeClass, type Transform } from '../types';
import { layoutPicker, sizeControl, transformControl } from '../../controls';

export const BRUTAL_LAYOUTS = ['title-top', 'title-bottom', 'table-first', 'split', 'boxed', 'title-up', 'screen', 'slab'];
/** The layouts where every title line spans the full inner width (all but the fallback; title-up spans the strip's height). */
export const FULL_WIDTH = ['title-top', 'title-bottom', 'table-first', 'split', 'boxed', 'screen', 'slab'];
/** The bundled display faces of the Brutalist pairings: the band's reference. */
const REF_FACES = [...new Map(PAIRINGS.brutal.filter((p) => isCoreFace(p.display)).map((p) => [p.display.family + p.display.weight, p.display])).values()];
const SHARE: Record<SizeClass, number> = { small: 0.5, normal: 0.7, oversize: 1 };

type Force = { name: string; transform: Transform } | null;

export const brutalLayout: LayoutPart = {
  id: 'brutal', layouts: BRUTAL_LAYOUTS, margin: 49,
  // spec 10.3 Layout: the layout, the transform (no quarter turn for the title already up the edge), the title size
  // class (the screen and slab layouts set their own; where no class moves the band, Advanced's trial hides it)
  controls: ({ scene }) => [
    layoutPicker(BRUTAL_LAYOUTS), transformControl(scene.frame === 'title-up' ? ['none', 'tilt'] : undefined),
    ...(['screen', 'slab'].includes(scene.frame) ? [] : [sizeControl()]),
  ],
  plan(c) {
    // a picked motif needs a band; where the rolled layout and transform leave none (the band never takes the
    // title's own lines, review R8 E1), the plan is made again as the title at the top, untilted, from the same
    // draws (replayed, so the layout stream reads as it did), unless Advanced or a picked layout set them
    const draws: number[] = [], cands: unknown[] = [];
    const rec = { ...c, rf: () => { const v = c.rf(); draws.push(v); return v; }, cand: <V>(l: readonly V[], s?: V) => { const v = c.cand(l, s); cands.push(v); return v; } } as typeof c;
    const replay = (force: Force) => {
      let i = 0, j = 0;
      return planWith({ ...c, rf: () => draws[i++], cand: () => cands[j++] } as unknown as typeof c, force);
    };
    const p = planWith(rec, null);
    const sp = c.spec, tOn = sp.text.title.on && !!sp.text.title.v.trim();
    if (!p || !sp.pick.motif || p.boxes.graphic || !tOn || sp.pick.layout || TRANSFORMS.includes(sp.params['layout.transform'] as Transform)) return p;
    if (p.frame === 'title-top' && p.transform === 'none') return p;
    const out = replay({ name: 'title-top', transform: 'none' }) ?? p;
    return out;
  },
};

function planWith(c: Parameters<LayoutPart['plan']>[0], force: Force): ReturnType<LayoutPart['plan']> {
    const { W, H, spec, m, story } = c, prm = spec.params, tx = spec.text;
    // the layout stream, in a fixed order: layout, transform, tilt angle, size class, then the emphasised line
    const li = BRUTAL_LAYOUTS.indexOf(spec.pick.layout ?? '');
    const ul = c.rf(), ut = c.rf(), ua = c.rf(), us = c.rf();
    let name = li >= 0 ? BRUTAL_LAYOUTS[li] : BRUTAL_LAYOUTS[Math.floor(ul * BRUTAL_LAYOUTS.length)];
    if (li < 0 && spec.pick.motif && name === 'screen') name = 'title-top';
    let transform: Transform = (['none', 'none', 'none', 'none', 'tilt', 'quarter'] as Transform[])[Math.floor(ut * 6)];
    if (force) { name = force.name; transform = force.transform; }
    if (TRANSFORMS.includes(prm['layout.transform'] as Transform)) transform = prm['layout.transform'] as Transform;
    // a title already up the edge is not turned again (it would read sideways): the style rule wins over Advanced,
    // whose Turn control does not offer it there (review R10 S2)
    if (name === 'title-up' && transform === 'quarter') transform = 'none';
    let size: SizeClass = (['small', 'small', 'normal', 'normal', 'normal', 'oversize'] as SizeClass[])[Math.floor(us * 6)];
    // a picked motif needs a band: the small title (it leaves the most room), and the screen layout (whose band is
    // thin) gives way; an Advanced size still wins
    if (spec.pick.motif) size = 'small';
    if (SIZE_CLASSES.includes(prm['layout.size'] as SizeClass)) size = prm['layout.size'] as SizeClass;
    if (name === 'screen') size = 'oversize';
    if (name === 'slab') size = 'small';
    const hot = c.cand([0, 1, 2]);
    const deg = (ua < 0.5 ? -1 : 1) * (9 + 5 * ((ua * 2) % 1));
    const fr = frameFor(transform, deg, W, H, story), pg = fr.page;

    const BAND = W * 0.09, THIN = W * 0.065;
    const M = Math.round(W * 0.045), gap = Math.round(W * 0.02), { R, ms } = brutalMetrics(W);
    const up0 = transform === 'none' ? c.top : M, dn0 = transform === 'none' ? c.bot : pg.h - M;
    const plan = basePlan(name, pg, M);
    plan.transform = transform;
    plan.xf = fr.xf;
    plan.gutter = gap;
    plan.emphasis = hot;
    plan.size = size;
    plan.boxes = { text: { x: M, y: up0, w: pg.w - 2 * M, h: dn0 - up0 } };
    const B = plan.boxes;
    // with marks on, a free strip at the canvas's top and bottom edges for them (spec 7.2: marks go in free space
    // only, and a Brutalist page is otherwise filled to its margins; review R7: three marks on every design). On a
    // quarter turn those edges are the page's sides. In 9:16 the story zones are already free.
    const mk = spec.marks !== 'off' && !(story && transform === 'none') ? Math.round(W * 0.04) : 0;
    const sideMk = transform === 'quarter' ? mk : 0, endMk = transform === 'quarter' ? 0 : mk;
    // the boxed page: a thick border at the margin, everything inside it
    const boxed = name === 'boxed', inset = boxed ? R * 2 + gap : 0;
    if (boxed) B.panel = { x: M + sideMk, y: up0 + endMk, w: pg.w - 2 * M - 2 * sideMk, h: dn0 - up0 - 2 * endMk };
    const x0 = M + inset + sideMk, w0 = pg.w - 2 * M - 2 * inset - 2 * sideMk;
    let top = up0 + inset + endMk, bot = dn0 - inset - endMk;

    const hasT = tx.title.on && !!tx.title.v.trim();
    const capOn = tx.caption.on && !!tx.caption.v.trim();
    const pairs = tx.info.on ? tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim()).length : 0;
    const subOn = tx.subtitle.on && !!tx.subtitle.v.trim();
    const tiny = name === 'screen';
    // the split needs two lines and a table to put between them; otherwise it is set as the title at the top
    let split = name === 'split' && hasT && brutalLines(tx.title.v).length > 1 && (subOn || pairs > 0);
    const capH = R + ms * 2.1 + R / 2, rh = Math.round(W * (tiny ? 0.052 : 0.066)), bh = Math.round(W * (tiny ? 0.054 : 0.078));

    // title up the edge: a strip on the left reading up; the other rows stack in the column beside it
    if (name === 'title-up' && hasT) {
      // the caption strip runs across the top, over both
      if (capOn) { B.caption = { x: x0, y: top, w: w0, h: capH }; top += capH + gap; }
      const iw = w0, innerH = bot - top;
      const k = size === 'small' ? 0.75 : size === 'normal' ? 1.05 : 1.45;
      const ink = REF_FACES.map((f) => blockInk(m, brutalLines(tx.title.v), f, innerH, gap));
      const thick = Math.min(...ink.map((b) => b.ink * k + b.gaps));
      // the rule's own lines at the least stretch, by the thickest bundled face: the strip grows to 0.7 of the width
      // to keep them before any words join (review R8 E1), or 0.55 where the info table needs the column beside it
      const need = Math.max(...ink.map((b) => b.ink * KY_MIN + b.gaps));
      const sw = Math.round(Math.max(iw * 0.3, Math.min(iw * 0.55, thick), Math.min(iw * (pairs ? 0.55 : 0.7), need)));
      plan.titleUp = true;
      const cx = x0 + sw + gap * 2, cw = iw - sw - gap * 2;
      let yb = bot;
      // the subtitle bar runs across the foot, under both
      if (subOn) { yb -= bh; B.subtitle = { x: x0, y: yb, w: iw, h: bh }; yb -= gap; }
      B.title = { x: x0, y: top, w: sw, h: yb - top };
      if (pairs) { B.info = { x: cx, y: yb - pairs * rh, w: cw, h: pairs * rh }; yb -= pairs * rh + gap; }
      if (yb - top > BAND) B.graphic = { x: cx, y: top, w: cw, h: yb - top };
      plan.titleSide = 'top';
      return plan;
    }

    // the rows above and below the title area, in the layout's order
    const iw = w0;
    const takeTop = (h: number): Rect => { const r = { x: x0, y: top, w: iw, h }; top += h; return r; };
    const takeBot = (h: number): Rect => { bot -= h; return { x: x0, y: bot, w: iw, h }; };
    if (capOn) { B.caption = takeTop(capH); top += gap; }
    const lines = brutalLines(tx.title.v);
    // the least and most height the title can take, by the bundled faces (the band never moves with the type seed)
    const typed = tx.title.v.includes('\n');
    const minH = (ls: string[]) => Math.max(...REF_FACES.map((f) => brutalMinHeight(m, breaksFrom(ls, typed), f, iw, gap)));
    const maxH = (ls: string[]) => Math.min(...REF_FACES.map((f) => brutalHeightAt(m, ls, f, iw, gap, KY_MAX)));
    // the rule's own lines at the least stretch, by the tallest bundled face: in every size class a band never takes
    // the room the title needs to keep them (spec 8.3; review R8 E1, S2)
    const ruleH = (ls: string[]) => Math.max(...REF_FACES.map((f) => brutalHeightAt(m, ls, f, iw, gap, 0)));
    /** The least height the title may be given: the rule's lines where the area holds them, else (height binds) the joined minimum. */
    const need = (A: number, ls: string[]) => (A >= ruleH(ls) ? ruleH(ls) : minH(ls));
    const band = (A: number, t: string[], share: number) => {
      // where the rule's lines leave less than a band, a band down to THIN (never at oversize) rather than none
      if (A >= ruleH(t)) { const left = A - Math.max(ruleH(t), Math.min(maxH(t), A * share)) - gap; return left >= BAND || (size !== 'oversize' && left >= THIN) ? left : 0; }
      // the area is too low for the rule's lines (they join whatever the band does): only a thin band, not at
      // oversize, where the joined title leaves it room
      return size !== 'oversize' && A - Math.max(minH(t), Math.min(maxH(t), A * share)) - gap >= BAND * 1.2 ? Math.round(BAND * 1.2) : 0;
    };
    // the split needs room for both halves at full width; where the table leaves too little, the title takes the top
    if (split) {
      const n1 = Math.ceil(lines.length / 2), tab = (pairs ? pairs * rh : 0) + (subOn ? bh : 0) + (pairs && subOn ? R * 1.4 : 0);
      if (bot - top - tab - 2 * gap < minH(lines.slice(0, n1)) + minH(lines.slice(n1))) split = false;
    }
    if (name === 'table-first') {
      if (pairs) { B.info = takeTop(pairs * rh); top += R * 1.4; }
      if (subOn) { B.subtitle = takeTop(bh); top += gap; }
    } else if (split) {
      // the table goes between the two halves of the title (below)
    } else {
      if (pairs) { B.info = takeBot(pairs * rh); }
      if (subOn) { if (pairs) bot -= R * 1.4; B.subtitle = takeBot(bh); }
    }
    if (!hasT) {
      // no title: the band takes what is left, so the page is not bare
      const hi = bot - (B.subtitle || B.info ? gap : 0);
      if (hi - top > BAND) B.graphic = { x: x0, y: top, w: iw, h: hi - top };
      return plan;
    }
    if (split) {
      // top half, a band, the table, the bottom half: the band and the halves share what the table leaves
      const n1 = Math.ceil(lines.length / 2), t1 = lines.slice(0, n1), t2 = lines.slice(n1);
      const tab = (pairs ? pairs * rh : 0) + (subOn ? bh : 0) + (pairs && subOn ? R * 1.4 : 0);
      const X = bot - top - tab - 2 * gap;
      // each half keeps the rule's lines where both fit; only where they cannot do the halves join (review R8 E1)
      const rule = X >= ruleH(t1) + ruleH(t2);
      const lo1 = rule ? ruleH(t1) : minH(t1), lo = lo1 + (rule ? ruleH(t2) : minH(t2)), hi = maxH(t1) + maxH(t2);
      const want = Math.max(lo, Math.min(hi, X * SHARE[size]));
      // where the halves join (height binds) the band is only thin, as in band() below
      const g = rule ? (X - want - gap >= BAND || (size !== 'oversize' && X - want - gap >= THIN) ? X - want - gap : 0) : size !== 'oversize' && X - want - gap >= BAND * 1.2 ? Math.round(BAND * 1.2) : 0;
      const T = X - (g ? g + gap : 0);
      const h1 = T * (lo1 / lo);
      B.title = { x: x0, y: top, w: iw, h: h1 };
      let y = top + h1 + gap;
      if (g) { B.graphic = { x: x0, y, w: iw, h: g }; y += g + gap; }
      if (subOn) { B.subtitle = { x: x0, y, w: iw, h: bh }; y += bh + (pairs ? R * 1.4 : 0); }
      if (pairs) { B.info = { x: x0, y, w: iw, h: pairs * rh }; y += pairs * rh; }
      y += gap;
      B.title2 = { x: x0, y, w: iw, h: bot - y };
      plan.titleSide = 'top';
      return plan;
    }
    const areaTop = top, areaBot = bot - (B.subtitle || B.info ? gap : 0), A = areaBot - areaTop;
    const t = lines;
    let g = 0;
    if (name === 'slab') {
      // the big band takes only what the rule's lines leave; where the area binds them anyway, a thin one
      g = A >= ruleH(t) ? Math.min(A * 0.45, A - ruleH(t) - gap) : A - Math.max(minH(t), Math.min(maxH(t), A * SHARE.small)) - gap >= BAND * 1.2 ? Math.round(BAND * 1.2) : 0;
      if (g < BAND) g = 0;
    } else if (name === 'screen') {
      // the rest is tiny: a thin band of graphic over the footer, where the title leaves it room
      g = A - need(A, t) - gap >= BAND * 1.2 ? Math.round(BAND * 1.2) : 0;
    } else g = band(A, t, SHARE[size]);
    const graphicFirst = name === 'title-bottom' || name === 'slab';
    if (g) {
      let gb: Rect = graphicFirst ? { x: x0, y: areaTop, w: iw, h: g } : { x: x0, y: areaBot - g, w: iw, h: g };
      // the slab bleeds off both sides of the page (spec 8.0 depth); on a tilt every band does, so the corners the
      // tilt leaves are covered by the band and the accent bar, and the title box stays as it is (review R8 M3)
      if (name === 'slab' || transform === 'tilt') { gb = { x: sideMk, y: gb.y, w: pg.w - 2 * sideMk, h: gb.h }; if (transform !== 'none' && !sideMk) gb = bleed(gb, pg, fr.canvas); }
      B.graphic = gb;
    }
    B.title = graphicFirst ? { x: x0, y: areaTop + (g ? g + gap : 0), w: iw, h: A - (g ? g + gap : 0) } : { x: x0, y: areaTop, w: iw, h: A - (g ? g + gap : 0) };
    plan.titleSide = name === 'table-first' || name === 'title-bottom' ? 'bottom' : 'top';
    return plan;
}
