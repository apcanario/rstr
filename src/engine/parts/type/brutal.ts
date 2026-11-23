/** Brutalist type (spec 8.3): caption strip between rules, info table, subtitle in an ink bar, the title stretched to fill, one line on an accent bar. */
import { firstInk, needRatio } from '../../colour';
import { mkRect, mkText } from '../../items';
import type { Item, TextItem } from '../../scene';
import { fitLine } from '../../text';
import { brutalBlock, brutalLines, brutalMetrics } from '../shared/brutal';
import { upper } from '../shared/text';
import type { TypePart } from '../types';

const MIN = { title: 40, subtitle: 16, info: 16, caption: 16 };

export const brutalType: TypePart = {
  id: 'brutal', min: MIN,
  set(c, plan) {
    const { W, spec, m, P, T } = c, tx = spec.text, force = c.fallback, B = plan.boxes;
    const M = plan.margin, { R, ms } = brutalMetrics(W), gap = plan.gutter, iw = W - 2 * M;
    // a slot with text the layout gave no row cannot be held by this candidate
    const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
    const wants = { caption: tx.caption.on && !!tx.caption.v.trim(), info: tx.info.on && pairs.length > 0, subtitle: tx.subtitle.on && !!tx.subtitle.v.trim(), title: tx.title.on && !!tx.title.v.trim() };
    if (!force && (Object.keys(wants) as (keyof typeof wants)[]).some((s) => wants[s] && !B[s])) return null;
    const fam = T.display, mono = T.mono;
    const rects: Item[] = [], texts: TextItem[] = [];
    if (B.caption) {
      const y = B.caption.y;
      rects.push(mkRect({ x: M, y, w: iw, h: R }, P.ink));
      const tag = 'RSTR/' + spec.format, tagW = m(tag, mono, ms).width;
      const cf = fitLine(m, upper(tx.caption.v), mono, ms, MIN.caption, iw - tagW - ms * 2, 0.08, force);
      if (!cf) { if (!force) return null; }
      const base = y + R + ms * 1.45;
      if (cf) texts.push(mkText(m, { slot: 'caption', part: 'line0', font: mono, size: cf.size, tracking: cf.tracking, runs: [{ s: cf.lines[0], x: M, y: base }], fill: P.ink, ink: [P.ink], min: MIN.caption }));
      texts.push(mkText(m, { slot: 'caption', part: 'tag', font: mono, size: ms, runs: [{ s: tag, x: W - M - tagW, y: base }], fill: P.ink, ink: [P.ink], min: MIN.caption }));
      rects.push(mkRect({ x: M, y: y + R + ms * 2.1, w: iw, h: R / 2 }, P.ink));
    }
    if (B.info) {
      const rh = B.info.h / pairs.length, yb = B.info.y;
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
      rects.push(mkRect({ x: M, y: B.info.y + B.info.h - R / 2, w: iw, h: R / 2 }, P.ink));
    }
    if (B.subtitle) {
      const { y: yb, h: bh } = B.subtitle;
      const s = fitLine(m, upper(tx.subtitle.v), mono, Math.round(bh * 0.4), MIN.subtitle, iw - bh * 0.6, 0.1, force);
      if (!s) { if (!force) return null; }
      else {
        rects.push(mkRect({ x: M, y: yb, w: iw, h: bh }, P.ink, { plate: true }));
        const ink = firstInk([P.ground, P.accent], [P.ink], needRatio(s.size));
        texts.push(mkText(m, { slot: 'subtitle', part: 'bar', font: mono, size: s.size, tracking: s.tracking, runs: [{ s: s.lines[0], x: M + bh * 0.3, y: yb + bh * 0.5 + s.size * 0.36 }], fill: ink, ink: [ink], min: MIN.subtitle }));
      }
    }
    if (B.title) {
      const areaTop = B.title.y, areaBot = B.title.y + B.title.h, flip = plan.titleSide === 'bottom', hot = plan.emphasis;
      if (areaBot - areaTop < MIN.title * 1.2) { if (!force) return null; return [...rects, ...texts]; }
      let lines = brutalLines(tx.title.v);
      let fitted = brutalBlock(m, lines, fam, areaBot - areaTop, iw, gap);
      const smallest = (f: typeof fitted) => Math.min(...f.ls.map((o) => 200 * o.s * Math.min(1, f.ky)));
      // the fallback shortens the longest line (then drops the last one) until every line is at least the minimum size
      for (let guard = 0; force && smallest(fitted) < MIN.title && guard < 200; guard++) {
        const widest = fitted.ls.reduce((a, o) => (o.s < a.s ? o : a));
        const words = widest.l.replace(/…$/, '').split(' ');
        if (words.length > 1) lines = lines.map((l) => (l === widest.l ? words.slice(0, -1).join(' ') + '…' : l));
        else if (widest.l.replace(/…$/, '').length > 3) lines = lines.map((l) => (l === widest.l ? widest.l.replace(/…$/, '').slice(0, -1) + '…' : l));
        else if (lines.length > 1) lines = lines.slice(0, -1);
        else break;
        fitted = brutalBlock(m, lines, fam, areaBot - areaTop, iw, gap);
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
    return [...rects, ...texts];
  },
};
