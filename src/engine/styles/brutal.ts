/** Brutalist (spec 8.3): heavy type, the title is the graphic. Ported from the spike. */
import { firstInk, needRatio } from '../colour';
import { mkGraphic, mkRect, mkText } from '../items';
import { isCoreFace, PAIRINGS } from '../../data/pairings';
import { rng } from '../rng';
import type { Item, TextItem } from '../scene';
import { fitLine } from '../text';
import { textArea, type Style } from './types';
import { upper } from './util';

const MIN = { title: 40, subtitle: 16, info: 16, caption: 16 };
const BLUNT = ['barcode', 'slab', 'asterisks'];
/** The bundled display faces of the Brutalist pairings: the band's reference (see build). */
const REF_FACES = [...new Map(PAIRINGS.brutal.filter((p) => isCoreFace(p.display)).map((p) => [p.display.family + p.display.weight, p.display])).values()];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Title lines: a typed line break is kept; otherwise one word per line up to four, else three balanced lines. */
export function brutalLines(title: string): string[] {
  const t = upper(title).trim();
  if (t.includes('\n')) return t.split('\n').map((l) => l.trim()).filter(Boolean);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return words;
  const n = Math.ceil(words.length / 3);
  return [0, 1, 2].map((i) => words.slice(i * n, i * n + n).join(' ')).filter(Boolean);
}

export const brutal: Style = {
  id: 'brutal', name: 'Brutalist', blurb: 'Heavy type, hard rules', layouts: ['title-top', 'title-bottom'], motifs: BLUNT, min: MIN, margin: 49,
  build(b) {
    const { W, H, spec, m, P, T, story } = b;
    const M = Math.round(W * 0.045), { top, bot } = textArea(story, H, M), iw = W - 2 * M, tx = spec.text, force = b.fallback;
    const R = Math.max(6, Math.round(W * 0.012));
    // frame, in the spike's order: (its face draw, now the type seed's job), hot line, flip
    b.rf();
    const hot = b.cand([0, 1, 2]);
    const li = ['title-top', 'title-bottom'].indexOf(spec.pick.layout ?? '');
    const flip = li >= 0 ? li === 1 : b.rf() < 0.4;
    const fam = T.display, mono = T.mono;
    const rects: Item[] = [], texts: TextItem[] = [], graphics: Item[] = [];
    let y = top, yb = bot;
    const ms = Math.round(W * 0.023);
    if (tx.caption.on && tx.caption.v.trim()) {
      rects.push(mkRect({ x: M, y, w: iw, h: R }, P.ink));
      const tag = 'RSTR/' + spec.format, tagW = m(tag, mono, ms).width;
      const c = fitLine(m, upper(tx.caption.v), mono, ms, MIN.caption, iw - tagW - ms * 2, 0.08, force);
      if (!c) { if (!force) return null; }
      const base = y + R + ms * 1.45;
      if (c) texts.push(mkText(m, { slot: 'caption', part: 'line0', font: mono, size: c.size, tracking: c.tracking, runs: [{ s: c.lines[0], x: M, y: base }], fill: P.ink, ink: [P.ink], min: MIN.caption }));
      texts.push(mkText(m, { slot: 'caption', part: 'tag', font: mono, size: ms, runs: [{ s: tag, x: W - M - tagW, y: base }], fill: P.ink, ink: [P.ink], min: MIN.caption }));
      y += R + ms * 2.1;
      rects.push(mkRect({ x: M, y, w: iw, h: R / 2 }, P.ink));
      y += R / 2;
    }
    if (tx.info.on) {
      const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
      const rh = Math.round(W * 0.066);
      if (pairs.length) {
        yb -= pairs.length * rh;
        for (const [i, it] of pairs.entries()) {
          const ry = yb + i * rh;
          rects.push(mkRect({ x: M, y: ry, w: iw, h: i ? R / 2 : R }, P.ink));
          if (it.k.trim()) {
            const l = fitLine(m, upper(it.k), mono, ms, MIN.info, iw * 0.28, 0.08, force);
            if (!l) { if (!force) return null; }
            else texts.push(mkText(m, { slot: 'info', part: 'label' + i, font: mono, size: l.size, tracking: l.tracking, runs: [{ s: l.lines[0], x: M, y: ry + rh * 0.66 }], fill: P.ink, ink: [P.ink], min: MIN.info }));
          }
          if (it.v.trim()) {
            const v = fitLine(m, upper(it.v), fam, Math.round(rh * 0.62), MIN.info, iw * 0.7, 0, force);
            if (!v) { if (!force) return null; }
            else {
              const mt = v.metrics[0];
              texts.push(mkText(m, { slot: 'info', part: 'value' + i, font: fam, size: v.size, runs: [{ s: v.lines[0], x: W - M - mt.right, y: ry + rh * 0.74 }], fill: P.ink, ink: [P.ink], min: MIN.info }));
            }
          }
        }
        rects.push(mkRect({ x: M, y: bot - R / 2, w: iw, h: R / 2 }, P.ink));
      }
    }
    if (tx.subtitle.on && tx.subtitle.v.trim()) {
      const bh = Math.round(W * 0.078);
      yb -= bh + (tx.info.on ? R * 1.4 : 0);
      const s = fitLine(m, upper(tx.subtitle.v), mono, Math.round(bh * 0.4), MIN.subtitle, iw - bh * 0.6, 0.1, force);
      if (!s) { if (!force) return null; }
      else {
        rects.push(mkRect({ x: M, y: yb, w: iw, h: bh }, P.ink, { plate: true }));
        const ink = firstInk([P.ground, P.accent], [P.ink], needRatio(s.size));
        texts.push(mkText(m, { slot: 'subtitle', part: 'bar', font: mono, size: s.size, tracking: s.tracking, runs: [{ s: s.lines[0], x: M + bh * 0.3, y: yb + bh * 0.5 + s.size * 0.36 }], fill: ink, ink: [ink], min: MIN.subtitle }));
      }
    }
    if (tx.title.on && tx.title.v.trim()) {
      const gap = Math.round(W * 0.02);
      let areaTop = y + gap, areaBot = yb - gap;
      let lines = brutalLines(tx.title.v);
      const block = (face: typeof fam, A: number) => {
        const ls = lines.map((l) => {
          const t = m(l, face, 200);
          const s = iw / (t.left + t.right);
          return { l, left: t.left, asc: t.ascent, desc: t.descent, s, h: (t.ascent + t.descent) * s };
        });
        const gaps = gap * (ls.length - 1), ink = ls.reduce((a, o) => a + o.h, 0);
        const ky = clamp((A - gaps) / ink, 0.55, 1.9), kx = Math.min(1, Math.max(0, A - gaps) / ink / 0.55);
        if (kx < 1) ls.forEach((o) => { o.s *= kx; o.h *= kx; });
        return { ls, ky, height: ls.reduce((a, o) => a + o.h * ky, 0) + gap * (ls.length - 1) };
      };
      // Left-over space gets one blunt graphic. Its size is set by the bundled display faces of the style's
      // pairings (the one that leaves the most room), never by the pairing in use, so the type seed cannot move
      // it (9.3). Only core faces count: they are always loaded, so the band never waits on, or is measured
      // with a fallback for, a face fetched online (review R1, the band risk). Every face then stretches to fill
      // what is left.
      const ref = Math.min(...REF_FACES.map((f) => block(f, areaBot - areaTop).height));
      const left = areaBot - areaTop - ref - gap;
      if (left > W * 0.12) {
        const band = flip ? { x: M, y: areaTop, w: iw, h: left } : { x: M, y: areaBot - left, w: iw, h: left };
        const mi = BLUNT.indexOf(spec.pick.motif ?? '');
        const kind = mi >= 0 ? mi : Math.floor(rng(spec.seeds.graphic)() * 3);
        graphics.push(mkGraphic(BLUNT[kind], band, spec.seeds.graphic, 1, { ink: P.ink, accent: P.accent }, kind === 1 ? [P.accent, P.ink] : [P.ink], { W }));
        if (flip) areaTop += left + gap; else areaBot -= left + gap;
      }
      if (areaBot - areaTop < MIN.title * 1.2) { if (!force) return null; return [...rects, ...graphics, ...texts]; }
      let fitted = block(fam, areaBot - areaTop);
      const smallest = (f: typeof fitted) => Math.min(...f.ls.map((o) => 200 * o.s * Math.min(1, f.ky)));
      // the fallback shortens the longest line (then drops the last one) until every line is at least the minimum size
      for (let guard = 0; force && smallest(fitted) < MIN.title && guard < 200; guard++) {
        const widest = fitted.ls.reduce((a, o) => (o.s < a.s ? o : a));
        const words = widest.l.replace(/…$/, '').split(' ');
        if (words.length > 1) lines = lines.map((l) => (l === widest.l ? words.slice(0, -1).join(' ') + '…' : l));
        else if (widest.l.replace(/…$/, '').length > 3) lines = lines.map((l) => (l === widest.l ? widest.l.replace(/…$/, '').slice(0, -1) + '…' : l));
        else if (lines.length > 1) lines = lines.slice(0, -1);
        else break;
        fitted = block(fam, areaBot - areaTop);
      }
      const { ls: ms0, ky, height: natural } = fitted;
      let ty = flip ? areaBot - natural : areaTop;
      ms0.forEach((o, i) => {
        const h = o.h * ky, on = i === hot % ms0.length;
        if (on) rects.push(mkRect({ x: 0, y: ty - gap / 2, w: W, h: h + gap }, P.accent, { plate: true }));
        const ink = on ? firstInk(P.accent === P.ink ? [P.ground, P.ink] : [P.ink, P.ground], [P.accent], 3) : P.ink;
        texts.push(mkText(m, {
          slot: 'title', part: 'line' + i, font: fam, size: 200,
          runs: [{ s: o.l, x: M + o.left * o.s, y: ty + o.asc * o.s * ky, sx: o.s, sy: o.s * ky }],
          fill: ink, ink: [ink], min: MIN.title,
        }));
        ty += h + gap;
      });
    }
    return [...rects, ...graphics, ...texts];
  },
};
