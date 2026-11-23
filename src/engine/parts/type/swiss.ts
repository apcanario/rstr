/**
 * Swiss type (spec 8.1): flush left on the axis column, heavy title with tight tracking, regular subtitle,
 * info as label/value columns above a rule, caption under it. Sizes are set against the canvas width, not the
 * page, so a tilted or turned page gives the text less room, never smaller type (graphics pay for the tilt).
 */
import { firstInk } from '../../colour';
import { mkRect, mkText } from '../../items';
import type { Item } from '../../scene';
import { fit, fitLine } from '../../text';
import { upper } from '../shared/text';
import type { SizeClass, TypePart } from '../types';

const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };
/** Title size classes (spec 8.0): the start size, as a share of the normal one, and the most lines. */
const SIZE: Record<SizeClass, { k: number; lines: number }> = { small: { k: 0.55, lines: 2 }, normal: { k: 1, lines: 3 }, oversize: { k: 1.5, lines: 4 } };

export const swissType: TypePart = {
  id: 'swiss', min: MIN,
  set(c, plan) {
    const { W, spec, m, P, T } = c, tx = spec.text;
    if (!plan.vals.any) return [];
    const TR = plan.boxes.text, panel = plan.boxes.panel ?? null;
    const axis = Number(plan.vals.axis), mod = Number(plan.vals.mod), G = Number(plan.vals.G);
    const cls = SIZE[(plan.vals.size as SizeClass) ?? 'normal'] ?? SIZE.normal;
    const items: Item[] = [];
    if (panel) items.push(mkRect(panel, P.ground, { plate: true }));
    const force = c.fallback;
    const ax = TR.x + (panel ? 0 : axis * mod), aw = TR.w - (panel ? 0 : axis * mod);
    const capS = Math.round(W * 0.0185), infS = Math.round(W * 0.026), labS = Math.round(W * 0.017), subS = Math.round(W * 0.036);
    const label = T.label ?? T.text;
    let yb = TR.y + TR.h;
    // caption and its rule, from the bottom
    if (tx.caption.on && tx.caption.v.trim()) {
      const c = fitLine(m, upper(tx.caption.v), T.mono, capS, MIN.caption, TR.w, 0.12, force);
      if (!c) { if (!force) return null; }
      else {
        const base = yb - c.desc;
        items.push(mkText(m, { slot: 'caption', part: 'line0', font: T.mono, size: c.size, tracking: c.tracking, runs: [{ s: c.lines[0], x: TR.x, y: base }], fill: P.ink, ink: [P.ink], min: MIN.caption }));
        const rh = Math.max(2, W * 0.003);
        yb = base - c.asc - G * 0.55;
        items.push(mkRect({ x: TR.x, y: yb - rh, w: TR.w, h: rh }, P.ink));
        yb -= rh + G * 0.9;
      }
    }
    // info: up to three label / value columns on the axis
    if (tx.info.on) {
      const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
      const cw = (TR.w - (ax - TR.x)) / Math.max(pairs.length, panel ? 2 : 3);
      const tops: number[] = [];
      const labInk = firstInk([P.accent, P.ink], [P.ground], 4.5);
      pairs.forEach((it, i) => {
        const x = ax + i * cw;
        let colTop = yb;
        if (it.v.trim()) {
          const v = fit(m, { text: it.v, font: T.text, maxW: cw - G * 0.5, maxH: infS * 2.4, start: infS, min: MIN.info, lh: 1.2, maxLines: 2, force });
          if (!v) { if (!force) { tops.push(NaN); return; } }
          else {
            const vy = yb - v.desc - (v.lines.length - 1) * v.size * 1.2;
            items.push(mkText(m, { slot: 'info', part: 'value' + i, font: T.text, size: v.size, runs: v.lines.map((l, j) => ({ s: l, x, y: vy + j * v.size * 1.2 })), fill: P.ink, ink: [P.ink], min: MIN.info }));
            colTop = vy - v.asc;
          }
        }
        if (it.k.trim()) {
          const l = fitLine(m, upper(it.k), label, labS, MIN.info, cw - G * 0.5, 0.14, force);
          if (!l) { if (!force) { tops.push(NaN); return; } }
          else {
            const ly = colTop - labS * 0.45 - l.desc;
            items.push(mkText(m, { slot: 'info', part: 'label' + i, font: label, size: l.size, tracking: l.tracking, runs: [{ s: l.lines[0], x, y: ly }], fill: labInk, ink: [labInk], min: MIN.info }));
            colTop = ly - l.asc;
          }
        }
        tops.push(colTop);
      });
      if (tops.some((t) => Number.isNaN(t))) return null;
      if (tops.length) yb = Math.min(...tops) - G;
    }
    // title and subtitle from the top, spaced by ink
    let y = TR.y;
    const room = yb - TR.y;
    if (tx.title.on && tx.title.v.trim()) {
      const maxH = room - (tx.subtitle.on ? subS * 1.3 + G : 0);
      const t = maxH > 0 ? fit(m, { text: tx.title.v, font: T.display, maxW: aw, maxH, start: W * 0.15 * c.cap * cls.k, min: MIN.title, lh: 0.94, maxLines: cls.lines, track: -0.028, force }) : null;
      if (!t) { if (!force) return null; }
      else {
        items.push(mkText(m, {
          slot: 'title', part: 'block', font: T.display, size: t.size, tracking: t.tracking,
          runs: t.lines.map((l, i) => ({ s: l, x: ax + t.metrics[i].left, y: y + t.asc + i * t.size * 0.94 })),
          fill: P.ink, ink: [P.ink], min: MIN.title,
        }));
        y += t.asc + (t.lines.length - 1) * t.size * 0.94 + t.desc + G;
      }
    }
    if (tx.subtitle.on && tx.subtitle.v.trim()) {
      const font = T.serif ?? T.text;
      const s = yb - y > 0 ? fit(m, { text: tx.subtitle.v, font, maxW: aw, maxH: yb - y, start: subS, min: MIN.subtitle, lh: 1.18, maxLines: 2, force }) : null;
      if (!s) { if (!force) return null; }
      else items.push(mkText(m, { slot: 'subtitle', part: 'block', font, size: s.size, runs: s.lines.map((l, i) => ({ s: l, x: ax, y: y + s.asc + i * s.size * 1.18 })), fill: P.ink, ink: [P.ink], min: MIN.subtitle }));
    }
    return items;
  },
};
