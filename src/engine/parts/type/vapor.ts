/**
 * Vaporwave type (spec 8.4): the chrome title (gradient fill split at the middle, an outline in the ink that reads,
 * two offset copies in accent colours), the wide-tracked subtitle under it, the info window with its title bar and
 * three squares, the caption centred at the foot in mono. A window or a band the layout gives the title is drawn
 * here as its plate. Each ink is read from what lies behind it in the Scene (ground, plates, and every graphic that
 * does not keep a halo off the type), mapped into the world through the plan's transform.
 *
 * Outline next to the echoes (Carried R9, revisited): the outline stays the ink that carries legibility (spec 9.2
 * rule 4 reads it, OUTLINE_MIN of the size): the chrome fill's light stops cannot hold on a pale sky, and the echoes
 * are the title's own ink, so the outline is what keeps the title legible on every palette.
 */
import { capControl } from '../../controls';
import { firstInk, needRatio } from '../../colour';
import { overlaps, rectQuad, contains, xfQuad, type Rect } from '../../geom';
import { OUTLINE_MIN, sample } from '../../invariants';
import { mkRect, mkText } from '../../items';
import type { Item, Paint } from '../../scene';
import { fit, fitLine, inkW, type Fit } from '../../text';
import type { Measure } from '../../measure';
import type { FontRef } from '../../scene';
import { fitLines, upper } from '../shared/text';
import type { TypePart } from '../types';

const MIN = { title: 40, subtitle: 16, info: 16, caption: 16 };

export const vaporType: TypePart = {
  id: 'vapor', min: MIN,
  controls: () => [capControl()],
  set(c, plan, below) {
    const { W, spec, m, P, T } = c;
    const tx = spec.text, force = c.fallback, B = plan.boxes, xf = plan.xf;
    const sky = P.gradient ?? [P.ground, P.ground];
    const chrome = P.chrome ?? P.window ?? P.ground, win = P.window ?? P.ground, winInk = P.windowInk ?? P.ink;
    const A2 = P.accent2 ?? P.accent, A3 = P.accent3 ?? P.accent, sky1 = sky[1] ?? sky[0];
    const plates: Item[] = [], texts: Item[] = [];
    // every colour that can sit behind a local rect: what behind() of spec 9.2 will read, from the Scene so far and
    // the plates set here (a graphic marked to keep off the type is not behind it)
    const behindOf = (r: Rect): string[] => {
      const q = xfQuad(xf, rectQuad(r)), out = new Set<string>();
      const all = [...below, ...plates.map((p) => (p.kind === 'rect' ? { ...p, quad: xfQuad(xf, p.quad) , shadowQuad: p.shadowQuad && xfQuad(xf, p.shadowQuad) } : p))];
      for (let j = all.length - 1; j >= 0; j--) {
        const it = all[j];
        if (it.kind === 'text') continue;
        if (it.kind === 'graphic') { if (!it.knock && overlaps(it.quad, q)) it.fills.forEach((x) => out.add(x)); continue; }
        if (overlaps(it.quad, q)) { sample(it.fill, q).forEach((x) => out.add(x)); if (contains(it.quad, q)) return [...out]; }
        if (it.shadowQuad && it.shadow && overlaps(it.shadowQuad, q)) { out.add(it.shadow.fill); if (contains(it.shadowQuad, q)) return [...out]; }
      }
      out.add(P.ground);
      return [...out];
    };
    const inkFor = (r: Rect, px: number) => firstInk([P.ink, winInk, P.ground, win], behindOf(r), needRatio(px));

    // plates the layout asked for: the title's window or the band across the horizon
    const panel = B.panel;
    let pad = 0;
    if (panel && plan.frame === 'title-band') {
      plates.push(mkRect(panel, win, { plate: true }));
      const rl = Math.max(3, Math.round(W * 0.006));
      plates.push(mkRect({ x: panel.x, y: panel.y - rl * 2, w: panel.w, h: rl }, P.accent, { plate: true }));
      plates.push(mkRect({ x: panel.x, y: panel.y + panel.h + rl, w: panel.w, h: rl }, A2, { plate: true }));
    } else if (panel) {
      const bar = Math.round(W * 0.045);
      plates.push(mkRect(panel, win, { plate: true, shadow: { dx: W * 0.014, dy: W * 0.014, fill: P.accent }, stroke: { colour: winInk, width: Math.max(2, W * 0.003) } }));
      plates.push(mkRect({ x: panel.x, y: panel.y, w: panel.w, h: bar }, sky1, { plate: true }));
      for (let i = 0; i < 3; i++) plates.push(mkRect({ x: panel.x + panel.w - (i + 1) * bar * 0.62 - bar * 0.2, y: panel.y + bar * 0.28, w: bar * 0.42, h: bar * 0.42 }, chrome));
      pad = bar;
    }

    // the title block: title and subtitle, stacked, in the title box
    const box = B.title ?? B.text;
    const inner: Rect = panel ? { x: box.x + W * 0.03, y: box.y + pad + W * 0.02, w: box.w - W * 0.06, h: box.h - pad - W * 0.04 } : box;
    const sOn = tx.subtitle.on && !!tx.subtitle.v.trim(), tOn = tx.title.on && !!tx.title.v.trim();
    const subStart = Math.round(W * 0.03), subGap = Math.round(W * 0.03);
    const subRoom = sOn ? subStart * 1.3 + subGap : 0;
    let t: Fit | null = null, s: Fit | null = null;
    if (tOn) {
      const size = { small: 0.72, normal: 1, oversize: 1.3 }[plan.size];
      const o = { text: upper(tx.title.v), font: T.display, maxW: inner.w, maxH: Math.max(0, (inner.h - subRoom) / (1 + 0.055 * 1.5 + 2 * OUTLINE_MIN)), start: Math.round(W * 0.14 * c.cap * size), min: MIN.title, lh: 1.08, maxLines: 4, force };
      t = fit(m, o);
      if (!t) { if (!force) return null; }
      else if (t.lines.length > 1 && !t.shortened && !o.text.includes('\n')) {
        // balance the lines (spec 8.4 centres the title; no last word left alone): the breaks that give the narrowest
        // block at the same size and line count, with at least two words on the last line where there are words to spare
        const b = balanced(m, o.text, o.font, t.size, t.lines.length, inner.w);
        if (b) { const f2 = fit(m, { ...o, text: b, start: t.size }); if (f2 && f2.size === t.size && f2.lines.length === t.lines.length) t = f2; }
      }
    }
    if (sOn) {
      s = fitLine(m, upper(tx.subtitle.v), T.text, subStart, MIN.subtitle, inner.w, 0.42, force);
      if (!s && !force) return null;
    }
    const blockH = (t ? t.height + t.size * (0.055 * 1.5 + 2 * OUTLINE_MIN) : 0) + (t && s ? subGap : 0) + (s ? s.height : 0);
    if (blockH > inner.h + 0.5 && !force) return null;
    const where = plan.pos?.title ?? 'top';
    let y = where === 'middle' ? inner.y + (inner.h - blockH) / 2 : where === 'bottom' ? inner.y + inner.h - blockH : inner.y;
    const cx = inner.x + inner.w / 2;
    if (t) {
      const d = t.size * 0.055, ow = t.size * OUTLINE_MIN, top = y + d * 0.5 + ow;
      const tInk = inkFor({ x: inner.x - d, y: top - d, w: inner.w + 2 * d, h: t.height + 2 * d }, t.size);
      texts.push(mkText(m, {
        slot: 'title', part: 'chrome', font: T.display, size: t.size,
        runs: t.lines.map((l, i) => { const mt = t!.metrics[i]; return { s: l, x: cx - (mt.left + mt.right) / 2 + mt.left, y: top + t!.asc + i * t!.size * 1.08 }; }),
        fill: { kind: 'linear', em: true, x0: 0, y0: -0.75, x1: 0, y1: 0, stops: [[0, chrome], [0.48, A3], [0.52, sky1], [1, P.accent]] },
        stroke: { paint: tInk, width: Math.max(2, t.size * OUTLINE_MIN) },
        echoes: [{ dx: d, dy: d, paint: P.accent }, { dx: -d * 0.5, dy: -d * 0.5, paint: A2 }],
        ink: [tInk], min: MIN.title,
      }));
      y = top + t.height + d + ow + (s ? subGap : 0);
    }
    if (s) {
      const mt = s.metrics[0], sInk = inkFor({ x: inner.x, y, w: inner.w, h: s.height }, s.size);
      texts.push(mkText(m, { slot: 'subtitle', part: 'line0', font: T.text, size: s.size, tracking: s.tracking, runs: [{ s: s.lines[0], x: cx - (mt.left + mt.right) / 2 + mt.left, y: y + s.asc }], fill: sInk as Paint, ink: [sInk], min: MIN.subtitle }));
    }

    // the info window in the area the layout reserved for it
    const I = B.info;
    if (tx.info.on && I) {
      const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
      if (pairs.length) {
        const px = T.pixel ?? T.mono, fs0 = Math.round(W * 0.021);
        const f = fitLines(m, pairs.map((p) => (upper(p.k) + ': ' + p.v).trim()), px, fs0, MIN.info, I.w - fs0 * 2, 0, force);
        if (!f) { if (!force) return null; }
        else {
          const fs = f.size, lh = fs * 1.7, padX = fs, bar = fs * 1.8;
          const bw = Math.min(I.w, Math.max(W * 0.34, Math.max(...f.lines.map((l) => m(l, px, fs).width)) + padX * 2)), bh = bar + f.lines.length * lh + padX;
          const bx = plan.side === 'right' ? I.x + I.w - bw : I.x, by = I.y;
          plates.push(mkRect({ x: bx, y: by, w: bw, h: bh }, win, { plate: true, shadow: { dx: fs * 0.5, dy: fs * 0.5, fill: P.accent }, stroke: { colour: winInk, width: Math.max(2, W * 0.003) } }));
          plates.push(mkRect({ x: bx, y: by, w: bw, h: bar }, sky1, { plate: true }));
          for (let i = 0; i < 3; i++) plates.push(mkRect({ x: bx + bw - (i + 1) * bar * 0.62 - padX * 0.2, y: by + bar * 0.28, w: bar * 0.42, h: bar * 0.42 }, chrome));
          const barInk = firstInk([chrome, winInk], [sky1], needRatio(fs));
          texts.push(mkText(m, { slot: 'info', part: 'bar', font: px, size: fs, runs: [{ s: 'INFO.TXT', x: bx + padX * 0.7, y: by + bar * 0.72 }], fill: barInk, ink: [barInk], min: MIN.info }));
          texts.push(mkText(m, { slot: 'info', part: 'lines', font: px, size: fs, runs: f.lines.map((l, i) => ({ s: l, x: bx + padX, y: by + bar + (i + 0.95) * lh })), fill: winInk, ink: [winInk], min: MIN.info }));
        }
      }
    }

    // the caption, centred at the foot; in the windows layout on a bar of window colour across the page
    const Cb = B.caption;
    if (tx.caption.on && tx.caption.v.trim() && Cb) {
      const cf = fitLine(m, upper(tx.caption.v), T.mono, Math.round(W * 0.019), MIN.caption, Cb.w, 0.2, force, Cb.h);
      if (!cf) { if (!force) return null; }
      else {
        const mt = cf.metrics[0], yb = Cb.y + Cb.h - cf.desc - (Cb.h - cf.height) / 2;
        if (plan.pos?.caption === 'bar') plates.push(mkRect({ x: 0, y: Cb.y - W * 0.012, w: plan.page.w, h: Cb.h + W * 0.024 }, win, { plate: true }));
        const cInk = plan.pos?.caption === 'bar' ? winInk : inkFor({ x: Cb.x, y: yb - cf.asc, w: Cb.w, h: cf.height }, cf.size);
        texts.push(mkText(m, { slot: 'caption', part: 'line0', font: T.mono, size: cf.size, tracking: cf.tracking, runs: [{ s: cf.lines[0], x: Cb.x + Cb.w / 2 - (mt.left + mt.right) / 2 + mt.left, y: yb }], fill: cInk, ink: [cInk], min: MIN.caption }));
      }
    }
    // plates first, so no plate is ever drawn over a text item (rule 3)
    return [...plates, ...texts];
  },
};

/** The title's words broken onto n lines so the widest is narrowest (last line two words or more where possible), as text with line breaks; null if none fits maxW. */
function balanced(m: Measure, text: string, font: FontRef, px: number, n: number, maxW: number): string | null {
  const words = text.trim().split(/\s+/), k = words.length;
  if (k <= n || k > 14) return null;
  let best: { w: number; s: string } | null = null;
  const cuts: number[] = [];
  const go = (from: number, left: number) => {
    if (left === 1) {
      const lines = [...cuts, k].map((e, i) => words.slice(i ? cuts[i - 1] : 0, e).join(' '));
      if (lines[lines.length - 1].split(' ').length < 2) return;
      const w = Math.max(...lines.map((l) => inkW(m(l, font, px, 0))));
      if (w <= maxW && (!best || w < best.w - 1e-6)) best = { w, s: lines.join('\n') };
      return;
    }
    for (let e = from + 1; e <= k - left + 1 - 0; e++) { if (k - e < left - 1) break; cuts.push(e); go(e, left - 1); cuts.pop(); }
  };
  go(0, n);
  return best ? (best as { s: string }).s : null;
}
