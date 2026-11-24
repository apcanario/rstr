/**
 * Brutalist type (spec 8.3): caption strip between rules, info table, subtitle in an ink bar, the title stretched to
 * fill, one line on a full-bleed accent bar. Every title line spans the full width of its area: where the lines
 * cannot fit the height even at the least stretch, words join onto fewer lines (shared/brutal.ts). The title may read
 * up the edge (plan.titleUp) or be split in two parts (boxes.title2). A panel is drawn as a thick border (boxed).
 */
import { firstInk, needRatio } from '../../colour';
import type { Rect, Xf } from '../../geom';
import { mkRect, mkText } from '../../items';
import type { Item, TextItem } from '../../scene';
import { fitLine } from '../../text';
import { breaksFrom, brutalBlock, brutalFit, brutalLines, brutalMetrics, KX_OK } from '../shared/brutal';
import { upper } from '../shared/text';
import type { TypePart } from '../types';

const MIN = { title: 40, subtitle: 16, info: 16, caption: 16 };

export const brutalType: TypePart = {
  id: 'brutal', min: MIN,
  set(c, plan) {
    const { W, H, spec, m, P, T } = c, tx = spec.text, force = c.fallback, B = plan.boxes;
    const { R, ms } = brutalMetrics(W), gap = plan.gutter;
    // a slot with text the layout gave no row cannot be held by this candidate
    const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
    const wants = { caption: tx.caption.on && !!tx.caption.v.trim(), info: tx.info.on && pairs.length > 0, subtitle: tx.subtitle.on && !!tx.subtitle.v.trim(), title: tx.title.on && !!tx.title.v.trim() };
    if (!force && (Object.keys(wants) as (keyof typeof wants)[]).some((s) => wants[s] && !B[s])) return null;
    // the fallback under another style's layout (spec 8.8): a slot it gave no row gets one from the text area,
    // caption at its head, info and the subtitle at its foot, and the title keeps what is left
    if (force && (['caption', 'info', 'subtitle'] as const).some((s) => wants[s] && !B[s])) {
      const X = B.text, own = { ...B };
      let y0 = X.y, y1 = X.y + X.h;
      if (wants.caption && !own.caption) { own.caption = { x: X.x, y: y0, w: X.w, h: R + ms * 2.1 + R / 2 }; y0 += own.caption.h + gap; }
      if (wants.info && !own.info) { const h = pairs.length * Math.round(W * 0.066); own.info = { x: X.x, y: y1 - h, w: X.w, h }; y1 -= h + R * 1.4; }
      if (wants.subtitle && !own.subtitle) { const h = Math.round(W * 0.078); own.subtitle = { x: X.x, y: y1 - h, w: X.w, h }; y1 -= h + gap; }
      if (own.title) { const t0 = Math.max(own.title.y, y0), t1 = Math.min(own.title.y + own.title.h, y1); own.title = { ...own.title, y: t0, h: Math.max(0, t1 - t0) }; }
      return brutalType.set(c, { ...plan, boxes: own }, []);
    }
    const fam = T.display, mono = T.mono;
    const rects: Item[] = [], texts: TextItem[] = [];
    if (B.panel) {
      // the boxed page: a thick border
      const { x, y, w, h } = B.panel, t = R;
      for (const r of [{ x, y, w, h: t }, { x, y: y + h - t, w, h: t }, { x, y, w: t, h }, { x: x + w - t, y, w: t, h }]) rects.push(mkRect(r, P.ink));
    }
    if (B.caption) {
      const { x, y, w } = B.caption;
      rects.push(mkRect({ x, y, w, h: R }, P.ink));
      const tag = 'RSTR/' + spec.format, tagW = m(tag, mono, ms).width;
      const cf = fitLine(m, upper(tx.caption.v), mono, ms, MIN.caption, w - tagW - ms * 2, 0.08, force);
      if (!cf) { if (!force) return null; }
      const base = y + R + ms * 1.45;
      if (cf) texts.push(mkText(m, { slot: 'caption', part: 'line0', font: mono, size: cf.size, tracking: cf.tracking, runs: [{ s: cf.lines[0], x, y: base }], fill: P.ink, ink: [P.ink], min: MIN.caption }));
      texts.push(mkText(m, { slot: 'caption', part: 'tag', font: mono, size: ms, runs: [{ s: tag, x: x + w - tagW, y: base }], fill: P.ink, ink: [P.ink], min: MIN.caption }));
      rects.push(mkRect({ x, y: y + R + ms * 2.1, w, h: R / 2 }, P.ink));
    }
    if (B.info) {
      const { x, w } = B.info, rh = B.info.h / pairs.length, yb = B.info.y, lab = Math.min(ms, Math.round(rh * 0.42));
      for (const [i, it] of pairs.entries()) {
        const ry = yb + i * rh;
        rects.push(mkRect({ x, y: ry, w, h: i ? R / 2 : R }, P.ink));
        if (it.k.trim()) {
          const l = fitLine(m, upper(it.k), mono, lab, MIN.info, w * 0.28, 0.08, force);
          if (!l) { if (!force) return null; }
          else texts.push(mkText(m, { slot: 'info', part: 'label' + i, font: mono, size: l.size, tracking: l.tracking, runs: [{ s: l.lines[0], x, y: ry + rh * 0.66 }], fill: P.ink, ink: [P.ink], min: MIN.info }));
        }
        if (it.v.trim()) {
          // the value's caps stay under the row's rule, measured (tiny rows: the screen layout)
          const room = rh * 0.74 - (i ? R / 2 : R) - 3;
          let start = Math.round(rh * 0.62), v = fitLine(m, upper(it.v), fam, start, MIN.info, w * 0.7, 0, force);
          while (v && v.metrics[0].ascent > room && start > MIN.info) { start = Math.max(MIN.info, Math.floor(start * room / v.metrics[0].ascent)); v = fitLine(m, upper(it.v), fam, start, MIN.info, w * 0.7, 0, force); if (start === MIN.info) break; }
          if (!v) { if (!force) return null; }
          else {
            const mt = v.metrics[0];
            texts.push(mkText(m, { slot: 'info', part: 'value' + i, font: fam, size: v.size, runs: [{ s: v.lines[0], x: x + w - mt.right, y: ry + rh * 0.74 }], fill: P.ink, ink: [P.ink], min: MIN.info }));
          }
        }
      }
      rects.push(mkRect({ x, y: B.info.y + B.info.h - R / 2, w, h: R / 2 }, P.ink));
    }
    if (B.subtitle) {
      const { x, y: yb, w, h: bh } = B.subtitle;
      const s = fitLine(m, upper(tx.subtitle.v), mono, Math.round(bh * 0.4), MIN.subtitle, w - bh * 0.6, 0.1, force);
      if (!s) { if (!force) return null; }
      else {
        rects.push(mkRect({ x, y: yb, w, h: bh }, P.ink, { plate: true }));
        const ink = firstInk([P.ground, P.accent], [P.ink], needRatio(s.size));
        texts.push(mkText(m, { slot: 'subtitle', part: 'bar', font: mono, size: s.size, tracking: s.tracking, runs: [{ s: s.lines[0], x: x + bh * 0.3, y: yb + bh * 0.5 + s.size * 0.36 }], fill: ink, ink: [ink], min: MIN.subtitle }));
      }
    }
    if (B.title && wants.title) {
      const up = !!plan.titleUp, hot = plan.emphasis;
      const all = brutalLines(tx.title.v), typed = upper(tx.title.v).includes('\n');
      // the parts of the title: one, or two where the layout splits it (the first half of the lines on top)
      const n1 = B.title2 ? Math.ceil(all.length / 2) : all.length;
      const parts: { box: Rect; lines: string[]; side: 'top' | 'bottom' }[] = [{ box: B.title, lines: all.slice(0, n1), side: B.title2 ? 'bottom' : plan.titleSide }];
      if (B.title2 && all.length > n1) parts.push({ box: B.title2, lines: all.slice(n1), side: 'top' });
      let idx = 0, count = 0;
      const set: { box: Rect; f: ReturnType<typeof brutalFit>; side: 'top' | 'bottom' }[] = [];
      for (const p of parts) {
        // up the edge the lines run along the strip's height and stack across its width
        const len = up ? p.box.h : p.box.w, A = up ? p.box.w : p.box.h;
        if (A < MIN.title * 1.2) { if (!force) return null; continue; }
        let f = brutalFit(m, breaksFrom(p.lines, typed), fam, A, len, gap);
        // a candidate keeps every line at full width; only the fallback narrows them, and shortens the longest
        // line (then drops the last one) until every line is at least the minimum size
        if (f.kx < KX_OK && !force) return null;
        const smallest = (q: typeof f) => Math.min(...q.ls.map((o) => 200 * o.s * Math.min(1, q.ky)));
        let lines = f.lines;
        for (let guard = 0; force && smallest(f) < MIN.title && guard < 200; guard++) {
          const widest = f.ls.reduce((a, o) => (o.s < a.s ? o : a));
          const words = widest.l.replace(/…$/, '').split(' ');
          if (words.length > 1) lines = lines.map((l) => (l === widest.l ? words.slice(0, -1).join(' ') + '…' : l));
          else if (widest.l.replace(/…$/, '').length > 3) lines = lines.map((l) => (l === widest.l ? widest.l.replace(/…$/, '').slice(0, -1) + '…' : l));
          else if (lines.length > 1) lines = lines.slice(0, -1);
          else break;
          f = { lines, ...brutalBlock(m, lines, fam, A, len, gap) };
        }
        set.push({ box: p.box, f, side: p.side });
        count += f.ls.length;
      }
      const hotAt = count ? hot % count : -1;
      for (const { box, f, side } of set) {
        const len = up ? box.h : box.w, A = up ? box.w : box.h;
        const xf: Xf | undefined = up ? { x: box.x, y: box.y + box.h, rot: -Math.PI / 2 } : undefined;
        const ox = up ? 0 : box.x, oy = up ? 0 : box.y;
        let ty = oy + (side === 'bottom' ? A - f.height : 0);
        f.ls.forEach((o) => {
          const h = o.h * f.ky, on = idx === hotAt;
          // the accent bar bleeds off the canvas both ways, however the page is turned
          // up the edge it stops short of the caption strip above the title, where there is one
          // (its far end, up the page) and of the subtitle bar under it (its near end)
          const far = up && B.caption ? gap / 2 : 2 * (W + H), near = up && B.subtitle ? gap / 2 : 2 * (W + H);
          if (on) rects.push(mkRect({ x: ox - near, y: ty - gap / 2, w: len + near + far, h: h + gap }, P.accent, { plate: true, xf }));
          const ink = on ? firstInk(P.accent === P.ink ? [P.ground, P.ink] : [P.ink, P.ground], [P.accent], 3) : P.ink;
          texts.push(mkText(m, {
            slot: 'title', part: 'line' + idx, font: fam, size: 200, xf,
            runs: [{ s: o.l, x: ox + o.left * o.s, y: ty + o.asc * o.s * f.ky, sx: o.s, sy: o.s * f.ky }],
            fill: ink, ink: [ink], min: MIN.title,
          }));
          ty += h + gap;
          idx++;
        });
      }
    }
    return [...rects, ...texts];
  },
};
