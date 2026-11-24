/**
 * The marks layer (spec 7.2, docs/design/elements.md): small technical graphics over any style, placed after text
 * and graphics in free space only, from the layout stream. Off draws nothing; light puts three or four marks in
 * free corners and edges; full adds the containers: the info slot in a chamfered card, an underline bar and a
 * micro label under the title. A mark never sits on a text item (the card holds the info slot and keeps off its ink).
 * Micro labels carry only what the spec knows (`labelOf`). Placement reads only boxes, never colours, so the
 * colour seed and the mode move no mark; colours are chosen from the palette roles by contrast with what is behind.
 */
import { contrast } from './colour';
import { bounds, overlaps, pad, rectQuad, union, type Quad, type Rect } from './geom';
import { sample } from './invariants';
import type { Measure } from './measure';
import { mix, rng, shuffle, type Rng } from './rng';
import type { FontRef, GraphicItem, Item, Scene, TextItem } from './scene';
import { seedCode, type Spec, type StyleId } from './spec';
import { STYLES } from './styles';
import type { Form } from '../data/palettes/types';

export type MarkKind = 'grid' | 'slashes' | 'brackets' | 'ruler' | 'crosshair' | 'barcode' | 'status' | 'label' | 'dots';
export const MARK_KINDS: MarkKind[] = ['grid', 'slashes', 'brackets', 'ruler', 'crosshair', 'barcode', 'status', 'label', 'dots'];
/** Which marks suit each style (spec 7.2). Containers (card, underline bar and its label) come with full in every style. */
export const MARKS_OF: Record<StyleId, MarkKind[]> = {
  swiss: ['ruler', 'crosshair', 'grid', 'brackets'],
  brutal: ['barcode', 'status', 'slashes'],
  pomo: MARK_KINDS,
  vapor: MARK_KINDS,
};

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

interface Ctx { W: number; H: number; story: boolean; r: Rng; m: Measure; spec: Spec; sc: Scene; texts: TextItem[]; placed: Rect[]; busy: Item[]; rules: Item[]; P: Form; insertAt: number; }

const isMark = (i: Item): i is GraphicItem => i.kind === 'graphic' && i.layer === 'mark';
const inside = (c: Ctx, b: Rect) => b.x >= 0 && b.y >= 0 && b.x + b.w <= c.W && b.y + b.h <= c.H;
/** Free: inside the canvas, no text item within `gap` px, no mark already there. */
function free(c: Ctx, b: Rect, gap = 18, except: TextItem[] = []): boolean {
  if (!inside(c, b)) return false;
  const q = rectQuad(pad(b, gap));
  if (c.texts.some((t) => !except.includes(t) && overlaps(t.quad, q))) return false;
  const q0 = rectQuad(pad(b, 10));
  // nor across a rule (a thin rect: Brutalist's table, Swiss's rules), where a mark reads as a mistake
  if (c.rules.some((it) => overlaps(it.quad, rectQuad(pad(b, 6))))) return false;
  return !c.placed.some((p) => overlaps(rectQuad(p), q0));
}
/** How much is already drawn there: a mark reads best on bare ground and outside the story zones. */
function busy(c: Ctx, b: Rect): number {
  const q = rectQuad(b);
  let n = 0;
  for (const it of c.busy) if (overlaps(it.quad, q)) n++;
  if (c.story && (b.y < 250 || b.y + b.h > c.H - 320)) n += 0.5;
  return n;
}
/** The least busy free spot among the candidates (they come in a seeded order, so ties go to the stream). */
function choose(c: Ctx, cands: Rect[]): Rect | null {
  let best: Rect | null = null, score = Infinity;
  for (const b of cands) {
    if (!free(c, b)) continue;
    const s = busy(c, b);
    if (s < score - 1e-9) { score = s; best = b; }
  }
  return best;
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

function item(c: Ctx, kind: string, b: Rect, params: GraphicItem['params'] = {}, avoid?: Quad[]): GraphicItem {
  const col = colours(c, b);
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
      const h = Math.round(between(r, 90, 130)), w = Math.round(h / Math.tan(Math.PI / 3) + 64 + 44 + 5 + 1.5 + 3 * 14);
      const b = choose(c, spots(c, w, h, 'corner', true));
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
      const w = 76 + 12 + Math.max(labelW(c, src[0]), labelW(c, src[1])), b = choose(c, spots(c, w, 76, 'any'));
      return b ? [item(c, 'crosshair', b, { label: a, label2: z, src: src[0].join(','), src2: src[1].join(',') })] : [];
    }
    case 'barcode': {
      const id = labelOf(['seed'], c.spec, c.sc.palette), w = Math.max(Math.round(between(r, 180, 260)), labelW(c, ['seed'])), b = choose(c, spots(c, w, 58, 'any'));
      return b ? [item(c, 'barcode', b, { label: id, src: 'seed' })] : [];
    }
    case 'status': {
      const n = 6 + Math.floor(r() * 5), on = 1 + Math.floor(r() * (n - 1)), src: LabelSrc[] = r() < 0.5 ? ['counter'] : ['format'];
      const lab = labelOf(src, c.spec, c.sc.palette), b = choose(c, spots(c, n * 18 + 12 + labelW(c, src), 24, 'edge'));
      return b ? [item(c, 'status', b, { cells: n, on, label: lab, src: src.join(',') })] : [];
    }
    case 'label': {
      const src = LABEL_SETS[Math.floor(r() * LABEL_SETS.length)], lab = labelOf(src, c.spec, c.sc.palette);
      const b = choose(c, spots(c, labelW(c, src) + 2, 20, 'edge'));
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
    const ok = inside(c, b) && b.w * b.h < 0.45 * c.W * c.H && !others.some((t) => overlaps(t.quad, rectQuad(pad(b, 6)))) && !c.placed.some((p) => overlaps(rectQuad(p), rectQuad(b)));
    if (ok) card = item(c, 'card', b, { chamfer: 28 }, info.map((t) => t.quad));
  }
  const title = c.texts.filter((t) => t.slot === 'title');
  if (title.length) {
    const T = union(title.map((t) => bounds(t.quad))), len = Math.round(between(c.r, 360, 430));
    for (const y of [T.y + T.h + 16, T.y - 20]) {
      const bar = { x: Math.max(M, Math.min(T.x, c.W - len - M)), y, w: len, h: 4 };
      if (!free(c, bar, 8)) continue;
      rest.push(item(c, 'bar', bar, { tone: 0 }));
      const src = LABEL_SETS[Math.floor(c.r() * LABEL_SETS.length)], lab = labelOf(src, c.spec, c.sc.palette), lw = labelW(c, src) + 2;
      // beside the bar on the free side, else under it
      for (const L of [{ x: bar.x + len + 14, y: y - 8, w: lw, h: 20 }, { x: bar.x - 14 - lw, y: y - 8, w: lw, h: 20 }, { x: bar.x, y: y + 12, w: lw, h: 20 }]) {
        if (free(c, L, 8)) { rest.push(item(c, 'label', L, { label: lab, src: src.join(',') })); break; }
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
  const c: Ctx = { W: sc.w, H: sc.h, story: sc.format === '9:16', r: rng(mix(spec.seeds.layout, SALT)), m, spec, sc, texts, placed: [], busy: busyItems, rules, P, insertAt };
  const kinds = shuffle(c.r, [...MARKS_OF[spec.style]]);
  const n = 3 + (c.r() < 0.5 ? 1 : 0);
  const out: GraphicItem[] = [];
  let card: GraphicItem | null = null;
  // the containers first at full: they have one place each, the free marks have many
  if (spec.marks === 'full') { const k = containers(c); card = k.card; out.push(...k.rest); }
  for (let i = 0, got = 0; i < kinds.length * 2 && got < n; i++) {
    const g = place(c, kinds[i % kinds.length]);
    if (g.length) { out.push(...g); got++; }
  }
  const next = [...items.slice(0, insertAt), ...out, ...items.slice(insertAt)];
  if (card) {
    // the card goes under the info text, which it keeps off (avoid), so it is never behind its ink
    const first = next.findIndex((i) => i.kind === 'text' && i.slot === 'info');
    next.splice(first, 0, card);
  }
  return { ...sc, items: next };
}

/** Marks over text (spec 7.2): every mark whose box meets a text item it is not built to hold. Must be empty. */
export function markOverlaps(sc: Scene): string[] {
  const out: string[] = [];
  const texts = sc.items.filter((i): i is TextItem => i.kind === 'text');
  for (const g of sc.items) {
    if (!isMark(g)) continue;
    for (const t of texts) {
      if (!overlaps(g.quad, t.quad)) continue;
      // a container holds its text: it keeps off that text's ink (avoid), and nothing else
      if (g.avoid?.some((q) => q === t.quad || JSON.stringify(q) === JSON.stringify(t.quad))) continue;
      out.push(`${g.params.kind} on ${t.slot}.${t.part}`);
    }
  }
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
