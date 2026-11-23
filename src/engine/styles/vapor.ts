/** Vaporwave (spec 8.4): gradient sky, slit sun, grid floor, chrome title. Ported from the spike. */
import { firstInk, needRatio } from '../colour';
import { OUTLINE_MIN, sample } from '../invariants';
import { bounds, overlaps, pad, rectQuad, type Rect } from '../geom';
import { mkGraphic, mkRect, mkText } from '../items';
import { pick } from '../rng';
import type { GraphicItem, Item, Linear } from '../scene';
import { fit, fitLine } from '../text';
import { textArea, type Style } from './types';
import { fitLines, upper } from './util';

const MIN = { title: 40, subtitle: 16, info: 16, caption: 16 };

export const vapor: Style = {
  id: 'vapor', name: 'Vaporwave', blurb: 'Sun, grid, chrome', layouts: ['title-sky', 'title-floor'], motifs: [], min: MIN, margin: 72,
  build(b) {
    const { W, H, spec, m, P, T, story } = b;
    const M = Math.round(W * 0.0667), { top, bot } = textArea(story, H, M), tx = spec.text, force = b.fallback;
    const sky = P.gradient ?? [P.ground, P.ground];
    const chrome = P.chrome ?? P.window ?? P.ground, win = P.window ?? P.ground, winInk = P.windowInk ?? P.ink;
    const A2 = P.accent2 ?? P.accent, A3 = P.accent3 ?? P.accent;
    // frame, in the spike's order: horizon, sun x, sun radius, sun height, then title side and window side
    const hz = Math.round(H * (0.56 + b.rf() * 0.08));
    const sunX = W * pick(b.rf, [0.5, 0.5, 0.3, 0.7]), sunR = W * (0.24 + b.rf() * 0.1);
    const sy = hz - sunR * (0.25 + b.rf() * 0.3);
    const li = ['title-sky', 'title-floor'].indexOf(spec.pick.layout ?? '');
    const upperPos = b.cand([true, false], false);
    const isUpper = li >= 0 ? li === 0 : upperPos;
    b.frame = isUpper ? 'title-sky' : 'title-floor';
    const right = b.cand([true, false]);

    const items: Item[] = [];
    const skyPaint: Linear = { kind: 'linear', x0: 0, y0: 0, x1: 0, y1: hz, stops: sky.map((c, i) => [i / (sky.length - 1), c]) };
    items.push(mkRect({ x: 0, y: 0, w: W, h: hz }, skyPaint));
    items.push(mkRect({ x: 0, y: hz, w: W, h: H - hz }, P.ground));
    const starsG = mkGraphic('stars', { x: 0, y: 0, w: W, h: hz }, spec.seeds.graphic, 0, { ink: P.ink, ground: P.ground }, [P.ink], { W, hz }, { extent: { x: 0, y: 0, w: W, h: hz * 0.7 + W * 0.01 } });
    const sunTop = Math.max(0, sy - sunR);
    const sunG = mkGraphic('sun', { x: 0, y: 0, w: W, h: hz }, 0, 0, { accent3: A3, accent: P.accent, sky1: sky[1] ?? sky[0] }, [A3, P.accent, sky[1] ?? sky[0]], { x: sunX, y: sy, r: sunR },
      { extent: { x: sunX - sunR, y: sunTop, w: 2 * sunR, h: Math.max(0, Math.min(sy + sunR, hz) - sunTop) } });
    const gridG = mkGraphic('grid', { x: 0, y: hz, w: W, h: H - hz }, 0, 0, { line: A2 }, [A2], {});
    const horizonG = mkGraphic('horizon', { x: 0, y: hz - W * 0.03, w: W, h: W * 0.06 }, 0, 0, { accent: P.accent }, [P.accent], { W, hz });
    items.push(starsG, sunG, gridG, horizonG);

    const texts: Item[] = [];
    // light ink on the floor and dark skies, dark ink where the sky is pale: whichever reads against what is behind
    // the sun's colours count too where the box overlaps the sun, as behind() counts them
    const inkFor = (r: Rect, px: number) => {
      const bg = r.y + r.h <= hz ? sample(skyPaint, rectQuad(r)) : r.y >= hz ? [P.ground] : [...sample(skyPaint, rectQuad(r)), P.ground];
      if (overlaps(rectQuad(r), sunG.quad)) bg.push(...sunG.fills);
      return firstInk([P.ink, winInk], bg, needRatio(px));
    };
    let ty = isUpper ? top + W * 0.02 : hz + W * 0.07;
    if (tx.title.on && tx.title.v.trim()) {
      const t = fit(m, { text: upper(tx.title.v), font: T.display, maxW: W - 2 * M, maxH: isUpper ? (hz - top) * 0.42 : (bot - hz) * 0.5, start: Math.round(W * 0.14 * b.cap), min: MIN.title, lh: 1.08, maxLines: 3, force });
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
      const c = fitLine(m, upper(tx.caption.v), T.mono, Math.round(W * 0.019), MIN.caption, W - 2 * M, 0.2, force);
      if (!c) { if (!force) return null; }
      else {
        const mt = c.metrics[0], cInk = inkFor({ x: 0, y: bot - c.height, w: W, h: c.height }, c.size);
        texts.push(mkText(m, { slot: 'caption', part: 'line0', font: T.mono, size: c.size, tracking: c.tracking, runs: [{ s: c.lines[0], x: (W - (mt.left + mt.right)) / 2 + mt.left, y: bot - c.desc }], fill: cInk, ink: [cInk], min: MIN.caption }));
      }
    }
    // stars and grid stay a halo away from every glyph, so no line or star lies directly behind the type
    const knockPad = Math.round(W * 0.012);
    const holes: ReturnType<typeof rectQuad>[] = [], glyphs: number[] = [], boxes: ReturnType<typeof rectQuad>[] = [];
    texts.forEach((t, i) => {
      if (t.kind !== 'text') return;
      const box = rectQuad(pad(bounds(t.quad), knockPad));
      holes.push(box);
      if (t.px >= 60) glyphs.push(items.length + i); else boxes.push(box);
    });
    for (const g of [starsG, gridG] as GraphicItem[]) { g.avoid = holes; g.knock = { glyphs, boxes, pad: knockPad }; }
    return [...items, ...texts];
  },
};
