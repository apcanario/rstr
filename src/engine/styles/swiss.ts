/** Swiss (spec 8.1): after Müller-Brockmann, the grid is the design. Ported from the spike. */
import { firstInk } from '../colour';
import { mkGraphic, mkRect, mkText } from '../items';
import { counted, pick, rng } from '../rng';
import type { Item } from '../scene';
import { SLOTS } from '../spec';
import { fit, fitLine } from '../text';
import { textArea, type Style } from './types';
import { upper } from './util';

const MOTIFS = ['topo', 'blocks', 'bars', 'dots', 'disc'];
const LAYOUTS = ['graphic-above', 'graphic-below', 'full-bleed'];
const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };

export const swiss: Style = {
  id: 'swiss', name: 'Swiss', blurb: 'Grid, one accent', layouts: LAYOUTS, motifs: MOTIFS, min: MIN, margin: 72,
  build(b) {
    const { W, H, spec, m, P, T, story } = b;
    const M = Math.round(W * 0.0667), cols = 6, mod = (W - 2 * M) / cols, G = Math.round(W * 0.028);
    const { top, bot } = textArea(story, H, M), innerH = bot - top;
    // frame, in the spike's order: archetype, axis (a candidate), then bleed or panel side
    const li = LAYOUTS.indexOf(spec.pick.layout ?? '');
    const arche = li >= 0 ? li : Math.floor(b.rf() * 3);
    const axis = b.cand([0, 0, 1, 2]);
    const flag = b.rf() < 0.5;
    const tx = spec.text, any = SLOTS.some((s) => tx[s].on);
    // graphic stream: the motif and its inversion, then the motif draws on from the same stream
    const rg = counted(rng(spec.seeds.graphic));
    const motif = spec.pick.motif && MOTIFS.includes(spec.pick.motif) ? spec.pick.motif : pick(rg, MOTIFS);
    const invert = motif === 'topo' ? rg() < 0.45 : false;

    let MR = { x: 0, y: 0, w: W, h: H }, TR = { x: M, y: top, w: W - 2 * M, h: innerH }, panel = null as null | { x: number; y: number; w: number; h: number };
    if (any && arche === 2) {
      const ph = Math.round(innerH * (story ? 0.4 : 0.5) / mod) * mod, atTop = flag;
      panel = { x: 0, y: atTop ? 0 : H - (ph + (H - bot) + M * 0.6), w: M + mod * 5, h: ph + (atTop ? top : H - bot) + M * 0.6 };
      TR = { x: M, y: atTop ? top : panel.y + M * 0.6, w: mod * 5 - M * 0.6, h: ph };
    } else if (any) {
      const frac = spec.format === '1:1' ? 0.47 : 0.52, mh = Math.round(innerH * frac / mod) * mod, bleed = flag;
      if (arche === 0) {
        MR = bleed ? { x: 0, y: 0, w: W, h: top + mh } : { x: M, y: top, w: W - 2 * M, h: mh };
        TR = { x: M, y: top + mh + G * 1.4, w: W - 2 * M, h: innerH - mh - G * 1.4 };
      } else {
        MR = bleed ? { x: 0, y: bot - mh, w: W, h: H - bot + mh } : { x: M, y: bot - mh, w: W - 2 * M, h: mh };
        TR = { x: M, y: top, w: W - 2 * M, h: innerH - mh - G * 1.4 };
      }
    }
    const items: Item[] = [];
    const colours: Record<string, string> = motif === 'topo'
      ? (invert ? { line: P.ground, hi: P.ground, fill: P.accent } : { line: P.ink, hi: P.accent })
      : { accent: P.accent, ink: P.ink, ground: P.ground };   // one accent (spec 8.1): ground, ink, accent, nothing else
    items.push(mkGraphic(motif, MR, spec.seeds.graphic, rg.n, colours, [...new Set(Object.values(colours))], { W, mod }));
    if (!any) return items;
    if (panel) items.push(mkRect(panel, P.ground, { plate: true }));

    const force = b.fallback;
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
      const t = maxH > 0 ? fit(m, { text: tx.title.v, font: T.display, maxW: aw, maxH, start: W * 0.15 * b.cap, min: MIN.title, lh: 0.94, maxLines: 3, track: -0.028, force }) : null;
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
