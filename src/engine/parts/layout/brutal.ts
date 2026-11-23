/** Brutalist layout (spec 8.3): rows from the top (caption strip) and the bottom (info table, subtitle bar), the title in between, a band for one blunt graphic. */
import { isCoreFace, PAIRINGS } from '../../../data/pairings';
import { brutalBlock, brutalLines } from '../shared/brutal';
import { textArea, type LayoutPart, type Plan } from '../types';

const LAYOUTS = ['title-top', 'title-bottom'];
/** The bundled display faces of the Brutalist pairings: the band's reference (see plan). */
const REF_FACES = [...new Map(PAIRINGS.brutal.filter((p) => isCoreFace(p.display)).map((p) => [p.display.family + p.display.weight, p.display])).values()];

export const brutalLayout: LayoutPart = {
  id: 'brutal', layouts: LAYOUTS, margin: 49,
  plan(c) {
    const { W, H, spec, m, story } = c;
    const M = Math.round(W * 0.045), { top, bot } = textArea(story, H, M), iw = W - 2 * M, tx = spec.text;
    const R = Math.max(6, Math.round(W * 0.012)), ms = Math.round(W * 0.023), gap = Math.round(W * 0.02);
    // frame, in the spike's order: (its face draw, now the type seed's job), hot line, flip
    c.rf();
    const hot = c.cand([0, 1, 2]);
    const li = LAYOUTS.indexOf(spec.pick.layout ?? '');
    const flip = li >= 0 ? li === 1 : c.rf() < 0.4;
    const plan: Plan = { frame: flip ? 'title-bottom' : 'title-top', transform: 'none', page: { x: 0, y: 0, w: W, h: H }, boxes: {}, vals: { hot, flip, M, R, ms, gap } };
    let y = top, yb = bot;
    if (tx.caption.on && tx.caption.v.trim()) {
      plan.boxes.caption = { x: M, y, w: iw, h: R + ms * 2.1 + R / 2 };
      y += R + ms * 2.1 + R / 2;
    }
    if (tx.info.on) {
      const n = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim()).length;
      const rh = Math.round(W * 0.066);
      if (n) { yb -= n * rh; plan.boxes.info = { x: M, y: yb, w: iw, h: n * rh }; plan.vals.rh = rh; }
    }
    if (tx.subtitle.on && tx.subtitle.v.trim()) {
      const bh = Math.round(W * 0.078);
      yb -= bh + (tx.info.on ? R * 1.4 : 0);
      plan.boxes.subtitle = { x: M, y: yb, w: iw, h: bh };
    }
    if (tx.title.on && tx.title.v.trim()) {
      let areaTop = y + gap, areaBot = yb - gap;
      const lines = brutalLines(tx.title.v);
      // Left-over space gets one blunt graphic. Its size is set by the bundled display faces of the style's
      // pairings (the one that leaves the most room), never by the pairing in use, so the type seed cannot move
      // it (9.3). Only core faces count: they are always loaded, so the band never waits on, or is measured
      // with a fallback for, a face fetched online (review R1, the band risk). Every face then stretches to fill
      // what is left.
      const ref = Math.min(...REF_FACES.map((f) => brutalBlock(m, lines, f, areaBot - areaTop, iw, gap).height));
      const left = areaBot - areaTop - ref - gap;
      if (left > W * 0.12) {
        plan.boxes.band = flip ? { x: M, y: areaTop, w: iw, h: left } : { x: M, y: areaBot - left, w: iw, h: left };
        if (flip) areaTop += left + gap; else areaBot -= left + gap;
      }
      plan.boxes.title = { x: M, y: areaTop, w: iw, h: areaBot - areaTop };
    }
    return plan;
  },
};
