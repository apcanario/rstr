/** The proof of spec 9.2 and 9.3 over many seeds. Run by the unit tests (stub measure) and the smoke run (real fonts). */
import { FORMAT_LIST, type Format } from './formats';
import { check, type Failure } from './invariants';
import { choosePairing, solve, type Use } from './layout';
import { PAIRINGS } from '../data/pairings';
import type { Measure } from './measure';
import { mix } from './rng';
import type { Item, Scene } from './scene';
import { STYLES } from './styles';
import { DEFAULT_TEXT, defaultSpec, SLOTS, STYLE_IDS, type Mode, type Spec, type StyleId } from './spec';

export const TITLES = { one: 'Signal', three: 'Signal and noise', eight: 'Eight plain words make a long poster title' };

/** Text variants: short, typical and long titles with every slot on, then each slot alone. */
export function textVariants(): { name: string; text: Spec['text'] }[] {
  const out: { name: string; text: Spec['text'] }[] = [];
  for (const [name, v] of Object.entries(TITLES)) {
    const t = structuredClone(DEFAULT_TEXT);
    t.title.v = v;
    out.push({ name: 'all-' + name, text: t });
  }
  for (const s of SLOTS) {
    const t = structuredClone(DEFAULT_TEXT);
    for (const o of SLOTS) t[o].on = o === s;
    out.push({ name: s + '-alone', text: t });
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
}
/** What layout may use for a spec: the app's font check (spec 6). Absent: every pairing is drawn as asked. */
export type Resolve = (spec: Spec) => Use;
/** fallbackSpecs: the first 20 specs that fell back, so an unexpected fallback can be printed. */
export interface Report { count: number; fallbacks: number; fallbackSpecs: Spec[]; failures: { spec: Spec; failures: Failure[] }[]; pairings: string[]; fonts: string[]; faces: string[]; }

type Pick = Partial<Spec['pick']>;
/** One pick per value of pick.layout and pick.motif the style lists. */
export function picksOf(style: StyleId): Pick[] {
  const st = STYLES[style];
  return [...st.layouts.map((layout) => ({ layout })), ...st.motifs.map((motif) => ({ motif }))];
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
              s.style = style; s.format = format; s.mode = mode; s.text = structuredClone(v.text);
              s.pick = { ...s.pick, ...o.pick, ...pk };
              if (o.params) s.params = { ...o.params };
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
    if (f.length && r.failures.length < 50) r.failures.push({ spec, failures: f });
  }
  r.pairings = [...pairings].sort();
  r.fonts = [...fonts].sort();
  r.faces = [...faces].sort();
  return r;
}

const round = (q: number[][]) => q.map((p) => p.map((v) => Math.round(v * 100) / 100));
const boxes = (sc: Scene, keep: (i: Item) => boolean) =>
  JSON.stringify(sc.items.filter(keep).map((i) => [i.kind, i.kind === 'graphic' ? [i.name, i.box, i.seed, i.skip, i.params, i.xf] : i.kind === 'text' ? [i.slot, i.part] : 0, round(i.quad)]));

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
    if (boxes(base, () => true) !== boxes(c, () => true)) out.failures.push({ spec, facet: 'colour moved a box' });
    const t = vary('type');
    if (boxes(base, (i) => i.kind === 'graphic') !== boxes(t, (i) => i.kind === 'graphic')) out.failures.push({ spec, facet: 'type moved a graphic' });
    // the check means something only where the type seed changed the pairing and so the text
    if (t.pairing !== base.pairing && boxes(base, (i) => i.kind === 'text') !== boxes(t, (i) => i.kind === 'text')) out.typeMoved++;
    const g = vary('graphic');
    if (boxes(base, (i) => i.kind === 'text') !== boxes(g, (i) => i.kind === 'text')) out.failures.push({ spec, facet: 'graphic moved a text box' });
    const md = structuredClone(spec);
    md.mode = spec.mode === 'light' ? 'dark' : 'light';
    if (boxes(base, () => true) !== boxes(go(md), () => true)) out.failures.push({ spec, facet: 'mode moved a box' });
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

/** The three variety tests of spec 8.0 over a list of shuffles, in order. Pure, so the test of the tests can feed it rows. */
export function varietyOf(rows: VarietyRow[], lists: VarietyLists): Variety {
  const seen = new Set<string>();
  let repeats60 = 0;
  for (const r of rows.slice(0, 60)) {
    const key = [r.frame, r.transform, r.graphics[0] ?? '-', r.graphics[1] ?? '-', r.palette].join('|');
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

/** Seeds of the i-th shuffle of the variety run: every facet new, as Shuffle with nothing locked. */
export const shuffleSeeds = (i: number): Spec['seeds'] => ({ layout: mix(0x5a17, i * 4 + 1), colour: mix(0x5a17, i * 4 + 2), graphic: mix(0x5a17, i * 4 + 3), type: mix(0x5a17, i * 4 + 4) });

/**
 * The variety tests of spec 8.0 for one style in one format: n shuffles (300) of the default text in light mode.
 * The pairing counted is the one the shuffle chose (the type seed), not the one drawn when its fonts are not loaded.
 */
export function runVariety(m: Measure, style: StyleId, format: Format, n = 300, resolve?: Resolve): Variety {
  const rows: VarietyRow[] = [];
  for (let i = 0; i < n; i++) {
    const s = defaultSpec(shuffleSeeds(i));
    s.style = style; s.format = format;
    const sc = solve(s, m, resolve?.(s)).scene;
    rows.push({ frame: sc.frame, transform: sc.transform, graphics: sc.graphics, palette: sc.palette, pairing: choosePairing(s).id });
  }
  const st = STYLES[style];
  return varietyOf(rows, { layouts: st.layouts, graphics: st.parts.graphics.vocab, palettes: st.parts.palette.list.map((p) => p.id), pairings: PAIRINGS[style].map((p) => p.id) });
}

/**
 * The tuning pass (row R5): flags a design that is legal but likely clumsy, by rules a reviewer named. It cannot
 * judge looks (spec 9.5); it only finds the candidates for a person to look at. Rules, on the Scene:
 * - `tiny title`: the title is under 6% of the canvas width tall (px) where it has three words or fewer;
 * - `empty`: more than 55% of the canvas (in 9:16, of the band between the story zones) is bare ground, with no text,
 *   graphic box or field of colour over it (a 24-cell-wide grid), type only excepted;
 * - `small graphic`: the first graphic shows on less than 10% of the canvas;
 * - `fallback`: no candidate passed.
 */
export function clumsyOf(sc: Scene, spec: Spec): string[] {
  const out: string[] = [];
  const W = sc.w, H = sc.h;
  const title = sc.items.find((i) => i.kind === 'text' && i.slot === 'title');
  if (title && title.kind === 'text' && spec.text.title.v.trim().split(/\s+/).length <= 3 && title.px < W * 0.06) out.push(`tiny title ${Math.round(title.px)} px`);
  const nx = 24, ny = Math.round((24 * H) / W), cover = new Uint8Array(nx * ny);
  const inQuad = (q: number[][], x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const [xi, yi] = q[i], [xj, yj] = q[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // a field of colour (a rect that is not a plate under text and covers a tenth of the canvas) is not bare ground
  const big = (q: number[][]) => { const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) > 0.1 * W * H; };
  const marks = sc.items.filter((i) => i.kind === 'text' || i.kind === 'graphic' || (i.kind === 'rect' && !i.plate && big(i.quad)));
  // in 9:16 the story zones are the app's, not the design's: only the band between them counts
  const y0 = sc.format === '9:16' ? 260 : 0, y1 = sc.format === '9:16' ? 1600 : H;
  const rows = (j: number) => { const y = ((j + 0.5) * H) / ny; return y >= y0 && y <= y1; };
  let firstArea = -1;
  const gs = sc.items.filter((i) => i.kind === 'graphic' && i.layer !== 'ground');
  const firstG = gs.find((g) => g.kind === 'graphic' && g.lead) ?? gs[0];
  for (const it of marks) {
    let n = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = ((i + 0.5) * W) / nx, y = ((j + 0.5) * H) / ny;
      // text marks count with a margin of one cell: a line of type owns the space around it
      const hit = it.kind === 'text' ? [-1, 0, 1].some((d) => inQuad(it.quad, x, y + (d * H) / ny)) : inQuad(it.quad, x, y);
      if (hit) { cover[j * nx + i] = 1; n++; }
    }
    if (it === firstG) firstArea = n / (nx * ny);
  }
  let cells = 0, covered = 0;
  for (let j = 0; j < ny; j++) if (rows(j)) for (let i = 0; i < nx; i++) { cells++; covered += cover[j * nx + i]; }
  const empty = 1 - covered / cells;
  // type only is ground and type by definition: the rule does not apply to it
  if (empty > 0.55 && sc.frame !== 'type-only') out.push(`empty ${Math.round(empty * 100)}%`);
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
