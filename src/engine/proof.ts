/** The proof of spec 9.2 and 9.3 over many seeds. Run by the unit tests (stub measure) and the smoke run (real fonts). */
import { FORMAT_LIST, type Format } from './formats';
import { check, type Failure } from './invariants';
import { solve, type Use } from './layout';
import { PAIRINGS } from '../data/pairings';
import type { Measure } from './measure';
import { mix } from './rng';
import type { Item, Scene } from './scene';
import { STYLES } from './styles';
import { PALETTES } from '../data/palettes';
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
}
/** What layout may use for a spec: the app's font check (spec 6). Absent: every pairing is drawn as asked. */
export type Resolve = (spec: Spec) => Use;
/** fallbackSpecs: the first 20 specs that fell back, so an unexpected fallback can be printed. */
export interface Report { count: number; fallbacks: number; fallbackSpecs: Spec[]; failures: { spec: Spec; failures: Failure[] }[]; pairings: string[]; fonts: string[]; }

type Pick = Partial<Spec['pick']>;
/** One pick per value of pick.layout and pick.motif the style lists. */
export function picksOf(style: StyleId): Pick[] {
  const st = STYLES[style];
  return [...st.layouts.map((layout) => ({ layout })), ...st.motifs.map((motif) => ({ motif }))];
}

function palettePicks(style: StyleId, o: Opts, picks: Pick[]): Pick[] {
  if (!o.palettes) return picks;
  return PALETTES[style].flatMap((p) => picks.map((pk) => ({ ...pk, palette: p.id })));
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
              s.pick = { ...s.pick, ...pk };
              yield s;
            }
}

/** 9.2 rules 1 to 5 on the final Scene of every spec. */
export function runInvariants(m: Measure, o: Opts = {}, resolve?: Resolve): Report {
  const r: Report = { count: 0, fallbacks: 0, fallbackSpecs: [], failures: [], pairings: [], fonts: [] };
  const pairings = new Set<string>(), fonts = new Set<string>();
  for (const spec of specs(o)) {
    r.count++;
    const { scene } = solve(spec, m, resolve?.(spec));
    pairings.add(scene.pairing);
    scene.fonts.forEach((f) => fonts.add(f));
    if (scene.layout === 'fallback' && r.fallbacks++ < 20) r.fallbackSpecs.push(spec);
    const f = check(scene);
    if (f.length && r.failures.length < 50) r.failures.push({ spec, failures: f });
  }
  r.pairings = [...pairings].sort();
  r.fonts = [...fonts].sort();
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
