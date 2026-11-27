/**
 * Swiss type (spec 8.1, 8.5): flush left on the axis column, heavy title with tight tracking, regular subtitle,
 * info as label/value columns, caption small, tracked and upper case beside a rule. Each slot sits where the
 * plan's positions say: the title at the top of the text area or low, above the foot; the subtitle under or over
 * the title; info and caption at the foot (info above the rule, caption under it) or at the head (caption over
 * its rule when alone there; with info, the foot's order: info, rule, caption). Info apart from the caption keeps
 * a rule of its own under it. The title may read up the page (plan.titleUp). Sizes are set against the canvas width,
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
import { capControl, paramChoice, type Ranged } from '../../controls';
import { bothPlaces, lv, soloPlan } from '../shared/layers';
import type { LevelSets } from '../types';
/** Text layers beyond the slots (spec 8.6): flush left on the text area, as the slots of 8.1 are set, on ground plates. */
// a plate of ground across a graphic is a ref look only in the full-bleed layout (8.1): only there may body and label go over one
export const SWISS_LEVELS: LevelSets = bothPlaces({
  headline: lv('display', false, 0.09, 40, 0.94, 3, -0.028, 'top', 'left', 'ground', ['full-bleed']),
  subhead: lv('serif', false, 0.036, 20, 1.18, 2, 0, 'top', 'left', 'ground', ['full-bleed']),
  body: lv('text', false, 0.028, 16, 1.3, 5, 0, 'top', 'left', 'ground', ['full-bleed']),
  label: lv('label', true, 0.017, 16, 1, 1, 0.14, 'top', 'left', 'ground', ['full-bleed']),
  caption: lv('mono', true, 0.0185, 16, 1, 1, 0.12, 'bottom', 'left', 'ground', ['full-bleed']),
  data: lv('text', false, 0.026, 16, 1.2, 1, 0, 'bottom', 'left', 'ground', ['full-bleed']),
});


/** Title case (spec 10.3 Type): Swiss sets the title as typed unless Advanced asks for upper or lower case. */
export const titleCase = (v: string, k: unknown) => (k === 'upper' ? upper(v) : k === 'lower' ? v.toLocaleLowerCase() : v);

const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };
/** Title size classes (spec 8.0): the start size, as a share of the normal one, and the most lines. */
const SIZE: Record<SizeClass, { k: number; lines: number }> = { small: { k: 0.65, lines: 2 }, normal: { k: 1, lines: 3 }, oversize: { k: 1.5, lines: 4 } };

/** A block of text laid out with its top at 0: what it draws, and how tall it is. */
interface Block { h: number; texts: TextIn[]; rects: { r: Rect; fill: string }[]; }
const inside = (r: Rect, F: Rect) => r.x >= F.x - 0.5 && r.y >= F.y - 0.5 && r.x + r.w <= F.x + F.w + 0.5 && r.y + r.h <= F.y + F.h + 0.5;

/** The title's tracking in ems (spec 8.1: tight; spec 10.3 Type: tracking), narrowed to what passes 9.2. */
export const SWISS_TRACK = { def: -0.028, min: -0.06, max: 0.04 };
const titleTrack = (s: { params: Record<string, unknown> }) => {
  const v = s.params['type.track'];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(SWISS_TRACK.min, Math.min(SWISS_TRACK.max, v)) : SWISS_TRACK.def;
};
const trackControl = (): Ranged => ({ kind: 'range', id: 'type.track', label: 'Tracking', where: { at: 'params', key: 'type.track' }, facet: 'type', min: SWISS_TRACK.min, max: SWISS_TRACK.max, step: 0.002, shown: SWISS_TRACK.def });

export const swissType: TypePart = {
  levels: SWISS_LEVELS,
  // a second layer of a slot's level: the room is its text area, on the axis, over the field where the room is in it
  solo: (plan, slot, room) => soloPlan(plan, slot, room, { boxes: { text: room, title: room, ...(plan.boxes.field ? { field: plan.boxes.field } : {}) } }),
  id: 'swiss', min: MIN,
  controls: () => {
    const k = paramChoice('type.case', 'Case', ['upper', 'lower'], (v) => (v === 'upper' ? 'Upper' : 'Lower'));
    k.options[0].label = 'As typed';
    return [k, capControl(), trackControl()];
  },
  set(c, plan) {
    const { W, spec, m, P, T, story } = c;
    const tx = { ...c.tx, title: { ...c.tx.title, v: titleCase(c.tx.title.v, spec.params['type.case']) } };
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
      // values set on one line, all at one size, when every value fits on one line at MIN.info or more; only then
      // may a value wrap to two (review bundle 2 S2: "23 Nov / 2026" broke in a narrow column)
      const vW = cw - G * 0.5;
      const one = pairs.map((it) => (it.v.trim() ? fitLine(m, it.v, T.text, infS, MIN.info, vW) : null));
      const oneOk = pairs.every((it, i) => !it.v.trim() || one[i]);
      const oneS = Math.min(infS, ...one.map((f) => (f ? f.size : infS)));
      pairs.forEach((it, i) => {
        const x = ax + i * cw, l = labs[i];
        if (l) b.texts.push({ slot: 'info', part: 'label' + i, font: label, size: l.size, tracking: l.tracking, runs: [{ s: l.lines[0], x, y: labH - l.desc }], fill: labInk, ink: [labInk], min: MIN.info });
        if (it.v.trim()) {
          const v = oneOk
            ? fit(m, { text: it.v.replace(/\s*\n\s*/g, ' '), font: T.text, maxW: vW, maxH: infS * 2.4, start: oneS, step: 1, min: MIN.info, lh: 1.2, maxLines: 1 })
            : fit(m, { text: it.v, font: T.text, maxW: vW, maxH: infS * 2.4, start: infS, min: MIN.info, lh: 1.2, maxLines: 2, force });
          if (!v) { ok = false; return; }
          b.texts.push({ slot: 'info', part: 'value' + i, font: T.text, size: v.size, runs: v.lines.map((s, j) => ({ s, x, y: vTop + v.asc + j * v.size * 1.2 })), fill: ink, ink: [ink], min: MIN.info });
          b.h = Math.max(b.h, vTop + v.height);
        } else b.h = Math.max(b.h, labH);
      });
      if (!ok && !force) return null;
      if (b.texts.length) info = b;
    }
    // info sits above a rule wherever it is (spec 8.1): when the caption is not at the same end to bring its rule,
    // info draws its own (review bundle 2 M3)
    if (info && !(caption && (pos.info === 'head') === (pos.caption === 'head'))) {
      const gap = G * 0.55;
      info.rects.push({ r: { x: TR.x, y: info.h + gap, w: TR.w, h: rh }, fill: ink });
      info.h += gap + rh;
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
    // up the edge the title has its own strip: the subtitle has nothing to go over or under (review R10 S1)
    if (hasT && up) plan.inert = [...(plan.inert ?? []), 'pos.subtitle'];
    if (hasT && up) {
      // reading up the page in its own strip: lines stack rightward, low starts at the strip's foot, top ends at its head
      const S = plan.boxes.title!;
      const t = fit(m, { text: tx.title.v, font: T.display, maxW: S.h, maxH: S.w, start: W * 0.15 * c.cap * cls.k, min: MIN.title, lh: 0.94, maxLines: Math.min(2, cls.lines), track: titleTrack(spec), force });
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
      // a long title in type only may take two more lines, so it grows into the room instead of leaving the lower
      // part of the page bare (review bundle 2 M2)
      const only = plan.frame === 'type-only', kT = cls.k * (only ? 1.75 : 1);
      const t = maxH > 0 ? fit(m, { text: tx.title.v, font: T.display, maxW: aw, maxH, start: W * 0.15 * c.cap * kT, min: MIN.title, lh: 0.94, maxLines: cls.lines + (only ? 2 : 0), track: titleTrack(spec), force }) : null;
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
