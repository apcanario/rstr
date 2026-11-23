/** Vaporwave type (spec 8.4): the chrome title with outline and echoes, wide subtitle, the info window, the caption; ink read from what lies behind in the Scene. */
import { firstInk, needRatio } from '../../colour';
import { overlaps, rectQuad, type Rect } from '../../geom';
import { OUTLINE_MIN, sample } from '../../invariants';
import { mkRect, mkText } from '../../items';
import type { GraphicItem, Item, Linear, RectItem } from '../../scene';
import { fit, fitLine } from '../../text';
import { fitLines, upper } from '../shared/text';
import type { TypePart } from '../types';

const MIN = { title: 40, subtitle: 16, info: 16, caption: 16 };

export const vaporType: TypePart = {
  id: 'vapor', min: MIN,
  set(c, plan, below) {
    const { W, spec, m, P, T, top, bot } = c;
    const M = Math.round(W * 0.0667), tx = spec.text, force = c.fallback;
    const hz = Number(plan.vals.hz), isUpper = plan.vals.isUpper === true, right = plan.vals.right === true;
    const sky = P.gradient ?? [P.ground, P.ground];
    const chrome = P.chrome ?? P.window ?? P.ground, win = P.window ?? P.ground, winInk = P.windowInk ?? P.ink;
    const A2 = P.accent2 ?? P.accent, A3 = P.accent3 ?? P.accent;
    // what lies behind, read from the Scene: the sky's paint and the sun
    const skyRect = below.find((i): i is RectItem => i.kind === 'rect' && typeof i.fill !== 'string');
    const skyPaint: Linear = skyRect ? (skyRect.fill as Linear) : { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: hz, stops: [[0, P.ground], [1, P.ground]] };
    const sunG = below.find((i): i is GraphicItem => i.kind === 'graphic' && i.name === 'sun');
    const texts: Item[] = [];
    // light ink on the floor and dark skies, dark ink where the sky is pale: whichever reads against what is behind
    // the sun's colours count too where the box overlaps the sun, as behind() counts them
    const inkFor = (r: Rect, px: number) => {
      const bg = r.y + r.h <= hz ? sample(skyPaint, rectQuad(r)) : r.y >= hz ? [P.ground] : [...sample(skyPaint, rectQuad(r)), P.ground];
      if (sunG && overlaps(rectQuad(r), sunG.quad)) bg.push(...sunG.fills);
      return firstInk([P.ink, winInk], bg, needRatio(px));
    };
    let ty = isUpper ? top + W * 0.02 : hz + W * 0.07;
    if (tx.title.on && tx.title.v.trim()) {
      const t = fit(m, { text: upper(tx.title.v), font: T.display, maxW: W - 2 * M, maxH: isUpper ? (hz - top) * 0.42 : (bot - hz) * 0.5, start: Math.round(W * 0.14 * c.cap), min: MIN.title, lh: 1.08, maxLines: 3, force });
      if (!t) { if (!force) return null; }
      else {
        const d = t.size * 0.055;
        const tInk = inkFor({ x: 0, y: ty - d, w: W, h: t.height + 2 * d }, t.size);
        texts.push(mkText(m, {
          slot: 'title', part: 'chrome', font: T.display, size: t.size,
          runs: t.lines.map((l, i) => { const mt = t.metrics[i]; return { s: l, x: (W - (mt.left + mt.right)) / 2 + mt.left, y: ty + t.asc + i * t.size * 1.08 }; }),
          fill: { kind: 'linear', em: true, x0: 0, y0: -0.75, x1: 0, y1: 0, stops: [[0, chrome], [0.48, A3], [0.52, sky[1] ?? sky[0]], [1, P.accent]] },
          stroke: { paint: tInk, width: Math.max(2, t.size * OUTLINE_MIN) },
          echoes: [{ dx: d, dy: d, paint: P.accent }, { dx: -d * 0.5, dy: -d * 0.5, paint: A2 }],
          ink: [tInk], min: MIN.title,
        }));
        ty += t.asc + (t.lines.length - 1) * t.size * 1.08 + t.desc + W * 0.03;
      }
    }
    if (tx.subtitle.on && tx.subtitle.v.trim()) {
      const s = fitLine(m, upper(tx.subtitle.v), T.text, Math.round(W * 0.03), MIN.subtitle, W - 2 * M, 0.42, force);
      if (!s) { if (!force) return null; }
      else {
        const mt = s.metrics[0], sInk = inkFor({ x: 0, y: ty, w: W, h: s.height }, s.size);
        texts.push(mkText(m, { slot: 'subtitle', part: 'line0', font: T.text, size: s.size, tracking: s.tracking, runs: [{ s: s.lines[0], x: (W - (mt.left + mt.right)) / 2 + mt.left, y: ty + s.asc }], fill: sInk, ink: [sInk], min: MIN.subtitle }));
      }
    }
    if (tx.info.on) {
      const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
      if (pairs.length) {
        const px = T.pixel ?? T.mono, fs0 = Math.round(W * 0.021);
        const f = fitLines(m, pairs.map((p) => (upper(p.k) + ': ' + p.v).trim()), px, fs0, MIN.info, W - 2 * M - fs0 * 2, 0, force);
        if (!f) { if (!force) return null; }
        else {
          const fs = f.size, lh = fs * 1.7, padX = fs, bar = fs * 1.8;
          const bw = Math.max(W * 0.34, Math.max(...f.lines.map((l) => m(l, px, fs).width)) + padX * 2), bh = bar + f.lines.length * lh + padX;
          const bx = right ? W - M - bw : M, by = isUpper ? hz + (bot - hz - bh) * 0.45 : top + W * 0.03;
          texts.push(mkRect({ x: bx, y: by, w: bw, h: bh }, win, { plate: true, shadow: { dx: fs * 0.5, dy: fs * 0.5, fill: P.accent }, stroke: { colour: winInk, width: Math.max(2, W * 0.003) } }));
          texts.push(mkRect({ x: bx, y: by, w: bw, h: bar }, sky[1] ?? sky[0], { plate: true }));
          for (let i = 0; i < 3; i++) texts.push(mkRect({ x: bx + bw - (i + 1) * bar * 0.62 - padX * 0.2, y: by + bar * 0.28, w: bar * 0.42, h: bar * 0.42 }, chrome));
          const barInk = firstInk([chrome, winInk], [sky[1] ?? sky[0]], needRatio(fs));
          texts.push(mkText(m, { slot: 'info', part: 'bar', font: px, size: fs, runs: [{ s: 'INFO.TXT', x: bx + padX * 0.7, y: by + bar * 0.72 }], fill: barInk, ink: [barInk], min: MIN.info }));
          texts.push(mkText(m, { slot: 'info', part: 'lines', font: px, size: fs, runs: f.lines.map((l, i) => ({ s: l, x: bx + padX, y: by + bar + (i + 0.95) * lh })), fill: winInk, ink: [winInk], min: MIN.info }));
        }
      }
    }
    if (tx.caption.on && tx.caption.v.trim()) {
      const cf = fitLine(m, upper(tx.caption.v), T.mono, Math.round(W * 0.019), MIN.caption, W - 2 * M, 0.2, force);
      if (!cf) { if (!force) return null; }
      else {
        const mt = cf.metrics[0], cInk = inkFor({ x: 0, y: bot - cf.height, w: W, h: cf.height }, cf.size);
        texts.push(mkText(m, { slot: 'caption', part: 'line0', font: T.mono, size: cf.size, tracking: cf.tracking, runs: [{ s: cf.lines[0], x: (W - (mt.left + mt.right)) / 2 + mt.left, y: bot - cf.desc }], fill: cInk, ink: [cInk], min: MIN.caption }));
      }
    }
    return texts;
  },
};
