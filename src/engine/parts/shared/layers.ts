/**
 * Text layers beyond the four slots (spec 8.6, row R17). A style's type part sets the lead layer of each slot's level
 * (the first headline, subhead, data and caption) by its own rules; every other layer that is on is set here, by the
 * treatment the style gives its level (`TypePart.levels`), in the free room the lead layers and the graphics leave.
 *
 * - Each layer sits on a plate of the style's plate colour (ground, paper or window), so it reads on whatever is under
 *   it; its ink is the first of the palette's inks that reaches the contrast of spec 5 on that plate.
 * - Highest levels are placed first (LEVEL_RANK), each from its level's start size down: so where they cannot all fit,
 *   the lowest levels shrink first. Two layers of one level take the same face, case, plate and start size (the
 *   size of the level's lead layer where it has one), and are kept apart by the gutter like any two layers.
 * - A place is first looked for clear of the graphics; then over them (the plate carries the contrast). It must keep
 *   off every text item and plate, inside the canvas and, in 9:16, out of the story zones.
 * - A layer that finds no place even at its level's minimum size is not drawn and is returned as flagged: the Text tab
 *   marks its row (spec 8.6: nothing is dropped silently).
 *
 * Everything here is geometry from the plan, the text and the measure: the colour seed never moves a layer (9.3).
 */
import { firstInk, needRatio } from '../../colour';
import { bounds, rectQuad, unapply, xfQuad, type Quad, type Rect } from '../../geom';
import { mkRect, mkText } from '../../items';
import type { Item, TextItem } from '../../scene';
import { fit, inkW } from '../../text';
import { LEVEL_RANK, LEVEL_SLOT, pairsOf, stringOf, type Level, type TextLayer } from '../../spec';
import { STORY_TEXT_BOTTOM, STORY_TEXT_TOP } from '../../formats';
import type { Pairing } from '../../../data/pairings';
import type { Form } from '../../../data/palettes/types';
import type { LevelSet, LevelSets, PartCtx, Plan } from '../types';
import { upper } from './text';

const overlapR = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

/** The plate colour of a level in a palette form: its role where the form has it, else the ground. */
export const plateOf = (P: Form, s: LevelSet): string => (s.plate === 'paper' ? P.paper : s.plate === 'window' ? P.window : undefined) ?? P.ground;
/** The ink on that plate: the first of the form's inks that reaches the ratio (roles only, never a literal). */
export function inkOnPlate(P: Form, plate: string, ratio: number): string {
  const cands = [P.windowInk, P.toner, P.ink, P.ground, P.paper, P.accent].filter((c): c is string => !!c && c !== plate);
  return firstInk(cands, [plate], ratio);
}
const faceOf = (T: Pairing, s: LevelSet) => T[s.font] ?? T.text;

/** A block of text with its top-left at 0,0: its runs (by item) and its size. */
interface Block { w: number; h: number; size: number; texts: { part: string; font: TextItem['font']; size: number; tracking: number; runs: { s: string; x: number; y: number }[] }[]; }

function block(c: PartCtx, L: TextLayer, s: LevelSet, size: number, maxW: number): Block | null {
  const { m, T } = c;
  if (L.level === 'data') {
    const pairs = pairsOf(L);
    const lf = T.label ?? T.text, vf = T.text, ls = Math.max(s.min, Math.round(size * 0.78));
    const lt = 0.12 * ls, gap = size * 0.7, pitch = size * 1.32;
    const labs = pairs.map((p) => (p.k.trim() ? upper(p.k.trim()) : ''));
    const lw = Math.max(0, ...labs.map((l) => (l ? inkW(m(l, lf, ls, lt)) : 0)));
    const vx = lw ? lw + gap : 0;
    const out: Block = { w: 0, h: 0, size, texts: [] };
    let y = 0;
    for (let i = 0; i < pairs.length; i++) {
      const v = pairs[i].v.replace(/\s*\n\s*/g, ' ').trim(), mt = v ? m(v, vf, size, 0) : null, ml = labs[i] ? m(labs[i], lf, ls, lt) : null;
      const vw = mt ? inkW(mt) : 0;
      if (vx + vw > maxW) return null;
      const asc = Math.max(mt?.ascent ?? 0, ml?.ascent ?? 0), base = y + asc;
      if (ml) out.texts.push({ part: 'label' + i, font: lf, size: ls, tracking: lt, runs: [{ s: labs[i], x: ml.left, y: base }] });
      if (mt) out.texts.push({ part: 'value' + i, font: vf, size, tracking: 0, runs: [{ s: v, x: vx + mt.left, y: base }] });
      out.w = Math.max(out.w, vx + vw);
      y += i < pairs.length - 1 ? pitch : asc + Math.max(mt?.descent ?? 0, ml?.descent ?? 0);
    }
    out.h = y;
    return out.texts.length ? out : null;
  }
  const font = faceOf(T, s), text = s.upper ? upper(stringOf(L)) : stringOf(L);
  const f = fit(m, { text, font, maxW, maxH: Infinity, start: size, min: size, lh: s.lh, maxLines: s.lines, track: s.track, step: 1 });
  if (!f) return null;
  const lineW = (i: number) => Math.max(0, f.metrics[i].left) + f.metrics[i].right;
  return {
    w: f.width, h: f.height, size,
    texts: [{ part: 'block', font, size, tracking: f.tracking, runs: f.lines.map((l, i) => ({ s: l, x: (s.align === 'centre' ? (f.width - lineW(i)) / 2 : 0) + f.metrics[i].left, y: f.asc + i * size * s.lh })) }],
  };
}

/** Where the layers may go, in the plan's local page: the text area the style had before any room was kept for layers. */
function regionOf(c: PartCtx, plan: Plan): Rect {
  const T = plan.boxes.text, top = c.top0 ?? c.top, bot = c.bot0 ?? c.bot;
  if (!plan.xf) return { x: T.x, y: Math.min(T.y, top), w: T.w, h: Math.max(T.y + T.h, bot) - Math.min(T.y, top) };
  const W = { x: plan.margin, y: top, w: c.W - 2 * plan.margin, h: bot - top };
  const b = bounds(rectQuad(W).map((p) => unapply(plan.xf!, p)));
  const pg = plan.page;
  const x0 = Math.max(b.x, pg.x + plan.margin * 0.5), x1 = Math.min(b.x + b.w, pg.x + pg.w - plan.margin * 0.5);
  const y0 = Math.max(b.y, pg.y), y1 = Math.min(b.y + b.h, pg.y + pg.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export interface Placed { items: Item[]; flagged: string[]; }

/** The cache of one solve: placement is geometry only, so every palette form of one candidate shares it. */
const memo = new Map<string, { places: { id: string; x: number; y: number; b: Block; plate: Rect }[]; flagged: string[] }>();

export function placeLayers(c: PartCtx, plan: Plan, below: Item[], text: Item[], sets: LevelSets, layers: TextLayer[]): Placed {
  const { W, H, story } = c;
  const G = Math.max(plan.gutter, W * 0.018), pad = Math.round(W * 0.012);
  const R = regionOf(c, plan);
  // what the layers keep off, in the local page: every text item and plate the type part set (hard), the graphics (soft)
  const hard: Rect[] = [], soft: Rect[] = [];
  for (const it of text) {
    const b = bounds(it.quad);
    hard.push(it.kind === 'text' ? { x: b.x - G, y: b.y - G, w: b.w + 2 * G, h: b.h + 2 * G } : { x: b.x - G * 0.5, y: b.y - G * 0.5, w: b.w + G, h: b.h + G });
  }
  const toLocal = (q: Quad) => bounds(plan.xf ? q.map((p) => unapply(plan.xf!, p)) : q);
  for (const it of below) {
    if (it.kind === 'graphic' && (it.layer === 'ground' || it.pass)) continue;
    const b = toLocal(it.quad);
    if (b.w * b.h > 0.6 * W * H) continue;   // a full-bleed field or graphic: the plate is what keeps the text legible on it
    soft.push(b);
  }
  const key = JSON.stringify([c.spec.text, c.spec.format, c.T.id, c.k, plan.frame, Math.round(R.x), Math.round(R.y), Math.round(R.w), Math.round(R.h), ...[hard, soft].map((l) => l.map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)])), c.spec.seeds, c.cap]);
  let got = memo.get(key);
  if (!got) {
    got = { places: [], flagged: [] };
    const order = [...layers].sort((a, b) => LEVEL_RANK.indexOf(a.level) - LEVEL_RANK.indexOf(b.level));
    const leadPx: Partial<Record<Level, number>> = {};
    for (const it of text) if (it.kind === 'text' && it.lid && !it.extra) {
      const L = c.spec.text.find((l) => l.id === it.lid);
      if (L) leadPx[L.level] = Math.max(leadPx[L.level] ?? 0, it.px);
    }
    const step = Math.max(4, Math.round(W * 0.008));
    const worldOk = (r: Rect) => {
      const q = xfQuad(plan.xf, rectQuad(r)), xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
      if (Math.min(...xs) < 0 || Math.max(...xs) > W || Math.min(...ys) < 0 || Math.max(...ys) > H) return false;
      return !story || (Math.min(...ys) >= STORY_TEXT_TOP && Math.max(...ys) <= STORY_TEXT_BOTTOM);
    };
    const find = (b: Block, s: LevelSet, clear: boolean): { x: number; y: number; plate: Rect } | null => {
      const pw = b.w + 2 * pad, ph = b.h + 2 * pad;
      if (pw > R.w + 1e-6 || ph > R.h + 1e-6) return null;
      const x = s.align === 'centre' ? R.x + (R.w - pw) / 2 : R.x;
      const n = Math.floor((R.h - ph) / step);
      for (let i = 0; i <= n; i++) {
        const y = s.from === 'bottom' ? R.y + R.h - ph - i * step : R.y + i * step;
        const plate = { x, y, w: pw, h: ph };
        if (hard.some((o) => overlapR(o, plate))) continue;
        if (clear && soft.some((o) => overlapR(o, plate))) continue;
        if (!worldOk({ x: x + pad, y: y + pad, w: b.w, h: b.h })) continue;
        return { x: x + pad, y: y + pad, plate };
      }
      return null;
    };
    // the size a layer of a lower level may start at: never above a higher level placed before it (lowest shrink first)
    let ceil = Infinity, ceilRank = -1, lowest = Infinity;
    for (const L of order) {
      const s = sets[L.level], rank = LEVEL_RANK.indexOf(L.level);
      if (rank > ceilRank) { ceil = lowest; ceilRank = rank; }
      const start = Math.max(s.min, Math.round(Math.min(W * s.size * c.cap, leadPx[L.level] ?? Infinity, ceil)));
      const sizes: number[] = [];
      for (let px = start; px >= s.min; px -= px > 60 ? 4 : 2) sizes.push(px);
      if (sizes[sizes.length - 1] !== s.min) sizes.push(s.min);
      const blocks = sizes.map((px) => block(c, L, s, px, R.w - 2 * pad));
      let hit: { x: number; y: number; plate: Rect; b: Block } | null = null;
      // clear of the graphics while the layer keeps three quarters of its size; then anywhere, on its plate
      for (const clear of [true, false]) {
        for (let i = 0; i < sizes.length && !hit; i++) {
          if (clear && sizes[i] < start * 0.75) break;
          const b = blocks[i];
          if (!b) continue;
          const p = find(b, s, clear);
          if (p) hit = { ...p, b };
        }
        if (hit) break;
      }
      if (!hit) { got.flagged.push(L.id); continue; }
      got.places.push({ id: L.id, x: hit.x, y: hit.y, b: hit.b, plate: hit.plate });
      lowest = Math.min(lowest, hit.b.size);
      hard.push({ x: hit.plate.x - G + pad, y: hit.plate.y - G + pad, w: hit.plate.w + 2 * G - 2 * pad, h: hit.plate.h + 2 * G - 2 * pad });
    }
    if (memo.size > 400) memo.clear();
    memo.set(key, got);
  }
  // colours per form: the plate's role and the ink that reads on it
  const items: Item[] = [];
  for (const p of got.places) {
    const L = c.spec.text.find((l) => l.id === p.id)!, s = sets[L.level];
    const plate = plateOf(c.P, s);
    const ink = inkOnPlate(c.P, plate, needRatio(p.b.size));
    items.push(mkRect(p.plate, plate, { plate: true }));
    for (const t of p.b.texts) {
      const it = mkText(c.m, { slot: LEVEL_SLOT[L.level], part: p.id + '.' + t.part, font: t.font, size: t.size, tracking: t.tracking, runs: t.runs.map((r) => ({ ...r, x: r.x + p.x, y: r.y + p.y })), fill: ink, ink: [ink], min: s.min });
      it.lid = p.id;
      it.extra = true;
      items.push(it);
    }
  }
  return { items, flagged: [...got.flagged] };
}

/**
 * Room kept for the layers before the style lays out its own (at the foot of the text area): an estimate from the
 * words and the level's size alone, never from a face, so the type seed moves no graphic (9.3). Candidates try more
 * and less of it; the fallback keeps none (it is the style's own, which always passes).
 */
export function roomFor(layers: TextLayer[], sets: LevelSets, W: number, inner: number, area: number, k: number): number {
  if (!layers.length) return 0;
  let h = 0;
  for (const L of layers) {
    const s = sets[L.level], px = W * s.size;
    if (L.level === 'data') { h += pairsOf(L).length * px * 1.32 + W * 0.04; continue; }
    const per = Math.max(4, Math.floor(inner / (px * (s.upper ? 0.62 : 0.52))));
    const lines = Math.min(s.lines, Math.ceil(stringOf(L).trim().length / per) || 1);
    h += lines * px * s.lh + W * 0.04;
  }
  const f = k < 0 ? 0 : [1, 0.7, 1.25, 0.45][k % 4];
  return Math.round(Math.min(h * f, area * 0.45));
}

/** A level's treatment in one line: face, upper case, start size (share of W), minimum, pitch, lines, tracking, from, align, plate. */
export const lv = (font: LevelSet['font'], up: boolean, size: number, min: number, lh: number, lines: number, track: number, from: LevelSet['from'] = 'top', align: LevelSet['align'] = 'left', plate: LevelSet['plate'] = 'ground'): LevelSet =>
  ({ font, upper: up, size, min, lh, lines, track, from, align, plate });
