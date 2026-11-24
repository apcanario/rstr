/**
 * Swiss type (spec 8.1, 8.5): flush left on the axis column, heavy title with tight tracking, regular subtitle,
 * info as label/value columns, caption small, tracked and upper case beside a rule. Each slot sits where the
 * plan's positions say: the title at the top of the text area or low, above the foot; the subtitle under or over
 * the title; info and caption at the foot (info above the rule, caption under it) or at the head (caption over
 * its rule when alone there; with info, the foot's order: info, rule, caption). The title may read up the page (plan.titleUp). Sizes are set against the canvas width,
 * not the page, so a tilted or turned page gives the text less room, never smaller type (graphics pay for the
 * tilt). Text on a field of colour takes the ink that reads on it.
 */
import { firstInk, needRatio } from '../../colour';
import type { Rect } from '../../geom';
import { mkRect, mkText, type TextIn } from '../../items';
import type { Item } from '../../scene';
import { fit, fitLine } from '../../text';
import { SLOTS } from '../../spec';
import { fieldColour, inkOn } from '../shared/field';
import { upper } from '../shared/text';
import type { SizeClass, TypePart } from '../types';

const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };
/** Title size classes (spec 8.0): the start size, as a share of the normal one, and the most lines. */
const SIZE: Record<SizeClass, { k: number; lines: number }> = { small: { k: 0.65, lines: 2 }, normal: { k: 1, lines: 3 }, oversize: { k: 1.5, lines: 4 } };

/** A block of text laid out with its top at 0: what it draws, and how tall it is. */
interface Block { h: number; texts: TextIn[]; rects: { r: Rect; fill: string }[]; }
const inside = (r: Rect, F: Rect) => r.x >= F.x - 0.5 && r.y >= F.y - 0.5 && r.x + r.w <= F.x + F.w + 0.5 && r.y + r.h <= F.y + F.h + 0.5;

export const swissType: TypePart = {
  id: 'swiss', min: MIN,
  set(c, plan) {
    const { W, spec, m, P, T, story } = c, tx = spec.text;
    if (!SLOTS.some((s) => tx[s].on)) return [];
    const TR = plan.boxes.text, panel = plan.boxes.panel ?? null, F = plan.boxes.field;
    const pos = plan.pos ?? {}, up = !!plan.titleUp && !!plan.boxes.title;
    const axis = plan.axis, mod = plan.module, G = plan.gutter;
    const cls = SIZE[plan.size] ?? SIZE.normal;
    const items: Item[] = [];
    if (panel) items.push(mkRect(panel, P.ground, { plate: true }));
    const force = c.fallback;
    // what the text sits on, and the inks that read there
    const bg = F && inside(TR, F) ? fieldColour(P) : P.ground;
    const ink = inkOn(P, bg, 4.5);
    const labInk = bg === P.ground ? firstInk([P.accent, P.ink], [P.ground], 4.5) : ink;
    const ax = TR.x + (panel ? 0 : axis * mod), aw = TR.w - (panel ? 0 : axis * mod);
    // in 9:16 the small text is a step larger: the page is tall and the story frame crops nothing of it (review R1)
    const kS = story && plan.transform === 'none' ? 1.12 : 1;
    const capS = Math.round(W * 0.0185 * kS), infS = Math.round(W * 0.026 * kS), labS = Math.round(W * 0.017 * kS), subS = Math.round(W * 0.036 * kS);
    const label = T.label ?? T.text;
    const rh = Math.max(2, W * 0.003);
    const emit = (b: Block, dy: number) => {
      for (const r of b.rects) items.push(mkRect({ ...r.r, y: r.r.y + dy }, r.fill));
      for (const t of b.texts) items.push(mkText(m, { ...t, runs: t.runs.map((r) => ({ ...r, y: r.y + dy })) }));
    };

    // caption and its rule: under the rule at the foot, over it at the head; with info at the head too the head
    // takes the foot's order, info above the rule and the caption under it (spec 8.1, review R5 M4)
    const infoOn = tx.info.on && tx.info.v.slice(0, 3).some((p) => p.k.trim() || p.v.trim());
    const bothHead = pos.caption === 'head' && pos.info === 'head' && infoOn;
    let caption: Block | null = null;
    if (tx.caption.on && tx.caption.v.trim()) {
      const f = fitLine(m, upper(tx.caption.v), T.mono, capS, MIN.caption, TR.w, 0.12, force);
      if (!f) { if (!force) return null; }
      else {
        const foot = pos.caption !== 'head' || bothHead, lh = f.asc + f.desc, gap = G * 0.55;
        const ty = foot ? rh + gap : 0, ry = foot ? 0 : lh + gap;
        caption = {
          h: lh + gap + rh,
          texts: [{ slot: 'caption', part: 'line0', font: T.mono, size: f.size, tracking: f.tracking, runs: [{ s: f.lines[0], x: TR.x, y: ty + f.asc }], fill: ink, ink: [ink], min: MIN.caption }],
          rects: [{ r: { x: TR.x, y: ry, w: TR.w, h: rh }, fill: ink }],
        };
      }
    }
    // info: up to three label / value columns on the axis, labels on one line, values under them
    let info: Block | null = null;
    if (tx.info.on) {
      const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
      const cw = aw / Math.max(pairs.length, panel || TR.w < 5 * mod ? 2 : 3);
      const b: Block = { h: 0, texts: [], rects: [] };
      let ok = true;
      const labs = pairs.map((it) => (it.k.trim() ? fitLine(m, upper(it.k), label, labS, MIN.info, cw - G * 0.5, 0.14, force) : null));
      if (pairs.some((it, i) => it.k.trim() && !labs[i])) ok = false;
      const labH = Math.max(0, ...labs.map((l) => (l ? l.asc + l.desc : 0)));
      const vTop = labH ? labH + labS * 0.45 : 0;
      pairs.forEach((it, i) => {
        const x = ax + i * cw, l = labs[i];
        if (l) b.texts.push({ slot: 'info', part: 'label' + i, font: label, size: l.size, tracking: l.tracking, runs: [{ s: l.lines[0], x, y: labH - l.desc }], fill: labInk, ink: [labInk], min: MIN.info });
        if (it.v.trim()) {
          const v = fit(m, { text: it.v, font: T.text, maxW: cw - G * 0.5, maxH: infS * 2.4, start: infS, min: MIN.info, lh: 1.2, maxLines: 2, force });
          if (!v) { ok = false; return; }
          b.texts.push({ slot: 'info', part: 'value' + i, font: T.text, size: v.size, runs: v.lines.map((s, j) => ({ s, x, y: vTop + v.asc + j * v.size * 1.2 })), fill: ink, ink: [ink], min: MIN.info });
          b.h = Math.max(b.h, vTop + v.height);
        } else b.h = Math.max(b.h, labH);
      });
      if (!ok && !force) return null;
      if (b.texts.length) info = b;
    }
    // the head and the foot of the text area
    const head: Block[] = [], foot: Block[] = [];
    if (info && pos.info === 'head') head.push(info);
    if (caption && pos.caption === 'head') head.push(caption);
    if (info && pos.info !== 'head') foot.push(info);
    if (caption && pos.caption !== 'head') foot.push(caption);
    const gapOf = (a: Block) => (a === caption ? G * 0.9 : G);
    let y = TR.y;
    for (const b of head) { emit(b, y); y += b.h + gapOf(b); }
    let yb = TR.y + TR.h;
    for (const b of foot.slice().reverse()) { yb -= b.h; emit(b, yb); yb -= gapOf(b); }
    if (yb < y - 1e-6 && !force) return null;

    // title and subtitle in what is left, at the top or low
    const hasT = tx.title.on && !!tx.title.v.trim(), hasS = tx.subtitle.on && !!tx.subtitle.v.trim();
    const font = T.serif ?? T.text;
    const mid: Block[] = [];
    const room = yb - y;
    let tb: Block | null = null;
    if (hasT && up) {
      // reading up the page in its own strip: lines stack rightward, low starts at the strip's foot, top ends at its head
      const S = plan.boxes.title!;
      const t = fit(m, { text: tx.title.v, font: T.display, maxW: S.h, maxH: S.w, start: W * 0.15 * c.cap * cls.k, min: MIN.title, lh: 0.94, maxLines: Math.min(2, cls.lines), track: -0.028, force });
      if (!t) { if (!force) return null; }
      else {
        const lo = pos.title !== 'top';
        items.push(mkText(m, {
          slot: 'title', part: 'block', font: T.display, size: t.size, tracking: t.tracking, xf: { x: S.x, y: S.y + S.h, rot: -Math.PI / 2 },
          runs: t.lines.map((l, i) => { const mt = t.metrics[i], w = Math.max(0, mt.left) + mt.right; return { s: l, x: lo ? mt.left : S.h - w + mt.left, y: t.asc + i * t.size * 0.94 }; }),
          fill: inkOn(P, F && inside(S, F) ? fieldColour(P) : P.ground, 4.5), ink: [inkOn(P, F && inside(S, F) ? fieldColour(P) : P.ground, 4.5)], min: MIN.title,
        }));
      }
    } else if (hasT) {
      const maxH = room - (hasS ? subS * 1.3 + G : 0);
      // type only is carried by its title: it starts large and fits down until the width or the room binds (review R5 S2)
      const kT = cls.k * (plan.frame === 'type-only' ? 1.75 : 1);
      const t = maxH > 0 ? fit(m, { text: tx.title.v, font: T.display, maxW: aw, maxH, start: W * 0.15 * c.cap * kT, min: MIN.title, lh: 0.94, maxLines: cls.lines, track: -0.028, force }) : null;
      if (!t) { if (!force) return null; }
      else {
        const tInk = inkOn(P, bg, needRatio(t.size));
        tb = {
          h: t.height,
          texts: [{ slot: 'title', part: 'block', font: T.display, size: t.size, tracking: t.tracking, runs: t.lines.map((l, i) => ({ s: l, x: ax + t.metrics[i].left, y: t.asc + i * t.size * 0.94 })), fill: tInk, ink: [tInk], min: MIN.title }],
          rects: [],
        };
      }
    }
    let sb: Block | null = null;
    if (hasS) {
      const avail = room - (tb ? tb.h + G : 0);
      const s = avail > 0 ? fit(m, { text: tx.subtitle.v, font, maxW: aw, maxH: avail, start: subS, min: MIN.subtitle, lh: 1.18, maxLines: 2, force }) : null;
      if (!s) { if (!force) return null; }
      else sb = { h: s.height, texts: [{ slot: 'subtitle', part: 'block', font, size: s.size, runs: s.lines.map((l, i) => ({ s: l, x: ax, y: s.asc + i * s.size * 1.18 })), fill: ink, ink: [ink], min: MIN.subtitle }], rects: [] };
    }
    if (pos.subtitle === 'over') { if (sb) mid.push(sb); if (tb) mid.push(tb); }
    else { if (tb) mid.push(tb); if (sb) mid.push(sb); }
    const gapMid = (a: Block) => (a === sb && pos.subtitle === 'over' ? G * 0.6 : G);
    const total = mid.reduce((s, b, i) => s + b.h + (i < mid.length - 1 ? gapMid(b) : 0), 0);
    let my = pos.title === 'low' && !up ? Math.max(y, yb - total) : y;
    for (const b of mid) { emit(b, my); my += b.h + gapMid(b); }
    return items;
  },
};
