/**
 * Text layers beyond the four slots (spec 8.6, row R17). A style's type part sets the lead layer of each slot's level
 * (the first headline, subhead, data and caption) by its own rules; every other layer that is on is set here, in the
 * free room the lead layers and the graphics leave, highest levels first (LEVEL_RANK).
 *
 * - A further layer of a slot's level (a second headline, subhead, data or caption) is set alike (spec 8.6, review R17
 *   E1): by the type part's own `set`, called with that slot alone in a room of the text area (`TypePart.solo`), so
 *   it takes the lead's face, case, fill treatment and size class; it is held to 0.8 to 1.25 of the lead's size
 *   (Brutalist: every line at the full width instead, 8.3).
 * - Body and label, which have no slot rules, sit on a plate of the style's plate colour (ground, paper or window),
 *   set by the treatment the style gives their level (`TypePart.levels`), from the level's start size down to its
 *   minimum, never above a higher level placed before them: where they cannot all fit, the lowest levels shrink first.
 * - Every layer keeps off every text item and plate and off what the style names (`keepOff`: the Vaporwave sun), inside
 *   the canvas and, in 9:16, out of the story zones. A place is looked for clear of the graphics down to the minimum;
 *   it goes over a graphic only where the style sets text there itself (`LevelSet.over`; a slot's own setter where
 *   every text sits on its own plate, or where the style's text crosses graphics by rule).
 * - A layer's place follows its row's position where the level has more than one (`LevelSet.places`, spec 10.3).
 * - A layer that finds no place is not drawn and is returned as flagged: the Text tab marks its row (spec 8.6:
 *   nothing is dropped silently).
 *
 * Everything here is geometry from the plan, the text and the measure: the colour seed never moves a layer (9.3).
 */
import { firstInk, needRatio } from '../../colour';
import { bounds, overlaps, rectQuad, unapply, xfQuad, type Quad, type Rect } from '../../geom';
import type { Measure } from '../../measure';
import { mkRect, mkText } from '../../items';
import type { Item, RectItem, Scene, TextItem } from '../../scene';
import { lowContrast } from '../../invariants';
import { fit, inkW } from '../../text';
import { LEVEL_RANK, LEVEL_SLOT, pairsOf, stringOf, type Level, type Slot, type SlotText, type TextLayer } from '../../spec';
import { STORY_TEXT_BOTTOM, STORY_TEXT_TOP } from '../../formats';
import type { Pairing } from '../../../data/pairings';
import type { Form } from '../../../data/palettes/types';
import type { LevelSet, LevelSets, PartCtx, Plan, TypePart } from '../types';
import { upper } from './text';


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
  const y0 = Math.max(b.y, pg.y), y1 = Math.min(b.y + b.h, pg.y + pg.h - plan.margin);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export interface Placed { items: Item[]; flagged: string[]; }

/** The levels a style's type part sets as slots: a second layer of one of these goes through the part's own setter. */
export const SLOT_LEVELS: Level[] = ['headline', 'subhead', 'data', 'caption'];
/** The levels' treatments for the plan's dialect. */
export const setsOf = (type: TypePart, plan: Plan): LevelSets => (plan.dialect && type.levelsOf?.[plan.dialect]) || type.levels;

/** A place found for one layer: a room the type part set its slot in, or a block on a plate. */
type Place = { id: string; room: Rect; slot: Slot } | { id: string; x: number; y: number; b: Block; plate: Rect };

/**
 * The cache of one solve: placement is geometry only, so every palette form of one candidate shares it. Keyed by the
 * measure (fonts loaded or not) and by everything placement reads: the text, format, params, seeds, pairing, candidate,
 * size cap, the whole plan (transform included) and what the layers keep off (review R17 M3).
 */
const memo = new WeakMap<Measure, Map<string, { places: Place[]; flagged: string[] }>>();

const overlapR = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const inside = (a: Rect, b: Rect) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
/** An item's extent in the local page, its shadow included. */
const extent = (it: Item): Rect => bounds(it.kind === 'rect' && it.shadowQuad ? [...it.quad, ...it.shadowQuad] : it.quad);
const maxPx = (its: Item[]) => Math.max(0, ...its.filter((i): i is TextItem => i.kind === 'text').map((i) => i.px));

/** The four slots with only `slot` on, holding the layer's words (`solo`). */
function soloText(slot: Slot, L: TextLayer, tx: SlotText): SlotText {
  const off = { on: false, v: '', pos: null };
  const t: SlotText = { title: { ...off }, subtitle: { ...off }, info: { on: false, v: [], pos: null }, caption: { ...off } };
  if (slot === 'info') t.info = { on: true, v: structuredClone(pairsOf(L)), pos: tx.info.pos };
  else t[slot] = { on: true, v: stringOf(L), pos: tx[slot].pos };
  return t;
}

export function placeLayers(c: PartCtx, plan: Plan, below: Item[], text: Item[], type: TypePart, layers: TextLayer[]): Placed {
  const { W, H, story } = c;
  const sets = setsOf(type, plan);
  const G = Math.max(plan.gutter, W * 0.018), pad = Math.round(W * 0.012);
  const R = regionOf(c, plan);
  const toLocal = (q: Quad) => bounds(plan.xf ? q.map((p) => unapply(plan.xf!, p)) : q);
  // what the layers keep off, in the local page: every text item and plate the type part set and the graphics the style
  // names (hard); the other graphics (soft). A plate as large as a panel is the ground the text sits on, not in the way.
  const hard: Rect[] = [], soft: Rect[] = [], panels: Rect[] = [];
  const keep = (it: Item) => {
    const b = extent(it);
    if (it.kind === 'rect' && it.plate && b.w * b.h > 0.15 * W * H && Math.min(b.w, b.h) > 0.25 * W) { panels.push(b); return; }
    hard.push(it.kind === 'text' ? { x: b.x - G, y: b.y - G, w: b.w + 2 * G, h: b.h + 2 * G } : { x: b.x - G * 0.5, y: b.y - G * 0.5, w: b.w + G, h: b.h + G });
  };
  for (const it of text) keep(it);
  const leadQ = text.filter((i) => i.kind === 'text').map((i) => xfQuad(plan.xf, i.quad));
  for (const it of below) {
    if (it.kind !== 'graphic' || it.layer === 'ground' || it.pass) continue;
    const b = toLocal(it.quad);
    if (type.keepOff?.(it)) { hard.push({ x: b.x - G * 0.5, y: b.y - G * 0.5, w: b.w + G, h: b.h + G }); continue; }
    // a graphic the style's own text already sits on is part of the page it sets text on
    if (leadQ.some((q) => overlaps(it.quad, q))) continue;
    soft.push(b);
  }
  // the Scene so far on the canvas: a slot's setter assumes the page under it, so what it sets is read against what is
  // really there (rule 4) and held to its minimum (rule 5) before it is taken
  const world = (it: Item): Item => (it.kind === 'graphic' ? it : it.kind === 'rect' ? { ...it, quad: xfQuad(plan.xf, it.quad), shadowQuad: it.shadowQuad && xfQuad(plan.xf, it.shadowQuad) } : { ...it, quad: xfQuad(plan.xf, it.quad) });
  // (a graphic marked to knock out round the glyphs keeps off them once the type is set, and where the style's text
  // crosses graphics by rule it carries its own contrast: neither is read here)
  const crosses = !!type.soloOver?.(plan);
  const sofar: Item[] = [...below.filter((i) => !(i.kind === 'graphic' && (i.knock || (crosses && i.layer !== 'ground' && !i.pass)))), ...text.map(world)];
  const legal = (out: Item[]) => {
    const items = [...sofar, ...out.map(world)];
    const sc = { items, ground: c.P.ground, w: W, h: H, format: c.spec.format } as unknown as Scene;
    for (let i = sofar.length; i < items.length; i++) {
      const t = items[i];
      if (t.kind !== 'text') continue;
      if (t.px < t.min - 1e-6 || (!t.waive?.includes(4) && lowContrast(sc, i))) return false;
    }
    return true;
  };
  // the slot setter sees the lead's plates under it, so it reads its ink on what is really there
  const soloBelow = [...below, ...text.filter((i): i is RectItem => i.kind === 'rect').map((i) => ({ ...i, quad: xfQuad(plan.xf, i.quad), shadowQuad: i.shadowQuad && xfQuad(plan.xf, i.shadowQuad) }))] as Item[];
  const soloSet = (slot: Slot, L: TextLayer, room: Rect) => {
    const c2: PartCtx = { ...c, tx: soloText(slot, L, c.tx), fallback: false };
    return type.set(c2, type.solo({ ...plan, solo: true, inert: undefined }, slot, room, R, c2), soloBelow);
  };
  const sk = (r: Rect) => [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)];
  const key = JSON.stringify([c.spec.text, c.spec.format, c.spec.params, c.spec.seeds, c.spec.pick, c.spec.marks, c.T.id, c.k, c.cap, c.keep, { ...plan, inert: undefined }, sk(R), hard.map(sk), soft.map(sk), panels.map(sk)]);
  let byM = memo.get(c.m);
  if (!byM) memo.set(c.m, (byM = new Map()));
  let got = byM.get(key);
  if (!got) {
    got = { places: [], flagged: [] };
    const order = [...layers].sort((a, b) => LEVEL_RANK.indexOf(a.level) - LEVEL_RANK.indexOf(b.level));
    const leadPx: Partial<Record<Level, number>> = {};
    for (const it of text) if (it.kind === 'text' && it.lid && !it.extra) {
      const L = c.spec.text.find((l) => l.id === it.lid);
      if (L) leadPx[L.level] = Math.max(leadPx[L.level] ?? 0, it.px);
    }
    const step = Math.max(4, Math.round(W * 0.008));
    const worldOk = (r: Rect, sides = true) => {
      const q = xfQuad(plan.xf, rectQuad(r)), xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
      if (sides && (Math.min(...xs) < -0.5 || Math.max(...xs) > W + 0.5)) return false;
      if (Math.min(...ys) < -0.5 || Math.max(...ys) > H + 0.5) return false;
      return !story || (Math.min(...ys) >= STORY_TEXT_TOP - 0.5 && Math.max(...ys) <= STORY_TEXT_BOTTOM + 0.5);
    };
    const onPanel = (b: Rect) => panels.some((p) => inside(b, p));
    // the row's position where the level offers it, else the level's own place
    const head = (L: TextLayer, s: LevelSet) => ((L.pos === 'head' || L.pos === 'foot') && s.places.includes(L.pos) ? L.pos : s.places[0]) === 'head';

    // a further layer of a slot's level, by the type part's own setter, in a room of the text area
    const solo = (L: TextLayer, s: LevelSet): Rect | null => {
      const slot = LEVEL_SLOT[L.level], lead = leadPx[L.level], free = type.soloFree?.includes(slot) || !lead;
      const fromTop = head(L, s);
      // the free bands of the region: what no text block, plate or (while looking clear of them) graphic takes; a tall
      // narrow strip up an edge (a caption up the side, a title up the edge) is checked on the result instead
      const bandsOf = (clear: boolean) => {
        const cuts = [...hard, ...(clear ? soft : [])].filter((r) => Math.min(r.x + r.w, R.x + R.w) - Math.max(r.x, R.x) > 0 && !(r.h > 2 * r.w && r.w < R.w * 0.25)).map((r) => [r.y, r.y + r.h]).sort((a, b) => a[0] - b[0]);
        const out: [number, number][] = [];
        let y = R.y;
        for (const [a, b] of cuts) { if (a > y + W * 0.03) out.push([y, Math.min(a, R.y + R.h)]); y = Math.max(y, b); }
        if (R.y + R.h > y + W * 0.03) out.push([y, R.y + R.h]);
        return fromTop ? out : out.reverse();
      };
      const test = (room: Rect, clear: boolean): 'null' | 'hit' | 'big' | 'small' | 'ok' => {
        const out = soloSet(slot, L, room);
        if (!out || !out.some((i) => i.kind === 'text')) return 'null';
        const plated = out.filter((i): i is RectItem => i.kind === 'rect' && !!i.plate).map(extent);
        const allOnPlates = out.every((i) => i.kind !== 'text' || plated.some((p) => inside(extent(i), p)));
        const F = plan.boxes.field;
        for (const it of out) {
          const b = extent(it);
          // the setter reads the field under its text from its room: a text across the field's edge would be misread
          if (F && it.kind === 'text' && !inside(b, F) && overlapR(b, F)) return 'hit';
          if (hard.some((o) => overlapR(o, b))) return 'hit';
          if (!worldOk(b, false)) return 'hit';
          if (onPanel(b)) continue;
          if (soft.some((o) => overlapR(o, b)) && (clear || !(allOnPlates || type.soloOver?.(plan)))) return 'hit';
        }
        if (!free) {
          const r = maxPx(out) / lead!;
          if (r > 1.25) return 'big';
          if (r < 0.8) return 'small';
        }
        return legal(out) ? 'ok' : 'hit';
      };
      for (const clear of [true, false]) {
        for (const [a, b] of bandsOf(clear)) {
          for (const k of [1, 0.8, 0.64, 0.5, 0.4, 0.3, 0.22]) {
            const h = (b - a) * k;
            if (h < W * 0.03) break;
            const room = { x: R.x, y: fromTop ? a : b - h, w: R.w, h };
            const t = test(room, clear);
            if (t === 'ok') return room;
            if (t === 'null' || t === 'small') break;
          }
        }
      }
      return null;
    };

    const find = (b: Block, s: LevelSet, fromTop: boolean, clear: boolean): { x: number; y: number; plate: Rect } | null => {
      const pw = b.w + 2 * pad, ph = b.h + 2 * pad;
      if (pw > R.w + 1e-6 || ph > R.h + 1e-6) return null;
      const x = s.align === 'centre' ? R.x + (R.w - pw) / 2 : R.x;
      const n = Math.floor((R.h - ph) / step);
      for (let i = 0; i <= n; i++) {
        const y = fromTop ? R.y + i * step : R.y + R.h - ph - i * step;
        const plate = { x, y, w: pw, h: ph };
        if (hard.some((o) => overlapR(o, plate))) continue;
        if (clear && !onPanel(plate) && soft.some((o) => overlapR(o, plate))) continue;
        if (!worldOk({ x: x + pad, y: y + pad, w: b.w, h: b.h })) continue;
        return { x: x + pad, y: y + pad, plate };
      }
      return null;
    };
    const overOk = (s: LevelSet) => s.over === true || (Array.isArray(s.over) && s.over.includes(plan.frame));
    // the size a layer of a lower level may start at: never above a higher level placed before it (lowest shrink first)
    let ceil = Infinity, ceilRank = -1, lowest = Infinity;
    for (const L of order) {
      const s = sets[L.level], rank = LEVEL_RANK.indexOf(L.level);
      if (rank > ceilRank) { ceil = lowest; ceilRank = rank; }
      if (SLOT_LEVELS.includes(L.level)) {
        const room = solo(L, s);
        if (!room) { got.flagged.push(L.id); continue; }
        const out = soloSet(LEVEL_SLOT[L.level], L, room)!;
        got.places.push({ id: L.id, room, slot: LEVEL_SLOT[L.level] });
        const px = maxPx(out);
        if (px) lowest = Math.min(lowest, px);
        for (const it of out) keep(it);
        sofar.push(...out.map(world));
        continue;
      }
      const start = Math.max(s.min, Math.round(Math.min(W * s.size * c.cap, leadPx[L.level] ?? Infinity, ceil)));
      const sizes: number[] = [];
      for (let px = start; px >= s.min; px -= px > 60 ? 4 : 2) sizes.push(px);
      if (sizes[sizes.length - 1] !== s.min) sizes.push(s.min);
      const blocks = sizes.map((px) => block(c, L, s, px, R.w - 2 * pad));
      const fromTop = head(L, s);
      let hit: { x: number; y: number; plate: Rect; b: Block } | null = null;
      // clear of the graphics down to the level's minimum; then over them, on its plate, where the style sets text
      // over graphics itself (review R17 S3); else flagged
      for (const clear of overOk(s) ? [true, false] : [true]) {
        for (let i = 0; i < sizes.length && !hit; i++) {
          const b = blocks[i];
          if (!b) continue;
          const p = find(b, s, fromTop, clear);
          if (p) hit = { ...p, b };
        }
        if (hit) break;
      }
      if (!hit) { got.flagged.push(L.id); continue; }
      got.places.push({ id: L.id, x: hit.x, y: hit.y, b: hit.b, plate: hit.plate });
      lowest = Math.min(lowest, hit.b.size);
      hard.push({ x: hit.plate.x - G + pad, y: hit.plate.y - G + pad, w: hit.plate.w + 2 * G - 2 * pad, h: hit.plate.h + 2 * G - 2 * pad });
    }
    if (byM.size > 400) byM.clear();
    byM.set(key, got);
  }
  // colours per form: a slot's setter again in its room; a plate's role and the ink that reads on it
  const items: Item[] = [];
  for (const p of got.places) {
    const L = c.spec.text.find((l) => l.id === p.id)!;
    if ('room' in p) {
      const out = soloSet(p.slot, L, p.room) ?? [];
      for (const it of out) {
        if (it.kind === 'text') { it.lid = p.id; it.extra = true; it.part = p.id + '.' + it.part; }
        items.push(it);
      }
      continue;
    }
    const s = sets[L.level];
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
  // plates first, so no layer's plate is drawn over another's text (rule 3)
  return { items: [...items.filter((i) => i.kind !== 'text'), ...items.filter((i) => i.kind === 'text')], flagged: [...got.flagged] };
}

/**
 * Room kept for the layers before the style lays out its own (at the foot of the text area): an estimate from the
 * words and the level's size alone, never from a face, so the type seed moves no graphic (9.3). Candidates try more
 * and less of it, and none; the fallback keeps none (it is the style's own, which always passes).
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
  // none at all in every fifth: where the style's own slots cannot fit the shorter area, a candidate still draws them
  // and the layers take what room is left, rather than the design falling back
  const f = k < 0 ? 0 : [1, 0.7, 1.25, 0.45, 0][k % 5];
  return Math.round(Math.min(h * f, area * 0.45));
}

/** A level's treatment in one line: face, upper case, start size (share of W), minimum, pitch, lines, tracking, from, align, plate, over graphics. */
export const lv = (font: LevelSet['font'], up: boolean, size: number, min: number, lh: number, lines: number, track: number, from: LevelSet['from'] = 'top', align: LevelSet['align'] = 'left', plate: LevelSet['plate'] = 'ground', over: LevelSet['over'] = false): LevelSet =>
  ({ font, upper: up, size, min, lh, lines, track, from, align, plate, places: [from === 'top' ? 'head' : 'foot'], over });
/** The same treatments with both places offered, the level's own first (Swiss and Postmodern place text, spec 10.3). */
export const bothPlaces = (sets: LevelSets): LevelSets =>
  Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, { ...s, places: s.from === 'top' ? ['head', 'foot'] : ['foot', 'head'] }])) as LevelSets;
/** A slot set alone in a room (`TypePart.solo`): the room is its box and the text area, with nothing else of the page. */
export const soloPlan = (plan: Plan, slot: Slot, room: Rect, extra: Partial<Plan> = {}): Plan =>
  ({ ...plan, boxes: { text: room, [slot]: room }, titleUp: false, ...extra });
