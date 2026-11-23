/** Postmodern type (spec 8.2, ice cream): tilted title strips with hard shadows, the subtitle on a highlight plate, info in a bordered box, caption up the left edge. */
import { firstInk, needRatio } from '../../colour';
import { mkRect, mkText } from '../../items';
import type { Item } from '../../scene';
import { fit, fitLine } from '../../text';
import { fitLines, upper } from '../shared/text';
import type { TypePart } from '../types';

const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };

export const pomoType: TypePart = {
  id: 'pomo', min: MIN,
  set(c, plan) {
    const { W, spec, m, P, T, top, bot } = c;
    const M = Math.round(W * 0.0667);
    const d = W * 0.013, tx = spec.text, force = c.fallback;
    const A = { ink: P.ink, ground: P.ground, accent: P.accent, accent2: P.accent2 ?? P.accent, accent3: P.accent3 ?? P.ground };
    const items: Item[] = [];
    const titleTop = plan.vals.titleTop === true, ang = Number(plan.vals.ang);
    const tt = tx.title.on && tx.title.v.trim()
      ? fit(m, { text: upper(tx.title.v), font: T.display, maxW: W - 2 * M - W * 0.1, maxH: W * 0.5, start: Math.round(W * 0.15 * c.cap), min: MIN.title, lh: 1.18, maxLines: 3, force })
      : null;
    if (tx.title.on && tx.title.v.trim() && !tt && !force) return null;
    const subFont = T.serif ?? T.text;
    const ss = tx.subtitle.on && tx.subtitle.v.trim()
      ? fit(m, { text: tx.subtitle.v, font: subFont, maxW: W - 2 * M - W * 0.14, maxH: W * 0.16, start: Math.round(W * 0.066 * Math.max(0.8, c.cap)), min: MIN.subtitle, lh: 1.15, maxLines: 2, force })
      : null;
    if (tx.subtitle.on && tx.subtitle.v.trim() && !ss && !force) return null;
    const titleH = tt ? tt.lines.length * tt.size * 1.2 + W * 0.09 : 0, subH = ss ? ss.lines.length * ss.size * 1.15 + W * 0.05 : 0;
    const ty = titleTop ? top + W * 0.04 : bot - titleH - subH - W * 0.04;
    let blockBottom = ty;
    if (tt) {
      const xf = { x: M, y: ty, rot: ang }, fills = [P.ink, A.accent, A.accent2];
      tt.lines.forEach((l, i) => {
        const w = m(l, T.display, tt.size).width, padX = tt.size * 0.16, h = tt.size * 1.06;
        const y = i * tt.size * 1.2 + (ang < 0 ? W * 0.07 : 0), x = i * tt.size * 0.22, fc = fills[i % 3];
        items.push(mkRect({ x, y, w: w + padX * 2, h }, fc, { xf, plate: true, shadow: { dx: d, dy: d, fill: P.ink } }));
        const order = fc === A.accent2 ? [P.ink, P.ground] : [P.ground, P.ink];
        const ink = firstInk(order, [fc], needRatio(tt.size));
        items.push(mkText(m, { slot: 'title', part: 'line' + i, font: T.display, size: tt.size, runs: [{ s: l, x: x + padX, y: y + tt.size * 0.86 }], xf, fill: ink, ink: [ink], min: MIN.title }));
      });
      blockBottom = ty + titleH;
    }
    if (ss) {
      const xf = { x: M + W * 0.04, y: blockBottom, rot: -ang * 0.5 };
      const ink = firstInk([P.ink, P.ground], [A.accent3], needRatio(ss.size));
      ss.lines.forEach((l, i) => {
        const w = m(l, subFont, ss.size).width;
        items.push(mkRect({ x: -ss.size * 0.2, y: i * ss.size * 1.15, w: w + ss.size * 0.4, h: ss.size * 1.12 }, A.accent3, { xf, plate: true, shadow: { dx: d * 0.6, dy: d * 0.6, fill: P.ink } }));
        items.push(mkText(m, { slot: 'subtitle', part: 'line' + i, font: subFont, size: ss.size, runs: [{ s: l, x: 0, y: i * ss.size * 1.15 + ss.size * 0.82 }], xf, fill: ink, ink: [ink], min: MIN.subtitle }));
      });
    }
    // info: mono in a bordered box with a shadow
    if (tx.info.on) {
      const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
      if (pairs.length) {
        const fs0 = Math.round(W * 0.024);
        const strs = pairs.map((p) => (upper(p.k) + '  ' + p.v).trim());
        const f = fitLines(m, strs, T.mono, fs0, MIN.info, (W - 2 * M) * 0.62 - fs0 * 1.8, 0, force);
        if (!f) { if (!force) return null; }
        else {
          const fs = f.size, lh = fs * 1.55, pad = fs * 0.9;
          const bw = Math.max(...f.lines.map((l) => m(l, T.mono, fs).width)) + pad * 2, bh = f.lines.length * lh + pad * 1.5;
          const bx = W - M - bw, by = titleTop ? bot - bh - (tx.caption.on ? W * 0.02 : 0) : top + W * 0.02;
          const xf = { x: bx + bw / 2, y: by + bh / 2, rot: ang * 0.4 };
          items.push(mkRect({ x: -bw / 2, y: -bh / 2, w: bw, h: bh }, P.ground, { xf, plate: true, shadow: { dx: d, dy: d, fill: P.ink }, stroke: { colour: P.ink, width: Math.max(2, W * 0.004) } }));
          items.push(mkText(m, { slot: 'info', part: 'box', font: T.mono, size: fs, runs: f.lines.map((l, i) => ({ s: l, x: -bw / 2 + pad, y: -bh / 2 + pad * 0.6 + (i + 0.72) * lh })), xf, fill: P.ink, ink: [P.ink], min: MIN.info }));
        }
      }
    }
    // caption: mono up the left edge on a ground strip
    if (tx.caption.on && tx.caption.v.trim()) {
      const fs0 = Math.round(W * 0.019);
      const c = fitLine(m, upper(tx.caption.v), T.mono, fs0, MIN.caption, (bot - top) * 0.9, 0.18, force);
      if (!c) { if (!force) return null; }
      else {
        const fs = c.size, w = m(c.lines[0], T.mono, fs, c.tracking).width + fs * 1.2;
        const xf = { x: M * 0.42, y: bot, rot: -Math.PI / 2 };
        items.push(mkRect({ x: -fs * 0.5, y: -fs * 0.2, w, h: fs * 1.5 }, P.ground, { xf, plate: true }));
        items.push(mkText(m, { slot: 'caption', part: 'line0', font: T.mono, size: fs, tracking: c.tracking, runs: [{ s: c.lines[0], x: 0, y: fs * 0.9 }], xf, fill: P.ink, ink: [P.ink], min: MIN.caption }));
      }
    }
    return items;
  },
};
