/**
 * The marks layer (spec 7.2, docs/design/elements.md): small technical graphics over any style, placed after text
 * and graphics in free space only, from the layout stream. Off draws nothing; light puts three or four marks in
 * free corners and edges; full adds the containers: the info slot in a chamfered card, an underline bar and a
 * micro label under the title. A mark never sits on a text item (the card holds the info slot and keeps off its ink).
 * Micro labels carry only what the spec knows (`labelOf`). Placement reads only boxes, never colours, so the
 * colour seed and the mode move no mark; colours are chosen from the palette roles by contrast with what is behind.
 */
import { contrast } from './colour';
import { coverOf } from './cover';
import { bounds, overlaps, pad, rectQuad, union, type Quad, type Rect } from './geom';
import { sample } from './invariants';
import type { Measure } from './measure';
import { mix, rng, shuffle, type Rng } from './rng';
import type { FontRef, GraphicItem, Item, RectItem, Scene, TextItem } from './scene';
import { seedCode, type Spec, type StyleId } from './spec';
import { STYLES } from './styles';
import type { Form } from '../data/palettes/types';
import type { Switch } from './controls';

export type MarkKind = 'grid' | 'slashes' | 'brackets' | 'ruler' | 'crosshair' | 'barcode' | 'status' | 'label' | 'dots';
export const MARK_KINDS: MarkKind[] = ['grid', 'slashes', 'brackets', 'ruler', 'crosshair', 'barcode', 'status', 'label', 'dots'];
/** Which marks suit each style (spec 7.2). Containers (card, underline bar and its label) come with full in every style. */
export const MARKS_OF: Record<StyleId, MarkKind[]> = {
  swiss: ['ruler', 'crosshair', 'grid', 'brackets'],
  brutal: ['barcode', 'status', 'slashes'],
  pomo: MARK_KINDS,
  vapor: MARK_KINDS,
};

/** The params key that takes one free mark out of the design (spec 10.3, Advanced: which marks are allowed). */
export const markOffKey = (k: MarkKind) => `marks.no.${k}`;
/** The free marks this design may place: the style's list less those turned off by hand. */
export const marksAllowed = (spec: Spec): MarkKind[] => MARKS_OF[spec.style].filter((k) => spec.params[markOffKey(k)] !== true);
const MARK_LABEL: Record<MarkKind, string> = { grid: 'Grid', slashes: 'Slashes', brackets: 'Brackets', ruler: 'Ruler', crosshair: 'Cross', barcode: 'Barcode', status: 'Status', label: 'Label', dots: 'Dots' };
/** Advanced, Style tab: a switch per free mark of the style (on: allowed). Not a facet: Shuffle keeps them, as it keeps marks. */
export function marksControls(spec: Spec): Switch[] {
  return MARKS_OF[spec.style].map((k) => ({ kind: 'switch', id: markOffKey(k), label: MARK_LABEL[k], where: { at: 'params', key: markOffKey(k) }, facet: null, off: true, onLabel: MARK_LABEL[k], offLabel: MARK_LABEL[k] }));
}

/** The one face marks are set in: bundled with the app, so a mark never waits for a font. */
export const MARK_FONT: FontRef = { family: 'DM Mono', weight: 400 };
export const LABEL_PX = 15;
export const LABEL_TRACK = 1.5;
const SALT = 0x6d61726b;

/** What a micro label may say (spec 7.2): the sources, all read from the spec. No date: it would break "same spec, same design". */
export type LabelSrc = 'app' | 'seed' | 'format' | 'style' | 'palette' | 'counter';
export const LABEL_SOURCES: LabelSrc[] = ['app', 'seed', 'format', 'style', 'palette', 'counter'];
/** A word naming a source may precede it; nothing else is written. */
const KEY: Partial<Record<LabelSrc, string>> = { seed: 'SEED' };
export function sourceValues(spec: Spec, paletteId: string): Record<LabelSrc, string> {
  const pal = STYLES[spec.style].parts.palette.list.find((p) => p.id === paletteId);
  return { app: 'RSTR', seed: seedCode(spec.seeds), format: spec.format, style: STYLES[spec.style].name.toUpperCase(), palette: (pal?.name ?? paletteId).toUpperCase(), counter: '01 / 01' };
}
/** A label from its sources, joined by a middle dot. */
export function labelOf(src: LabelSrc[], spec: Spec, paletteId: string): string {
  const v = sourceValues(spec, paletteId);
  return src.map((s) => (KEY[s] ? `${KEY[s]} ${v[s]}` : v[s])).join(' · ');
}
const LABEL_SETS: LabelSrc[][] = [['app', 'format'], ['seed'], ['style', 'palette'], ['counter'], ['format', 'counter'], ['palette']];

interface Ctx {
  W: number; H: number; story: boolean; r: Rng; m: Measure; spec: Spec; sc: Scene; texts: TextItem[]; placed: Rect[]; busy: Item[]; rules: Item[]; P: Form; insertAt: number;
  /** The plates text is set on (a text item's container: bars, highlight plates, boxes, windows, labels, strips). */
  plates: RectItem[];
  /** First round: a mark goes only where no shape's ink is under it (review bundle 3 M1). */
  bare: boolean;
}

const isMark = (i: Item): i is GraphicItem => i.kind === 'graphic' && i.layer === 'mark';
const inside = (c: Ctx, b: Rect) => b.x >= 0 && b.y >= 0 && b.x + b.w <= c.W && b.y + b.h <= c.H;
/** Bounds of a quad, once per quad (the sweep tests thousands of boxes against the same items). */
const BB = new WeakMap<Quad, Rect>();
const bb = (q: Quad) => { let r = BB.get(q); if (!r) { r = bounds(q); BB.set(q, r); } return r; };
/** Quad q overlaps box b grown by g px: bounds first, then the exact test. */
function hits(q: Quad, b: Rect, g = 0): boolean {
  const R = bb(q);
  if (R.x >= b.x + b.w + g || R.x + R.w <= b.x - g || R.y >= b.y + b.h + g || R.y + R.h <= b.y - g) return false;
  return overlaps(q, rectQuad(g ? pad(b, g) : b));
}
/** Free: inside the canvas, no text item within `gap` px, no mark already there, off every rule and text plate. */
function free(c: Ctx, b: Rect, gap = 18, except: TextItem[] = []): boolean {
  if (!inside(c, b)) return false;
  if (c.texts.some((t) => !except.includes(t) && hits(t.quad, b, gap))) return false;
  // nor across a rule (a thin rect: Brutalist's table, Swiss's rules), where a mark reads as a mistake
  if (c.rules.some((it) => hits(it.quad, b, 6))) return false;
  // nor on a plate text is set on: the plate is that text's container (spec 8.3), so a mark there is on the text
  // item (spec 7.2; review bundle 3 S2: slashes cut into the Brutalist subtitle bar)
  if (c.plates.some((it) => hits(it.quad, b, 6))) return false;
  return !c.placed.some((p) => p.x < b.x + b.w + 10 && p.x + p.w > b.x - 10 && p.y < b.y + b.h + 10 && p.y + p.h > b.y - 10 && overlaps(rectQuad(p), rectQuad(pad(b, 10))));
}
/** coverOf, once per graphic (the sweep asks thousands of times). */
const COV = new WeakMap<GraphicItem, number>();
const cover = (g: GraphicItem) => { let v = COV.get(g); if (v === undefined) { v = coverOf(g); COV.set(g, v); } return v; };
/** The share of box b that rect R covers (axis-aligned bounds). */
function share(R: Rect, b: Rect): number {
  const w = Math.min(R.x + R.w, b.x + b.w) - Math.max(R.x, b.x), h = Math.min(R.y + R.h, b.y + b.h) - Math.max(R.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.max(1, b.w * b.h) : 0;
}
/** How much shape ink lies under a box: each graphic by the share of the box its extent covers, times how much of
 *  its extent it inks (`coverOf`), so a sparse field counts for little and a solid shape for all (review bundle 3 M1). */
function shapeInk(c: Ctx, b: Rect): number {
  let n = 0;
  for (const it of c.busy) if (it.kind === 'graphic' && hits(it.quad, b)) n += share(bb(it.quad), b) * cover(it);
  return n;
}
/** How much is already drawn there: a mark reads best on bare ground and outside the story zones. */
function busy(c: Ctx, b: Rect): number {
  let n = shapeInk(c, b);
  for (const it of c.busy) if (it.kind === 'rect' && hits(it.quad, b)) n += share(bb(it.quad), b);
  if (c.story && (b.y < 250 || b.y + b.h > c.H - 320)) n += 0.5;
  return n;
}
/** Bare enough for the first round: next to no shape ink under it. */
const BARE = 0.02;
/** The least busy free spot among the candidates (they come in a seeded order, so ties go to the stream). In the
 *  first round a spot with shape ink under it is not a candidate: the mark waits for the second round, which runs
 *  only where the first left fewer than three marks (review bundle 3 M1). */
function choose(c: Ctx, cands: Rect[], scan = true, ok: (b: Rect) => boolean = () => true): Rect | null {
  let best: Rect | null = null, score = Infinity;
  for (const b of cands) {
    if (!free(c, b) || !ok(b)) continue;
    if (c.bare && shapeInk(c, b) > BARE) continue;
    const s = busy(c, b);
    if (s < score - 1e-9) { score = s; best = b; }
  }
  return best ?? (scan && cands.length ? choose(c, sweep(c, cands[0].w, cands[0].h), false, ok) : null);
}
/**
 * One surface behind the box: every item under it (but the ground layer's faint pattern) either misses it or is an
 * unturned rect that covers it whole. A mark carrying a micro label goes only there, so it never straddles two backgrounds and the
 * colour picked against what is behind holds over all of it (review bundle 3 M2). Reads boxes only (spec 9.3).
 */
function flat(c: Ctx, b: Rect): boolean {
  for (let j = 0; j < c.insertAt; j++) {
    const it = c.sc.items[j];
    if (it.kind === 'text' || (it.kind === 'graphic' && (it.layer === 'ground' || it.layer === 'mark' || it.pass))) continue;
    if (!hits(it.quad, b)) continue;
    if (it.kind === 'graphic' && cover(it) === 0) continue;
    const R = bb(it.quad);
    if (it.kind === 'rect' && !it.xf && R.x <= b.x && R.y <= b.y && R.x + R.w >= b.x + b.w && R.y + R.h >= b.y + b.h) continue;
    return false;
  }
  return true;
}
/** Where the margins and edges hold no room (Brutalist's ruled page fills them), every band of the page in turn:
 *  y in steps of 4 px from FLUSH to the bottom, at a few x, FLUSH px from the canvas edge at least, in a fixed
 *  order (no draw from the stream, so nothing after it moves). Review R7 S1. */
const FLUSH = 12;
function sweep(c: Ctx, w: number, h: number): Rect[] {
  const out: Rect[] = [], xs = [FLUSH, M, Math.round((c.W - w) / 4), Math.round((c.W - w) / 2), Math.round(((c.W - w) * 3) / 4), c.W - w - M, c.W - w - FLUSH];
  for (let y = FLUSH; y + h <= c.H - FLUSH; y += 4) for (const x of xs) if (x >= 0) out.push({ x, y, w, h });
  return out;
}

/** The palette roles a mark may be drawn in. */
function roles(P: Form): string[] {
  return [...new Set([P.ink, P.accent, P.accent2, P.accent3, P.ground, P.spot, P.toner].filter((x): x is string => !!x))];
}
/** Every colour directly behind a box: plates and fields sampled, graphics by their fills, the ground. */
function behindBox(c: Ctx, b: Rect): string[] {
  const q = rectQuad(b), out = new Set<string>();
  for (let j = c.insertAt - 1; j >= 0; j--) {
    const it = c.sc.items[j];
    if (it.kind === 'text') continue;
    if (it.kind === 'graphic') { if (!it.pass && it.layer !== 'mark' && overlaps(it.quad, q)) it.fills.forEach((f) => out.add(f)); continue; }
    if (overlaps(it.quad, q)) {
      sample(it.fill, q).forEach((f) => out.add(f));
      // an unturned rect that covers the whole box hides everything under it
      const R = bounds(it.quad);
      if (!it.xf && R.x <= b.x && R.y <= b.y && R.x + R.w >= b.x + b.w && R.y + R.h >= b.y + b.h) return [...out];
    }
  }
  out.add(c.sc.ground);
  return [...out];
}
/** The role with the best contrast against everything behind, and a second (an accent where one shows) for two-colour marks. */
function colours(c: Ctx, b: Rect): { c: string; c2: string } {
  const bg = behindBox(c, b), score = (x: string) => Math.min(...bg.map((y) => contrast(x, y)));
  const all = roles(c.P).sort((a, z) => score(z) - score(a));
  const first = all[0];
  const acc = [c.P.accent, c.P.accent2, c.P.accent3].filter((x): x is string => !!x && x !== first).sort((a, z) => score(z) - score(a));
  const second = acc.find((x) => score(x) >= 1.6) ?? all.find((x) => x !== first && score(x) >= 1.6) ?? first;
  return { c: first, c2: second };
}

/** Where a mark's micro label lies inside its box (markdraw.ts): what must sit on one surface and read at 3:1. */
export function labelBoxOf(kind: string, b: Rect, p: GraphicItem['params']): Rect | null {
  switch (kind) {
    case 'label': return b;
    case 'crosshair': return typeof p.label === 'string' ? { x: b.x + 88, y: b.y + 18, w: b.w - 88, h: 44 } : null;
    case 'barcode': return p.beside ? { x: b.x + Number(p.beside) + 12, y: b.y, w: b.w - Number(p.beside) - 12, h: b.h } : { x: b.x, y: b.y + b.h - 18, w: b.w, h: 18 };
    case 'status': return { x: b.x + Number(p.cells) * 18 + 12, y: b.y, w: b.w - Number(p.cells) * 18 - 12, h: b.h };
    default: return null;
  }
}
/** A candidate test: the label part of a mark of this kind sits on one surface. */
const flatLabel = (c: Ctx, kind: string, p: GraphicItem['params'] = {}) => (b: Rect) => flat(c, labelBoxOf(kind, b, p)!);

function item(c: Ctx, kind: string, b: Rect, params: GraphicItem['params'] = {}, avoid?: Quad[]): GraphicItem {
  // a mark with words takes the colour that reads best on what is behind its words (review bundle 3 M2)
  const col = colours(c, labelBoxOf(kind, b, params) ?? b);
  c.placed.push(b);
  return {
    kind: 'graphic', name: 'mark', box: b, seed: mix(c.spec.seeds.layout, SALT + c.placed.length), skip: 0,
    colours: col, params: { kind, ...params }, fills: [col.c, col.c2], quad: rectQuad(b), layer: 'mark', ...(avoid ? { avoid } : {}),
  };
}

const textW = (c: Ctx, s: string) => { const mt = c.m(s, MARK_FONT, LABEL_PX, LABEL_TRACK); return Math.ceil(mt.width); };
/**
 * The width a label of these sources takes: with the palette among them, the widest palette name of the style,
 * so the colour seed (which picks the palette) never moves a box (9.3). The seed code is always nine characters.
 */
function labelW(c: Ctx, src: LabelSrc[]): number {
  if (!src.includes('palette')) return textW(c, labelOf(src, c.spec, c.sc.palette));
  return Math.max(...STYLES[c.spec.style].parts.palette.list.map((p) => textW(c, labelOf(src, c.spec, p.id))));
}
const between = (r: Rng, a: number, b: number) => a + r() * (b - a);
const M = 40;

/** Candidate boxes for a w x h mark: the four corners, then points along the edges, in a seeded order per group. */
function spots(c: Ctx, w: number, h: number, where: 'corner' | 'edge' | 'any', flush = false): Rect[] {
  const { W, H, r } = c, m = flush ? 0 : M;
  const xs = [m, W - w - m], ys = [M, H - h - M];
  const corners = shuffle(r, xs.flatMap((x) => ys.map((y) => ({ x, y, w, h }))));
  const edges: Rect[] = [];
  for (const t of [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
    edges.push({ x: Math.round((W - w) * t), y: M, w, h }, { x: Math.round((W - w) * t), y: H - h - M, w, h });
    edges.push({ x: M, y: Math.round((H - h) * t), w, h }, { x: W - w - M, y: Math.round((H - h) * t), w, h });
  }
  shuffle(r, edges);
  return where === 'corner' ? corners : where === 'edge' ? [...edges, ...corners] : [...corners, ...edges];
}

/** One mark of the light set, or null where it finds no free place. */
function place(c: Ctx, kind: MarkKind): GraphicItem[] {
  const { r } = c;
  switch (kind) {
    case 'grid': {
      const cols = 3 + Math.floor(r() * 3), rows = 3 + Math.floor(r() * 3), b = choose(c, spots(c, cols * 54 + 1, rows * 54 + 1, 'any'));
      return b ? [item(c, 'grid', b, { cell: 54 })] : [];
    }
    case 'slashes': {
      const h = Math.round(between(r, 90, 130)), wOf = (hh: number) => Math.round(hh / Math.tan(Math.PI / 3) + 64 + 44 + 5 + 1.5 + 3 * 14);
      // a corner first; where none is free, smaller, from either side edge in any band of the page (review R7 S1)
      let b = choose(c, spots(c, wOf(h), h, 'corner', true), false);
      for (const hh of [64, 40, 28]) {
        if (b) break;
        const w = wOf(hh);
        b = choose(c, sweep(c, w, hh).filter((q) => q.x === FLUSH || q.x === c.W - w - FLUSH).map((q) => ({ ...q, x: q.x === FLUSH ? 0 : c.W - w })), false);
      }
      // the medium slash runs in from the canvas edge, partly off it: which side that is
      return b ? [item(c, 'slashes', b, { from: b.x <= 0 ? 'left' : 'right' })] : [];
    }
    case 'ruler': {
      const L = Math.round(between(r, 200, 340) / 8) * 8 + 1, along = r() < 0.5;
      const b = choose(c, along ? spots(c, L, 22, 'edge') : spots(c, 22, L, 'edge'));
      return b ? [item(c, 'ruler', b, { step: 8, vertical: b.h > b.w })] : [];
    }
    case 'crosshair': {
      const src: LabelSrc[][] = [['format'], ['seed']], a = labelOf(src[0], c.spec, c.sc.palette), z = labelOf(src[1], c.spec, c.sc.palette);
      const w = 76 + 12 + Math.max(labelW(c, src[0]), labelW(c, src[1])), b = choose(c, spots(c, w, 76, 'any'), true, flatLabel(c, 'crosshair', { label: a }));
      if (b) return [item(c, 'crosshair', b, { label: a, label2: z, src: src[0].join(','), src2: src[1].join(',') })];
      // nowhere its words sit on one surface: the crosshair alone, without them (review bundle 3 M2)
      const b2 = choose(c, spots(c, 76, 76, 'any'));
      return b2 ? [item(c, 'crosshair', b2, {})] : [];
    }
    case 'barcode': {
      const id = labelOf(['seed'], c.spec, c.sc.palette), bw = Math.round(between(r, 180, 260)), w = Math.max(bw, labelW(c, ['seed']));
      const b = choose(c, spots(c, w, 58, 'any'), true, flatLabel(c, 'barcode'));
      if (b) return [item(c, 'barcode', b, { label: id, src: 'seed' })];
      // no room for the strip over its label: a short strip with the label beside it, 24 px tall (review R7 S1)
      const sw = Math.round(bw / 2), b2 = choose(c, sweep(c, sw + 12 + labelW(c, ['seed']), 24), false, flatLabel(c, 'barcode', { beside: sw }));
      return b2 ? [item(c, 'barcode', b2, { label: id, src: 'seed', beside: sw })] : [];
    }
    case 'status': {
      const n = 6 + Math.floor(r() * 5), on = 1 + Math.floor(r() * (n - 1)), src: LabelSrc[] = r() < 0.5 ? ['counter'] : ['format'];
      const lab = labelOf(src, c.spec, c.sc.palette), b = choose(c, spots(c, n * 18 + 12 + labelW(c, src), 24, 'edge'), true, flatLabel(c, 'status', { cells: n }));
      return b ? [item(c, 'status', b, { cells: n, on, label: lab, src: src.join(',') })] : [];
    }
    case 'label': {
      const src = LABEL_SETS[Math.floor(r() * LABEL_SETS.length)], lab = labelOf(src, c.spec, c.sc.palette);
      const b = choose(c, spots(c, labelW(c, src) + 2, 20, 'edge'), true, (x) => flat(c, x));
      return b ? [item(c, 'label', b, { label: lab, src: src.join(',') })] : [];
    }
    case 'dots': {
      const cols = 5 + Math.floor(r() * 4), rows = 3 + Math.floor(r() * 3), b = choose(c, spots(c, cols * 12, rows * 12, 'any'));
      return b ? [item(c, 'dots', b, { cols, rows, lit: Math.floor(r() * 1e9) })] : [];
    }
    case 'brackets': {
      // L-brackets on two opposite corners of the title block, the info block or the main graphic's box,
      // just outside it: each arm is its own item, so neither covers the block it frames
      const g = 16, L = 32, t = 3, diag = r() < 0.5;
      const blocks: Rect[] = [];
      for (const slot of ['title', 'info'] as const) {
        const ts = c.texts.filter((x) => x.slot === slot);
        if (ts.length) blocks.push(union(ts.map((x) => bounds(x.quad))));
      }
      const gr = c.sc.items.find((i): i is GraphicItem => i.kind === 'graphic' && !i.layer?.match(/ground|mark/) && !i.pass);
      if (gr) blocks.push(bounds(gr.quad));
      for (const B of blocks) {
        const tl = [{ x: B.x - g, y: B.y - g - t, w: L, h: t }, { x: B.x - g - t, y: B.y - g, w: t, h: L }];
        const br = [{ x: B.x + B.w + g - L, y: B.y + B.h + g, w: L, h: t }, { x: B.x + B.w + g, y: B.y + B.h + g - L, w: t, h: L }];
        const tr = [{ x: B.x + B.w + g - L, y: B.y - g - t, w: L, h: t }, { x: B.x + B.w + g, y: B.y - g, w: t, h: L }];
        const bl = [{ x: B.x - g, y: B.y + B.h + g, w: L, h: t }, { x: B.x - g - t, y: B.y + B.h + g - L, w: t, h: L }];
        const pair = diag ? [tl, br] : [tr, bl];
        const arms = pair.flat();
        if (!arms.every((a) => free(c, a, 6))) continue;
        // the two corners in two accents (elements.md): the second corner takes the second colour
        const out = pair.flatMap((p, k) => p.map((a) => item(c, 'bar', a, { tone: k })));
        return out;
      }
      return [];
    }
  }
}

/** The containers of full: the info slot in a chamfered card; an underline bar under the title with a micro label. */
function containers(c: Ctx): { card: GraphicItem | null; rest: GraphicItem[] } {
  let card: GraphicItem | null = null;
  const rest: GraphicItem[] = [];
  const info = c.texts.filter((t) => t.slot === 'info');
  if (info.length) {
    // the card frames the info text and any plate it sits on (a window, a label), so it never cuts across one
    let U = union(info.map((t) => bounds(t.quad)));
    for (const it of c.sc.items) if (it.kind === 'rect' && it.plate && info.some((t) => overlaps(it.quad, t.quad))) U = union([U, bounds(it.quad)]);
    const b = pad(U, 18);
    b.x -= 8; b.w += 8;    // room for the accent bar on the left
    const others = c.texts.filter((t) => !info.includes(t));
    // nor over another slot's plate: the card is drawn after every plate (review bundle 3 S2)
    const own = (p: RectItem) => info.some((t) => overlaps(p.quad, t.quad));
    const ok = inside(c, b) && b.w * b.h < 0.45 * c.W * c.H && !others.some((t) => overlaps(t.quad, rectQuad(pad(b, 6)))) && !c.placed.some((p) => overlaps(rectQuad(p), rectQuad(b)))
      && !c.plates.some((p) => !own(p) && overlaps(p.quad, rectQuad(b)));
    if (ok) card = item(c, 'card', b, { chamfer: 28 }, info.map((t) => t.quad));
  }
  const title = c.texts.filter((t) => t.slot === 'title');
  if (title.length) {
    const T = union(title.map((t) => bounds(t.quad))), len = Math.round(between(c.r, 360, 430));
    // under the title or over it, from its left end or its right; a flush-left title (Swiss, spec 8.1: one axis)
    // only from its left end (review R8 M1)
    const at = (x: number) => Math.max(M, Math.min(x, c.W - len - M));
    const left = c.spec.style === 'swiss';
    const spots = left ? [[at(T.x), T.y + T.h + 16], [at(T.x), T.y - 20]] : [[at(T.x), T.y + T.h + 16], [at(T.x + T.w - len), T.y + T.h + 16], [at(T.x), T.y - 20], [at(T.x + T.w - len), T.y - 20]];
    for (const [x, y] of spots) {
      const bar = { x, y, w: len, h: 4 };
      const down = y > T.y, away = down ? { x: bar.x, y, w: len, h: 24 } : { x: bar.x, y: y - 20, w: len, h: 24 };
      // the bar needs a row of its own: in a slit between the title and a graphic (the Brutalist 20 px between the
      // title and the band) it and its label read as strays (review R7); there, no bar. A slit is a graphic whose
      // near edge lies in the strip on the side away from the title and whose body runs on beyond it; a bar over a
      // graphic's body (a grid floor under a horizon glow), or by a small shape wholly in the strip, is not in one
      // (review R8 S1). A text plate or a rule in the strip is one too (free(), the plates and rules); bare text 8 px
      // clear of the bar is not (the bar's own clearance, as before R8).
      const over = c.busy.some((it) => it.kind === 'graphic' && hits(it.quad, bar));
      const slit = (it: Item) => {
        if (over || it.kind !== 'graphic' || !hits(it.quad, away, 8)) return false;
        // the near edge within the bar's own row (the 20 px its label takes beside it), the body beyond the strip
        const G = bb(it.quad);
        return down ? G.y >= bar.y && G.y <= bar.y + 12 && G.y + G.h > away.y + away.h : G.y + G.h <= bar.y + bar.h && G.y + G.h >= bar.y - 8 && G.y < away.y;
      };
      if (!free(c, bar, 8) || !free(c, away, 8, c.texts) || c.busy.some(slit)) continue;
      const src = LABEL_SETS[Math.floor(c.r() * LABEL_SETS.length)], lab = labelOf(src, c.spec, c.sc.palette), lw = labelW(c, src) + 2;
      rest.push(item(c, 'bar', bar, { tone: 0 }));
      // the label beside the bar on the free side (spec 7.2), else under it
      for (const L of [{ x: bar.x + len + 14, y: y - 8, w: lw, h: 20 }, { x: bar.x - 14 - lw, y: y - 8, w: lw, h: 20 }, { x: bar.x, y: y + 12, w: lw, h: 20 }]) {
        if (free(c, L, 8) && flat(c, L)) { rest.push(item(c, 'label', L, { label: lab, src: src.join(',') })); break; }
      }
      break;
    }
  }
  return { card, rest };
}

/** The Scene with its marks (spec 7.2). Off returns the Scene untouched. */
export function addMarks(sc: Scene, spec: Spec, m: Measure, P: Form): Scene {
  if (spec.marks === 'off') return sc;
  const items = sc.items;
  // marks go under any surface pass (the copier), so the pass covers them like everything else
  let insertAt = items.length;
  while (insertAt > 0 && items[insertAt - 1].kind === 'graphic' && (items[insertAt - 1] as GraphicItem).pass) insertAt--;
  const texts = items.filter((i): i is TextItem => i.kind === 'text');
  const busyItems = items.filter((i) => (i.kind === 'graphic' && i.layer !== 'ground' && !i.pass) || (i.kind === 'rect' && !(bounds(i.quad).w >= sc.w && bounds(i.quad).h >= sc.h)));
  const rules = items.filter((i) => i.kind === 'rect' && Math.min(bounds(i.quad).w, bounds(i.quad).h) <= 16);
  const plates = platesOf(items.slice(0, insertAt), sc);
  const c: Ctx = { W: sc.w, H: sc.h, story: sc.format === '9:16', r: rng(mix(spec.seeds.layout, SALT)), m, spec, sc, texts, placed: [], busy: busyItems, rules, P, insertAt, plates, bare: true };
  const kinds = shuffle(c.r, marksAllowed(spec));
  // three or four, each kind at most once (review R7 S2: the same barcode twice reads as a mistake)
  const n = Math.min(kinds.length, 3 + (c.r() < 0.5 ? 1 : 0));
  const out: GraphicItem[] = [];
  let card: GraphicItem | null = null;
  // the containers first at full: they have one place each, the free marks have many
  if (spec.marks === 'full') { const k = containers(c); card = k.card; out.push(...k.rest); }
  // first round: bare spots only; second, only to reach three, the least inked spots (review bundle 3 M1: a mark
  // on a shape reads as debris, and light allows three)
  const done = new Set<MarkKind>();
  let got = 0;
  for (const [bare, want] of [[true, n], [false, 3]] as const) {
    c.bare = bare;
    for (let i = 0; i < kinds.length && got < want; i++) {
      if (done.has(kinds[i])) continue;
      const g = place(c, kinds[i]);
      // each item says which free mark it belongs to (a bracket is four items), for the tests
      if (g.length) { out.push(...g.map((x) => ({ ...x, params: { ...x.params, mark: kinds[i] } }))); got++; done.add(kinds[i]); }
    }
  }
  // the copier's dark edges keep off every mark that carries words, as they keep off the text (review bundle 3 M2)
  const pass = items.slice(insertAt).map((it) => (it.kind === 'graphic' && it.pass && it.keep ? keepOff(it, out, sc) : it));
  const next = [...items.slice(0, insertAt), ...out, ...pass];
  if (card) {
    // the card goes under the info text, which it keeps off (avoid), so it is never behind its ink
    const first = next.findIndex((i) => i.kind === 'text' && i.slot === 'info');
    next.splice(first, 0, card);
  }
  return { ...sc, items: next };
}

/** The plates text is set on: rects marked as plates that hold a text item, not the whole canvas. */
export function platesOf(items: Item[], sc: Pick<Scene, 'w' | 'h' | 'items'>): RectItem[] {
  const texts = sc.items.filter((i): i is TextItem => i.kind === 'text');
  return items.filter((i): i is RectItem => {
    if (i.kind !== 'rect' || !i.plate) return false;
    const R = bounds(i.quad);
    return !(R.w >= sc.w && R.h >= sc.h) && texts.some((t) => overlaps(i.quad, t.quad));
  });
}
const WORDS = new Set(['label', 'crosshair', 'barcode', 'status']);
/** A copy of the surface pass whose dark edges stop short of every mark that carries words. */
function keepOff(g: GraphicItem, marks: GraphicItem[], sc: Scene): GraphicItem {
  const k = { ...g.keep! };
  for (const m of marks) {
    if (!WORDS.has(String(m.params.kind))) continue;
    const b = m.box;
    k.l = Math.min(k.l, Math.max(0, b.x) / sc.w); k.r = Math.min(k.r, Math.max(0, sc.w - b.x - b.w) / sc.w); k.t = Math.min(k.t, Math.max(0, b.y) / sc.h);
  }
  return { ...g, keep: k };
}

/** Marks over text (spec 7.2): every mark whose box meets a text item it is not built to hold, or the plate a text
 *  item is set on (its container, review bundle 3 S2). Must be empty. */
export function markOverlaps(sc: Scene): string[] {
  const out: string[] = [];
  const texts = sc.items.filter((i): i is TextItem => i.kind === 'text');
  const plates = platesOf(sc.items, sc);
  const held = (g: GraphicItem, q: Quad) => !!g.avoid?.some((a) => a === q || JSON.stringify(a) === JSON.stringify(q));
  for (const g of sc.items) {
    if (!isMark(g)) continue;
    for (const t of texts) {
      if (!overlaps(g.quad, t.quad)) continue;
      // a container holds its text: it keeps off that text's ink (avoid), and nothing else
      if (held(g, t.quad)) continue;
      out.push(`${g.params.kind} on ${t.slot}.${t.part}`);
    }
    for (const p of plates) {
      if (!overlaps(g.quad, p.quad)) continue;
      // the card may hold the plates of the text it holds
      const on = texts.filter((t) => overlaps(p.quad, t.quad));
      if (on.length && on.every((t) => held(g, t.quad))) continue;
      out.push(`${g.params.kind} on the plate of ${on.map((t) => `${t.slot}.${t.part}`).join(', ')}`);
    }
  }
  return out;
}

/** The free marks of a Scene by whether shape ink lies under them, as the first round reads it (review bundle 3
 *  M1): a mark on a shape is allowed only where the bare ones were fewer than three. */
export function marksOnShapes(sc: Scene): { bare: number; onShape: number } {
  const marks = sc.items.filter(isMark).filter((g) => typeof g.params.mark === 'string' && g.params.mark !== 'brackets');
  const busy = sc.items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.layer !== 'ground' && i.layer !== 'mark' && !i.pass);
  const c = { busy } as unknown as Ctx;
  let bare = 0, onShape = 0;
  for (const g of marks) { if (shapeInk(c, g.box) > BARE) onShape++; else bare++; }
  return { bare, onShape };
}

/** Every colour directly behind a mark of the Scene. */
export function behindMark(sc: Scene, g: GraphicItem): string[] {
  return behindBox({ sc, insertAt: sc.items.indexOf(g) } as Ctx, g.box);
}

/** Every mark carrying a micro label (a label, crosshair, barcode or status cells) whose colour reads under 3:1 on
 *  anything directly behind its words (review bundle 3 M2). Must be empty. */
export function labelFloor(sc: Scene): string[] {
  const out: string[] = [];
  sc.items.forEach((g) => {
    const L = isMark(g) ? labelBoxOf(String(g.params.kind), g.box, g.params) : null;
    if (!L || !isMark(g)) return;
    const bg = behindBox({ sc, insertAt: sc.items.indexOf(g) } as Ctx, L);
    const low = bg.filter((y) => contrast(g.colours.c, y) < 3);
    if (low.length) out.push(`${g.params.label}: ${g.colours.c} on ${low.join(', ')}`);
  });
  return out;
}

/** Every micro label of a Scene and whether it says only what its declared sources hold (spec 7.2). */
export function labelsOf(sc: Scene, spec: Spec): { label: string; src: string; ok: boolean }[] {
  const out: { label: string; src: string; ok: boolean }[] = [];
  for (const g of sc.items) {
    if (!isMark(g)) continue;
    for (const [lk, sk] of [['label', 'src'], ['label2', 'src2']] as const) {
      const label = g.params[lk];
      if (typeof label !== 'string') continue;
      const src = String(g.params[sk] ?? '');
      const list = src.split(',').filter(Boolean) as LabelSrc[];
      const ok = list.length > 0 && list.every((s) => LABEL_SOURCES.includes(s)) && label === labelOf(list, spec, sc.palette);
      out.push({ label, src, ok });
    }
  }
  return out;
}
