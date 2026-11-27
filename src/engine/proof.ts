/** The proof of spec 9.2 and 9.3 over many seeds. Run by the unit tests (stub measure) and the smoke run (real fonts). */
import { FORMAT_LIST, type Format } from './formats';
import { check, type Failure } from './invariants';
import { choosePairing, partCtx, solve, type Use } from './layout';
import { PAIRINGS } from '../data/pairings';
import type { Measure } from './measure';
import { mix, rng } from './rng';
import type { Item, Scene, TextItem } from './scene';
import { coverOf } from './cover';
import { STYLES } from './styles';
import { labelsOf, markOverlaps } from './marks';
import { DEFAULT_SLOTS, defaultSpec, extrasOf, layersOf, LEVELS, slotsOf, SLOTS, type InfoPair, type Level, type TextLayer, STYLE_IDS, type Mode, type Spec, type StyleId } from './spec';
import { advancedOf, allControls, valuesOf } from './advanced';
import { apply, designColours, setColour } from './controls';
import { choosePalette } from './layout';
import { EDIT_GREY } from '../data/palettes/system';

export { coverOf };

export const TITLES = { one: 'Signal', three: 'Signal and noise', eight: 'Eight plain words make a long poster title' };

/** Text variants: short, typical and long titles with every slot on, then each slot alone. */
export function textVariants(): { name: string; text: Spec['text'] }[] {
  const out: { name: string; text: Spec['text'] }[] = [];
  for (const [name, v] of Object.entries(TITLES)) {
    const t = structuredClone(DEFAULT_SLOTS);
    t.title.v = v;
    out.push({ name: 'all-' + name, text: layersOf(t) });
  }
  for (const s of SLOTS) {
    const t = structuredClone(DEFAULT_SLOTS);
    for (const o of SLOTS) t[o].on = o === s;
    out.push({ name: s + '-alone', text: layersOf(t) });
  }
  return out;
}

export function seedSet(i: number): Spec['seeds'] {
  return { layout: mix(0x5eed, i * 4 + 1), colour: mix(0x5eed, i * 4 + 2), graphic: mix(0x5eed, i * 4 + 3), type: mix(0x5eed, i * 4 + 4) };
}

/**
 * picks: 'none' runs unpicked specs only; 'each' runs, instead, one spec set per value of pick.layout and
 * pick.motif the style lists. variants: 'all' runs every text variant on every seed set (spec 9.2);
 * 'cycle' gives seed set i the variant i mod 9 (cheaper, for the independence run and picked specs).
 */
export interface Opts {
  styles?: StyleId[]; formats?: Format[]; modes?: Mode[]; n?: number; start?: number;
  picks?: 'none' | 'each'; variants?: 'all' | 'cycle';
  /** Run one spec set per palette of the style, with pick.palette set (every palette in every mode). */
  palettes?: boolean;
  /** Run one spec set per pairing of the style, with pick.pairing set; or only the listed pairing ids. */
  pairings?: boolean | string[];
  /** Advanced values set on every spec (spec.params), and picks set on every spec. */
  params?: Spec['params'];
  pick?: Partial<Spec['pick']>;
  /** The marks level and finish set on every spec (spec 7; absent: off and clean). */
  marks?: Spec['marks'];
  finish?: Spec['finish'];
  /** The photo set on every spec (spec 8.9, 9.4): a registered photo's id, and where it is pinned. */
  photo?: Spec['photo'];
  /** Text layer list i (`layerMix`) on seed set i in place of the text variants (spec 8.6, review R17 S6). */
  layers?: boolean;
}
/** What layout may use for a spec: the app's font check (spec 6). Absent: every pairing is drawn as asked. */
export type Resolve = (spec: Spec) => Use;
/** fallbackSpecs: the first 20 specs that fell back, so an unexpected fallback can be printed. */
export interface Report { count: number; fallbacks: number; fallbackSpecs: Spec[]; failures: { spec: Spec; failures: Failure[] }[]; pairings: string[]; fonts: string[]; faces: string[]; }

type Pick = Partial<Spec['pick']>;
/** One pick per value of pick.layout and pick.motif the style lists. */
export function picksOf(style: StyleId): Pick[] {
  const st = STYLES[style];
  return [...st.layouts.map((layout) => ({ layout })), ...st.motifs.map((motif) => ({ motif })), ...(st.parts.layout.dialects ?? []).map((dialect) => ({ dialect }))];
}

/** Picks that make a style draw one of its library graphics: its motif if it is one, and whatever its parts ask (a dialect). */
export function pickForGraphic(style: StyleId, name: string): Pick {
  const st = STYLES[style];
  return { motif: st.motifs.includes(name) ? name : null, ...st.parts.ground.pickFor?.(name), ...st.parts.graphics.pickFor?.(name) };
}

function palettePicks(style: StyleId, o: Opts, picks: Pick[]): Pick[] {
  if (!o.palettes) return picks;
  return STYLES[style].parts.palette.list.flatMap((p) => picks.map((pk) => ({ ...pk, palette: p.id })));
}

function pairingPicks(style: StyleId, o: Opts, picks: Pick[]): Pick[] {
  if (!o.pairings) return picks;
  const ids = PAIRINGS[style].map((p) => p.id).filter((id) => o.pairings === true || (o.pairings as string[]).includes(id));
  return ids.flatMap((pairing) => picks.map((pk) => ({ ...pk, pairing })));
}

export function* specs(o: Opts = {}): Generator<Spec> {
  const variants = textVariants();
  const start = o.start ?? 0, n = o.n ?? 200;
  for (const style of o.styles ?? STYLE_IDS)
    for (const pk of pairingPicks(style, o, palettePicks(style, o, o.picks === 'each' ? picksOf(style) : [{} as Pick])))
      for (const format of o.formats ?? FORMAT_LIST)
        for (const mode of o.modes ?? (['light', 'dark'] as Mode[]))
          for (let i = start; i < start + n; i++)
            for (const v of o.variants === 'cycle' ? [variants[i % variants.length]] : variants) {
              const s = defaultSpec(seedSet(i));
              s.style = style; s.format = format; s.mode = mode; s.text = o.layers ? layerMix(i) : structuredClone(v.text);
              s.pick = { ...s.pick, ...o.pick, ...pk };
              if (o.params) s.params = { ...o.params };
              if (o.marks) s.marks = o.marks;
              if (o.finish) s.finish = o.finish;
              if (o.photo) s.photo = structuredClone(o.photo);
              yield s;
            }
}

/** 9.2 rules 1 to 5 on the final Scene of every spec. */
export function runInvariants(m: Measure, o: Opts = {}, resolve?: Resolve): Report {
  const r: Report = { count: 0, fallbacks: 0, fallbackSpecs: [], failures: [], pairings: [], fonts: [], faces: [] };
  const pairings = new Set<string>(), fonts = new Set<string>(), faces = new Set<string>();
  for (const spec of specs(o)) {
    r.count++;
    const { scene } = solve(spec, m, resolve?.(spec));
    pairings.add(scene.pairing);
    scene.fonts.forEach((f) => fonts.add(f));
    scene.faces.forEach((f) => faces.add(f));
    if (scene.layout === 'fallback' && r.fallbacks++ < 20) r.fallbackSpecs.push(spec);
    const f = check(scene);
    // the marks layer (spec 7.2): no mark on a text item it does not hold; labels say only what the spec holds
    if (spec.marks !== 'off') {
      for (const m of markOverlaps(scene)) f.push({ rule: 3, part: 'mark', msg: m });
      for (const l of labelsOf(scene, spec)) if (!l.ok) f.push({ rule: 0, part: 'mark', msg: `label "${l.label}" from ${l.src}` });
    }
    if (f.length && r.failures.length < 50) r.failures.push({ spec, failures: f });
  }
  r.pairings = [...pairings].sort();
  r.fonts = [...fonts].sort();
  r.faces = [...faces].sort();
  return r;
}

const round = (q: number[][]) => q.map((p) => p.map((v) => Math.round(v * 100) / 100));
// a mark's params hold its micro label, which may name the palette: a mark is compared by where it is (spec 7.2)
/**
 * What a facet may change on the photo item that is not where it is (review R12 E1). The colour seed and the mode: the
 * treatment values that come from the palette (spec 8.9: duotone's two roles, halftone's light-on-dark in a dark design,
 * posterise's colour count, a treatment a small palette cannot draw), its colours. The type seed: the share of its box
 * that shows, a reading of the text over it (the text moves with the type seed).
 */
const PHOTO_FREE = { colour: ['treat', 'duo', 'inv', 'levels'], type: ['share'] } as const;
const paramsOf = (i: Item & { kind: 'graphic' }, free?: keyof typeof PHOTO_FREE) =>
  free && i.name === 'photo' ? Object.fromEntries(Object.entries(i.params).filter(([k]) => !(PHOTO_FREE[free] as readonly string[]).includes(k))) : i.params;
const boxes = (sc: Scene, keep: (i: Item) => boolean, free?: keyof typeof PHOTO_FREE) =>
  JSON.stringify(sc.items.filter(keep).map((i) => [i.kind, i.kind === 'graphic' ? (i.layer === 'mark' ? [i.name, i.box] : [i.name, i.box, i.seed, i.skip, paramsOf(i, free), i.xf]) : i.kind === 'text' ? [i.slot, i.part] : 0, round(i.quad)]));
/** Marks sit where the text leaves room (spec 7.2): a new type seed may move them, as it moves the text. */
const notMark = (i: Item) => !(i.kind === 'graphic' && i.layer === 'mark');

/**
 * 9.3: the colour seed moves no box; the type seed moves no graphic; the graphic seed moves no text box.
 * Also: switching the mode moves no box (a candidate passes for both forms of every palette).
 */
export function runIndependence(m: Measure, o: Opts = {}, resolve?: Resolve): { count: number; typeMoved: number; failures: { spec: Spec; facet: string }[] } {
  const out = { count: 0, typeMoved: 0, failures: [] as { spec: Spec; facet: string }[] };
  const go = (s: Spec) => solve(s, m, resolve?.(s)).scene;
  for (const spec of specs(o)) {
    out.count++;
    const base = go(spec);
    const vary = (facet: 'colour' | 'type' | 'graphic') => {
      const s = structuredClone(spec);
      s.seeds[facet] = mix(s.seeds[facet], 77);
      return go(s);
    };
    const c = vary('colour');
    if (boxes(base, () => true, 'colour') !== boxes(c, () => true, 'colour')) out.failures.push({ spec, facet: 'colour moved a box' });
    const t = vary('type');
    const gr = (i: Item) => i.kind === 'graphic' && notMark(i), other = (i: Item) => gr(i) && !(i.kind === 'graphic' && i.name === 'photo');
    // review bundle 6 M2: a move of the photo alone is named apart from a move of any other graphic, so the carried
    // type-seed move of the photo (Carried R12 from R12) can be bounded without hiding a move of anything else
    if (boxes(base, gr, 'type') !== boxes(t, gr, 'type')) out.failures.push({ spec, facet: boxes(base, other, 'type') === boxes(t, other, 'type') ? 'type moved the photo' : 'type moved a graphic' });
    // the check means something only where the type seed changed the pairing and so the text
    if (t.pairing !== base.pairing && boxes(base, (i) => i.kind === 'text') !== boxes(t, (i) => i.kind === 'text')) out.typeMoved++;
    const g = vary('graphic');
    if (boxes(base, (i) => i.kind === 'text') !== boxes(g, (i) => i.kind === 'text')) out.failures.push({ spec, facet: 'graphic moved a text box' });
    const md = structuredClone(spec);
    md.mode = spec.mode === 'light' ? 'dark' : 'light';
    if (boxes(base, () => true, 'colour') !== boxes(go(md), () => true, 'colour')) out.failures.push({ spec, facet: 'mode moved a box' });
  }
  return out;
}

/** One shuffle as the variety tests of spec 8.0 see it. */
export interface VarietyRow { frame: string; transform: string; graphics: string[]; palette: string; pairing: string; }
export interface VarietyLists { layouts: string[]; graphics: string[]; palettes: string[]; pairings: string[]; }
export interface Variety {
  count: number;
  /** Of the first 60, how many repeat an earlier one in layout, transform, first graphic, second graphic and palette. */
  repeats60: number;
  /** What never appeared in the shuffles (spec: every layout, graphic, palette and pairing in 300). */
  missing: VarietyLists;
  /** The most frequent layout and its share (spec: at most 25%). */
  top: { layout: string; share: number };
  pass: { sixty: boolean; coverage: boolean; share: boolean };
}

/** What the 60-shuffle test of spec 8.0 compares: layout, transform, first graphic, second graphic, palette. */
export const varietyKey = (r: { frame: string; transform: string; graphics: string[]; palette: string }): string =>
  [r.frame, r.transform, r.graphics[0] ?? '-', r.graphics[1] ?? '-', r.palette].join('|');

/** How many shuffles the 60-shuffle test spans, and how many times Shuffle redraws a design that repeats one of them. */
export const VARIETY_WINDOW = 60, VARIETY_TRIES = 8;

/**
 * Spec 8.0's 60-shuffle rule held by Shuffle itself (review R9 S1): drawn independently, the five facets of the key
 * repeat about once or twice in any 60 shuffles for every style, so a clean first window was a lucky seed. Draw, and
 * while the key is among the last VARIETY_WINDOW - 1 keys, draw again, at most VARIETY_TRIES times; the last draw
 * stands. The app's Shuffle and the variety runs go through this.
 */
export function freshDraw<T>(draw: () => T, keyOf: (t: T) => string, recent: readonly string[], tries = VARIETY_TRIES): { value: T; key: string } {
  let value = draw(), key = keyOf(value);
  for (let i = 0; i < tries && recent.includes(key); i++) { value = draw(); key = keyOf(value); }
  return { value, key };
}
/** The recent keys after one more shuffle: the newest VARIETY_WINDOW - 1. */
export const pushRecent = (recent: readonly string[], key: string): string[] => [...recent, key].slice(-(VARIETY_WINDOW - 1));

/** The three variety tests of spec 8.0 over a list of shuffles, in order. Pure, so the test of the tests can feed it rows. */
export function varietyOf(rows: VarietyRow[], lists: VarietyLists): Variety {
  const seen = new Set<string>();
  let repeats60 = 0;
  for (const r of rows.slice(0, 60)) {
    const key = varietyKey(r);
    if (seen.has(key)) repeats60++;
    seen.add(key);
  }
  const has = (f: (r: VarietyRow) => string[]) => new Set(rows.flatMap(f));
  const lay = has((r) => [r.frame]), gr = has((r) => r.graphics), pal = has((r) => [r.palette]), pair = has((r) => [r.pairing]);
  const missing = {
    layouts: lists.layouts.filter((x) => !lay.has(x)), graphics: lists.graphics.filter((x) => !gr.has(x)),
    palettes: lists.palettes.filter((x) => !pal.has(x)), pairings: lists.pairings.filter((x) => !pair.has(x)),
  };
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.frame, (counts.get(r.frame) ?? 0) + 1);
  const [layout, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  const share = rows.length ? n / rows.length : 0;
  const coverage = Object.values(missing).every((l) => l.length === 0);
  return { count: rows.length, repeats60, missing, top: { layout, share }, pass: { sixty: repeats60 === 0, coverage, share: share <= 0.25 } };
}

/** Seeds of the i-th draw of a variety run from a base: every facet new, as Shuffle with nothing locked. */
export const shuffleSeeds = (i: number, base = 0x5a17): Spec['seeds'] => ({ layout: mix(base, i * 4 + 1), colour: mix(base, i * 4 + 2), graphic: mix(base, i * 4 + 3), type: mix(base, i * 4 + 4) });
/** The base of a variety run: its own per format (review R9 S1: one base made the three format runs one run). */
export const varietyBase = (format: Format, run = 0): number => mix(0x5a17 + run * 7919, FORMAT_LIST.indexOf(format) + 1);

/**
 * The variety tests of spec 8.0 for one style in one format: n shuffles (300) of the default text in light mode, each
 * drawn through Shuffle's guard (freshDraw) as the app draws them; `raw` leaves the guard out, to measure the
 * style's own spread. The pairing counted is the one the shuffle chose (the type seed), not the one drawn when its
 * fonts are not loaded.
 */
export function runVariety(m: Measure, style: StyleId, format: Format, n = 300, resolve?: Resolve, pick: Pick = {}, o: { base?: number; raw?: boolean } = {}): Variety {
  const rows: VarietyRow[] = [], base = o.base ?? varietyBase(format);
  let recent: string[] = [], c = 0;
  const draw = (): VarietyRow => {
    const s = defaultSpec(shuffleSeeds(c++, base));
    s.style = style; s.format = format; s.pick = { ...s.pick, ...pick };
    const sc = solve(s, m, resolve?.(s)).scene;
    return { frame: sc.frame, transform: sc.transform, graphics: sc.graphics, palette: sc.palette, pairing: choosePairing(s).id };
  };
  for (let i = 0; i < n; i++) {
    const { value, key } = o.raw ? (() => { const v = draw(); return { value: v, key: varietyKey(v) }; })() : freshDraw(draw, varietyKey, recent);
    rows.push(value);
    recent = pushRecent(recent, key);
  }
  const st = STYLES[style], d = pick.dialect ?? null;
  // with a dialect picked, the lists are that dialect's own (spec 8.2: each dialect alone meets the tests)
  const layouts = (d && st.parts.layout.layoutsOf?.[d]) || st.layouts, vocab = (d && st.parts.graphics.vocabOf?.[d]) || st.parts.graphics.vocab;
  return varietyOf(rows, { layouts, graphics: vocab, palettes: st.parts.palette.list.map((p) => p.id), pairings: PAIRINGS[style].map((p) => p.id) });
}

/** Repeats in each of `windows` runs of 60 shuffles, each from its own base (review R9 S1: not one lucky window). */
export function varietyWindows(m: Measure, style: StyleId, format: Format, windows = 20, raw = false): number[] {
  return Array.from({ length: windows }, (_, w) => runVariety(m, style, format, VARIETY_WINDOW, undefined, {}, { base: varietyBase(format, w + 1), raw }).repeats60);
}


/**
 * The tuning pass (row R5): flags a design that is legal but likely clumsy, by rules a reviewer named. It cannot
 * judge looks (spec 9.5); it only finds the candidates for a person to look at. Rules, on the Scene:
 * - `tiny title`: the title is under 6% of the canvas width tall (px) where it has three words or fewer;
 * - `empty`: more than 55% of the canvas (in 9:16, of the band between the story zones) is bare (60% in type only,
 *   which is ground and type by definition). Covered is what text (plus one grid cell round it) or a graphic sits
 *   on; a graphic covers its box only as far as its ink reaches (`coverOf`); a field or panel of colour is bare
 *   where nothing sits on it (review R5 S2: counting fields as cover hid sparse centred-low and split designs);
 * - `small graphic`: the first graphic covers less than 10% of the canvas, weighted the same way;
 * - `fallback`: no candidate passed.
 */
export function clumsyOf(sc: Scene, spec: Spec): string[] {
  const out: string[] = [];
  const W = sc.w, H = sc.h;
  const title = sc.items.find((i) => i.kind === 'text' && i.slot === 'title');
  if (title && title.kind === 'text' && slotsOf(spec.text).title.v.trim().split(/\s+/).length <= 3 && title.px < W * 0.06) out.push(`tiny title ${Math.round(title.px)} px`);
  const nx = 24, ny = Math.round((24 * H) / W), cover = new Float32Array(nx * ny);
  const inQuad = (q: number[][], x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const [xi, yi] = q[i], [xj, yj] = q[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // a ground pattern or a surface pass is the ground, not cover (R6: Postmodern's pattern covers the whole canvas)
  const marks = sc.items.filter((i) => i.kind === 'text' || (i.kind === 'graphic' && i.layer !== 'ground' && i.layer !== 'mark'));
  // in 9:16 the story zones are the app's, not the design's: only the band between them counts
  const y0 = sc.format === '9:16' ? 260 : 0, y1 = sc.format === '9:16' ? 1600 : H;
  const rows = (j: number) => { const y = ((j + 0.5) * H) / ny; return y >= y0 && y <= y1; };
  let firstArea = -1;
  // a style drawn as many small pieces (Postmodern's shapes and found graphics, R6) has no first graphic that
  // carries it: there the graphics are weighed together
  const pieces = sc.style === 'pomo', gcover = new Float32Array(nx * ny);
  const gs = sc.items.filter((i) => i.kind === 'graphic' && i.layer !== 'ground' && i.layer !== 'mark');
  const firstG = gs.find((g) => g.kind === 'graphic' && g.lead) ?? gs[0];
  for (const it of marks) {
    const k = it.kind === 'graphic' ? coverOf(it) : 1;
    let n = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = ((i + 0.5) * W) / nx, y = ((j + 0.5) * H) / ny;
      // text marks count with a margin of one cell: a line of type owns the space around it
      const hit = it.kind === 'text' ? [-1, 0, 1].some((d) => inQuad(it.quad, x, y + (d * H) / ny)) : inQuad(it.quad, x, y);
      if (hit) { cover[j * nx + i] = Math.max(cover[j * nx + i], k); n++; if (it.kind === 'graphic') gcover[j * nx + i] = Math.max(gcover[j * nx + i], k); }
    }
    if (it === firstG) firstArea = (n * k) / (nx * ny);
  }
  let cells = 0, covered = 0;
  for (let j = 0; j < ny; j++) if (rows(j)) for (let i = 0; i < nx; i++) { cells++; covered += cover[j * nx + i]; }
  const empty = 1 - covered / cells;
  if (empty > (sc.frame === 'type-only' ? 0.6 : 0.55)) out.push(`empty ${Math.round(empty * 100)}%`);
  if (pieces && firstG) firstArea = gcover.reduce((a, v) => a + v, 0) / (nx * ny);
  if (firstArea >= 0 && firstArea < 0.1) out.push(`small graphic ${Math.round(firstArea * 100)}%`);
  if (sc.layout === 'fallback') out.push('fallback');
  return out;
}

export interface Clumsy { spec: Spec; frame: string; transform: string; graphics: string[]; palette: string; why: string[]; }
/** The tuning run: n shuffles of a style in each format (light and dark alternating), and the ones clumsyOf flags. */
export function runTune(m: Measure, style: StyleId, n = 300, resolve?: Resolve): { count: number; flagged: Clumsy[]; byRule: Record<string, number> } {
  const flagged: Clumsy[] = [], byRule: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const s = defaultSpec(shuffleSeeds(1000 + i));
    s.style = style; s.format = FORMAT_LIST[i % 3]; s.mode = i % 2 ? 'dark' : 'light';
    const sc = solve(s, m, resolve?.(s)).scene, why = clumsyOf(sc, s);
    for (const w of why) { const k = w.split(/ \d/)[0]; byRule[k] = (byRule[k] ?? 0) + 1; }
    if (why.length) flagged.push({ spec: s, frame: sc.frame, transform: sc.transform, graphics: sc.graphics, palette: sc.palette, why });
  }
  return { count: n, flagged, byRule };
}

/**
 * The edits the colour checks make (spec 5, edit for this design): every design colour set to every other (the worst
 * edits: colours collide), and to a mid grey.
 */
export function colourEdits(s: Spec, sc: Scene): Spec[] {
  const d = designColours(choosePalette(s), s, sc), out: Spec[] = [];
  for (const a of d) { for (const b of d) if (a !== b) out.push(setColour(s, a.roles, b.now)); out.push(setColour(s, a.roles, EDIT_GREY)); }
  return out;
}

export interface AdvancedReport {
  designs: number; values: number; edits: number; warned: number;
  /** A value that dropped a design that did not fall back to the fallback (review R10 S2). */
  fallbacks: { spec: Spec; id: string; v: unknown }[];
  /** A value or an edit that broke 9.2 (rule 4 under an edit only where the Scene does not warn of it). */
  failures: { spec: Spec; id: string; v: unknown; failures: Failure[] }[];
}

/**
 * Advanced (spec 10.3, review R10 S3) with the measure given (the real fonts in smoke): every value of every
 * non-library control of each design (the library ends have their own run), and every colour edit of `colourEdits`,
 * through 9.2. A fallback a value causes is reported; under a colour edit a rule 4 failure is legal only where the
 * Scene warns of it (`colourWarn`), and rules 1, 2, 3 and 5 always hold.
 */
export function runAdvanced(m: Measure, o: Opts = {}, resolve?: Resolve): AdvancedReport {
  const r: AdvancedReport = { designs: 0, values: 0, edits: 0, warned: 0, fallbacks: [], failures: [] };
  const sceneOf = (s: Spec) => solve(s, m, resolve?.(s)).scene;
  for (const s of specs({ variants: 'cycle', marks: 'light', finish: 'grain', ...o })) {
    r.designs++;
    const sc0 = sceneOf(s);
    for (const c of allControls(advancedOf(s, sc0))) {
      if (c.where.at === 'params' && c.where.key.startsWith('g.') && c.kind === 'range') continue;
      for (const v of valuesOf(c)) {
        const t = apply(s, c, v), sc = sceneOf(t);
        r.values++;
        if (sc.layout === 'fallback' && sc0.layout !== 'fallback' && r.fallbacks.length < 20) r.fallbacks.push({ spec: t, id: c.id, v });
        const f = check(sc);
        if (f.length && r.failures.length < 20) r.failures.push({ spec: t, id: c.id, v, failures: f });
      }
    }
    for (const e of colourEdits(s, sc0)) {
      const se = sceneOf(e), warn = se.colourWarn ?? [];
      r.edits++;
      if (warn.length) r.warned++;
      const f = check(se).filter((x) => x.rule !== 4 || !warn.includes(x.part));
      if (f.length && r.failures.length < 20) r.failures.push({ spec: e, id: 'colour', v: e.pick.colours, failures: f });
    }
  }
  return r;
}

/**
 * Review bundle 4 M5: spec 8.3's full-width rule with the real faces. Every title line of a Brutalist title of four
 * words or fewer spans the inner width (up the edge: the strip's height) within 1%, in the layouts that promise it,
 * for each pairing given (the bundled ones, in the smoke run), drawn with that pairing only where `resolve` allows it.
 * `lines`: lines measured; `off`: lines off by 1% or more, with the spec; `skipped`: designs not drawn with the pairing.
 * `read`: the measure the lines are read with (the layout's own; another only for the test of the test).
 */
export interface WidthReport { designs: number; lines: number; skipped: number; fallbacks: number; off: { spec: Spec; line: string; got: number; want: number }[]; }
export function runBrutalWidth(m: Measure, o: Opts = {}, resolve?: Resolve, read: Measure = m): WidthReport {
  const r: WidthReport = { designs: 0, lines: 0, skipped: 0, fallbacks: 0, off: [] };
  for (const spec of specs({ ...o, styles: ['brutal'] })) {
    const tt = slotsOf(spec.text).title;
    if (!tt.on || tt.v.trim().split(/\s+/).length > 4) continue;
    const use = resolve?.(spec);
    if (spec.pick.pairing && use?.pairing && use.pairing !== spec.pick.pairing) { r.skipped++; continue; }
    const sc = solve(spec, m, use).scene;
    if (sc.layout === 'fallback') { r.fallbacks++; continue; }
    const T = PAIRINGS.brutal.find((p) => p.id === sc.pairing)!;
    const plan = STYLES.brutal.parts.layout.plan(partCtx(spec, m, choosePalette(spec), T, Number(sc.layout.slice(1))));
    const ts = sc.items.filter((i): i is TextItem => i.kind === 'text' && i.slot === 'title');
    // every Brutalist layout promises it (FULL_WIDTH: all but title-up, whose lines span the strip's height)
    if (!plan || !ts.length) continue;
    r.designs++;
    const box = plan.boxes.title!, want = plan.titleUp ? box.h : box.w;
    for (const t of ts) {
      const run = t.runs[0], mt = read(run.s, t.font, t.size), got = (mt.left + mt.right) * (run.sx ?? 1);
      r.lines++;
      if (Math.abs(got - want) / want >= 0.01 && r.off.length < 50) r.off.push({ spec, line: run.s, got, want });
    }
  }
  return r;
}

// ---------------------------------------------------------------------------------------------------------------
// text layers (spec 8.6, row R17)

const WORDS: Record<Level, string[]> = {
  headline: ['Signal', 'Signal and noise', 'Eight plain words make a long poster title'],
  subhead: ['A modular identity system', 'Notes', 'Rules and seeded randomness, set by hand'],
  body: ['One user, one phone.', 'Pick a style, shuffle until something lands, type the words and export the poster at any size.', 'Generated, not drawn'],
  label: ['New', 'Free entry', 'Edition one of three'],
  caption: ['Vol. 01 — generated, not drawn', 'Lisboa', 'Printed in an edition of forty, numbered by hand'],
  data: [],
};
const PAIRS: InfoPair[][] = [[{ k: 'Where', v: 'Lisboa' }], [{ k: 'Where', v: 'Lisboa' }, { k: 'When', v: '23 Nov 2026' }, { k: 'Edition', v: '01' }], [{ k: 'Doors', v: '21:00' }, { k: '', v: 'Free' }]];

/**
 * Layer list i of the 9.2 run over layers: 1 to 8 layers (i mod 8, plus one). The first 48 are one level throughout
 * (each level at each count); the rest mix levels at random from the seeded stream; words short, typical or long.
 */
export function layerMix(i: number): TextLayer[] {
  const n = 1 + (i % 8), r = rng(mix(0x1a7e, i)), out: TextLayer[] = [];
  for (let j = 0; j < n; j++) {
    const level = i < 48 ? LEVELS[Math.floor(i / 8)] : LEVELS[Math.floor(r() * LEVELS.length)];
    const w = Math.floor(r() * 3);
    out.push({ id: 't' + (j + 1), level, v: level === 'data' ? structuredClone(PAIRS[w]) : WORDS[level][w], on: true, pos: null });
  }
  return out;
}

export interface LayerReport { count: number; layers: number; flagged: number; fallbacks: number; layerFallbacks: string[]; drawnOrFlagged: string[]; failures: { spec: Spec; failures: Failure[] }[]; }
/**
 * The format and mode of layer list i (review R17 E2): taken from other bits of i than the layer count (i mod 8), so
 * every block of 64 lists has every count x format x mode. With `formats` given, i runs over those only.
 */
export function layerCase(i: number, formats: readonly Format[] = FORMAT_LIST): { format: Format; mode: 'light' | 'dark' } {
  return { format: formats[Math.floor(i / 8) % formats.length], mode: Math.floor(i / (8 * formats.length)) % 2 ? 'dark' : 'light' };
}

/**
 * 9.2 over text layers: n layer lists per style (per format where `formats` is given), every count x format x mode in
 * each block of 64. Every layer that is on is drawn or flagged on the Scene, never dropped (`drawnOrFlagged` lists any
 * that is neither). With `marks`, `finish`, `dialect` or `photo` the lists run with them (review R17 S6).
 */
export function runLayers(m: Measure, o: { styles?: StyleId[]; n?: number; start?: number; formats?: Format[]; marks?: Spec['marks']; finish?: Spec['finish']; dialect?: Spec['pick']['dialect']; photo?: string } = {}, resolve?: Resolve): LayerReport {
  const r: LayerReport = { count: 0, layers: 0, flagged: 0, fallbacks: 0, layerFallbacks: [], drawnOrFlagged: [], failures: [] };
  const formats = o.formats ?? FORMAT_LIST;
  for (const style of o.styles ?? STYLE_IDS) for (let i = o.start ?? 0; i < (o.start ?? 0) + (o.n ?? 200); i++) {
    const s = defaultSpec(seedSet(i));
    const lc = layerCase(i, formats);
    s.style = style; s.format = lc.format; s.mode = lc.mode;
    if (o.marks) s.marks = o.marks;
    if (o.finish) s.finish = o.finish;
    if (o.dialect) s.pick = { ...s.pick, dialect: o.dialect };
    if (o.photo) s.photo = { id: o.photo, place: null, treatment: null } as Spec['photo'];
    s.text = layerMix(i);
    r.count++;
    const { scene } = solve(s, m, resolve?.(s));
    if (scene.layout === 'fallback') {
      r.fallbacks++;
      // a fallback the layers caused: the same design with its slots' leads alone does not fall back (Carried R12 from
      // R17: a second layer's room is checked in every palette and mode, so a layer is flagged rather than this)
      const ex = new Set(extrasOf(s.text).map((l) => l.id));
      const lone = { ...s, text: s.text.filter((l) => !ex.has(l.id)) };
      if (solve(lone, m, resolve?.(lone)).scene.layout !== 'fallback' && r.layerFallbacks.length < 20) r.layerFallbacks.push(`${style} ${s.format} ${s.mode} seed ${i}`);
    }
    const f = check(scene);
    if (f.length && r.failures.length < 50) r.failures.push({ spec: s, failures: f });
    for (const L of s.text) {
      r.layers++;
      const drawn = scene.items.some((it) => it.kind === 'text' && it.lid === L.id);
      if (scene.flagged?.includes(L.id)) r.flagged++;
      else if (!drawn && r.drawnOrFlagged.length < 20) r.drawnOrFlagged.push(`${style} ${s.format} seed ${i} ${L.id} ${L.level}`);
    }
  }
  return r;
}
