/** Postmodern (spec 8.2): Memphis and new-wave energy. Ported from the spike. */
import { firstInk, mixHex, needRatio } from '../colour';
import { SHAPE_NAMES, SHAPES, patternDraws } from '../graphics/pomo';
import { mkGraphic, mkRect, mkText } from '../items';
import { counted, rng, shuffle } from '../rng';
import type { Item } from '../scene';
import { fit, fitLine } from '../text';
import { textArea, type Style } from './types';
import { fitLines, upper } from './util';

const LAYOUTS = ['title-top', 'title-bottom'];
const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };
const DEG = Math.PI / 180;

export const pomo: Style = {
  id: 'pomo', name: 'Postmodern', blurb: 'Tilt, pattern, shadow', layouts: LAYOUTS, motifs: [], min: MIN, margin: 72,
  build(b) {
    const { W, H, spec, m, P, T, story } = b;
    const M = Math.round(W * 0.0667), { top, bot } = textArea(story, H, M);
    const d = W * 0.013, tx = spec.text, force = b.fallback;
    const A = { ink: P.ink, ground: P.ground, accent: P.accent, accent2: P.accent2 ?? P.accent, accent3: P.accent3 ?? P.ground };
    const items: Item[] = [];
    // ground pattern and shapes, all from the graphic stream
    const rg = counted(rng(spec.seeds.graphic));
    const gp = Math.floor(rg() * 3);
    items.push(mkGraphic('pattern', { x: 0, y: 0, w: W, h: H }, spec.seeds.graphic, 1, { ink: P.ink }, [mixHex(P.ground, P.ink, 0.16)], { kind: gp }));
    for (let i = 0; i < patternDraws(gp); i++) rg();
    // frame
    const li = LAYOUTS.indexOf(spec.pick.layout ?? '');
    const titleTop = li >= 0 ? li === 0 : b.rf() < 0.5;
    b.frame = LAYOUTS[titleTop ? 0 : 1];
    const gx = 3, gy = story ? 5 : spec.format === '3:4' ? 4 : 3;
    const cells: [number, number][] = [];
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) cells.push([i, j]);
    shuffle(rg, cells);
    const count = Math.min(cells.length, story ? 8 : 6);
    cells.slice(0, count).forEach((c, k) => {
      const cw = W / gx, ch = H / gy, s = Math.min(cw, ch) * (0.7 + rg() * 0.55);
      const x = (c[0] + 0.5 + (rg() - 0.5) * 0.5) * cw, y = (c[1] + 0.5 + (rg() - 0.5) * 0.5) * ch;
      const rot = (rg() - 0.5) * 1.4;
      const name = SHAPE_NAMES[(Math.floor(rg() * SHAPE_NAMES.length) + k) % SHAPE_NAMES.length];
      const params = SHAPES[name].choose(rg, A);
      items.push(mkGraphic('shape', { x: 0, y: 0, w: W, h: H }, spec.seeds.graphic, 0, A, Object.values(A), { ...params, shape: name, s, d, k },
        { xf: { x, y, rot }, extent: { x: -s * 0.55, y: -s * 0.55, w: s * 1.1 + d, h: s * 1.1 + d } }));
    });
    // title: one tilted strip per line
    const ang = b.cand([-6, -4, 3, 5]) * DEG;
    const tt = tx.title.on && tx.title.v.trim()
      ? fit(m, { text: upper(tx.title.v), font: T.display, maxW: W - 2 * M - W * 0.1, maxH: W * 0.5, start: Math.round(W * 0.15 * b.cap), min: MIN.title, lh: 1.18, maxLines: 3, force })
      : null;
    if (tx.title.on && tx.title.v.trim() && !tt && !force) return null;
    const subFont = T.serif ?? T.text;
    const ss = tx.subtitle.on && tx.subtitle.v.trim()
      ? fit(m, { text: tx.subtitle.v, font: subFont, maxW: W - 2 * M - W * 0.14, maxH: W * 0.16, start: Math.round(W * 0.066 * Math.max(0.8, b.cap)), min: MIN.subtitle, lh: 1.15, maxLines: 2, force })
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
