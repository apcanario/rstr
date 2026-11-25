/** layout(spec, measure) -> Scene. A solver: candidates from the layout stream, the first that passes 9.2 wins. */
import { defaultPairing, faceKey, PAIRINGS, ROLES, type Pairing } from '../data/pairings';
import { formOf, type Form, type Mode } from '../data/palettes';
import { FORMATS } from './formats';
import { check, type Failure } from './invariants';
import type { Measure } from './measure';
import { counted, mix, pick, rng } from './rng';
import type { FontRef, GraphicItem, Item, Scene, TextItem } from './scene';
import type { Spec } from './spec';
import { STYLES } from './styles';
import { textArea, type PartCtx } from './parts/types';
import { compose5 } from './styles/compose';
import { addMarks } from './marks';
import { applyColourEdits } from './recolour';
import { typeCap } from './controls';

/** A style's palettes: its palette part's list. */
const palettesOf = (style: Spec['style']) => STYLES[style].parts.palette.list;

export const CANDIDATES = 20;
/** Title cap per candidate: later candidates try a smaller title. */
const capFor = (k: number) => (k <= 0 ? 1 : [1, 0.85, 0.72, 0.6][Math.floor(k / 2) % 4]);

/** The palette (pick, else the colour seed) in the spec's mode. */
export function choosePalette(spec: Spec): Form {
  const list = palettesOf(spec.style);
  return formOf(list.find((p) => p.id === spec.pick.palette) ?? pick(rng(spec.seeds.colour), list), spec.mode);
}
/** The pairing the spec asks for: pick.pairing, else the type seed over the style's allowed list. */
export function choosePairing(spec: Spec): Pairing {
  const list = PAIRINGS[spec.style];
  return list.find((p) => p.id === spec.pick.pairing) ?? pick(rng(spec.seeds.type), list);
}

/**
 * What layout may use instead of the spec's own choice. The app sets `pairing` to the style's default when
 * the wanted pairing's fonts are not loaded (spec 6); the spec keeps the pairing it asked for.
 */
export interface Use { pairing?: string; }

/** The pairing to draw with: the wanted one if its fonts are available, else the style's default (spec 6). */
export function resolvePairing(spec: Spec, isAvailable: (p: Pairing) => boolean): Use {
  const want = choosePairing(spec);
  return { pairing: isAvailable(want) ? want.id : defaultPairing(spec.style).id };
}

interface Built { items: Item[]; frame: string; transform: string; inert?: string[]; }
/** What every part of the spec's style is called with for candidate k (-1: the fallback). */
export function partCtx(spec: Spec, m: Measure, P: Form, T: Pairing, k: number, margin = STYLES[spec.style].margin): PartCtx {
  const [W, H] = FORMATS[spec.format];
  const story = spec.format === '9:16';
  const { top, bot } = textArea(story, H, margin);
  const rf = rng(spec.seeds.layout);
  const rc = k > 0 ? rng(mix(spec.seeds.layout, k)) : null;
  return {
    spec, W, H, story, top, bot, m, P, T, rf, k, fallback: k < 0, cap: capFor(k) * typeCap(spec), rg: counted(rng(spec.seeds.graphic)),
    cand<V>(list: readonly V[], safe?: V): V {
      const v = list[Math.floor(rf() * list.length)];
      if (k === 0) return v;
      if (k < 0 || !rc) return safe !== undefined ? safe : list[0];
      return list[Math.floor(rc() * list.length)];
    },
  };
}

function build(spec: Spec, m: Measure, P: Form, T: Pairing, k: number): Built | null {
  const r = compose5(STYLES[spec.style].parts, partCtx(spec, m, P, T, k));
  return r ? { items: r.items, frame: r.plan.frame, transform: r.plan.transform, inert: r.plan.inert } : null;
}

function sceneOf(spec: Spec, items: Item[], P: Form, T: Pairing, layoutName: string, measured: Map<string, FontRef>, frame: string, transform: string, inert?: string[]): Scene {
  const [W, H] = FORMATS[spec.format];
  const all = new Map(measured);
  for (const i of items) if (i.kind === 'text') all.set(faceKey((i as TextItem).font), (i as TextItem).font);
  const fonts = [...new Set([...all.values()].map((f) => f.family))].sort();
  const faces = [...all.keys()].sort();
  const gs = items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.layer !== 'ground');
  const graphics = [...gs.filter((g) => g.lead), ...gs.filter((g) => !g.lead)].map((g) => g.tag ?? g.name);
  const sc: Scene = { w: W, h: H, style: spec.style, format: spec.format, palette: P.id, pairing: T.id, layout: layoutName, frame, transform, graphics, ground: P.ground, items, fonts, faces };
  if (inert?.length) sc.inert = [...new Set(inert)].sort();
  return sc;
}

/**
 * Faces a Scene measured with or drew that are not loaded (spec 6): must always be empty. Tested by face, not
 * family, because canvas silently substitutes a near weight or a synthetic italic for a face it lacks.
 */
export function unloadedFaces(sc: Scene, isLoaded: (key: string) => boolean): string[] {
  return sc.faces.filter((k) => !isLoaded(k));
}

export interface Solved { scene: Scene; tried: number; failures: Failure[]; }

/** Every weight the pairings list for a family (upright or italic): the faces fonts.ts can load for it. */
export function weightsOf(family: string, italic = false): number[] {
  const out = new Set<number>();
  for (const list of Object.values(PAIRINGS)) for (const p of list) for (const k of ROLES) {
    const f = p[k];
    if (f && f.family === family && !!f.italic === italic) out.add(f.weight);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Spec 7.1: with a finish other than Clean, text set in a light weight (under 400) steps up one weight: to the next
 * weight the pairings list for its family, so the stepped face is one that exists (fonts.ts loads by face; review
 * R7 M7). With none listed above it, the weight stays. Every pairing of the list sets its text at 400 or more
 * today, so this changes nothing yet.
 */
export function stepLight(T: Pairing, finish: Spec['finish'], weights: (family: string, italic?: boolean) => number[] = weightsOf): Pairing {
  if (finish === 'clean') return T;
  let changed = false;
  const out: Pairing = { ...T };
  for (const k of ROLES) {
    const f = T[k];
    if (!f || f.weight >= 400) continue;
    const up = weights(f.family, !!f.italic).find((w) => w > f.weight);
    if (up != null) { out[k] = { ...f, weight: up } as never; changed = true; }
  }
  return changed ? out : T;
}

/**
 * Every form of every palette of the style, the one in use first: light and dark of each, so neither the
 * colour seed nor the mode can move a box.
 */
function formsFor(spec: Spec, P: Form): Form[] {
  const modes: Mode[] = spec.mode === 'dark' ? ['dark', 'light'] : ['light', 'dark'];
  const all = modes.flatMap((md) => palettesOf(spec.style).map((p) => formOf(p, md)));
  return [P, ...all.filter((q) => !(q.id === P.id && q.mode === P.mode))];
}

/** True if these items pass 9.2 for the form in use and rule 4 for every other form of the style. */
function passesAll(spec: Spec, m: Measure, P: Form, T: Pairing, k: number, name: string, measured: Map<string, FontRef>): { first: Scene | null; failures: Failure[] } {
  let first: Scene | null = null;
  for (const Q of formsFor(spec, P)) {
    const r = build(spec, m, Q, T, k);
    if (!r) return { first: null, failures: [{ rule: 0, part: '-', msg: 'text does not fit' }] };
    const sc = sceneOf(spec, r.items, Q, T, name, measured, r.frame, r.transform, r.inert);
    const f = check(sc, Q === P ? [1, 2, 3, 4, 5] : [4]);
    if (f.length) return { first: null, failures: f };
    if (!first) first = sc;
  }
  return { first, failures: [] };
}

/**
 * A candidate passes only if it passes for every form (light and dark) of every palette of the style: so
 * the colour seed can never move a box (9.3), and switching mode keeps the layout. The fallback keeps the frame and shortens text to fit. A picked layout or motif
 * the fallback cannot carry is dropped (layout first, then motif), so the fallback always passes.
 */
export function solve(spec: Spec, m0: Measure, use: Use = {}): Solved {
  const P = choosePalette(spec);
  const T = stepLight((use.pairing && PAIRINGS[spec.style].find((p) => p.id === use.pairing)) || choosePairing(spec), spec.finish);
  // every face layout measures with is recorded on the Scene, so a test can prove none was a fallback
  const measured = new Map<string, FontRef>();
  const m: Measure = (s, f, px, tr) => { measured.set(faceKey(f), f); return m0(s, f, px, tr); };
  let last: Failure[] = [];
  // the marks layer (spec 7.2) goes on the Scene that passed, after text and graphics, in free space only;
  // its micro labels are measured like any text, so their face is recorded with the rest
  // this design's edited colours (spec 5) go on last, marks included: neither the layout nor the marks see them
  const done = (sc: Scene): Scene => applyColourEdits(withMarks(sc), P, spec);
  const withMarks = (sc: Scene): Scene => {
    const out = addMarks(sc, spec, m, P);
    if (out === sc) return sc;
    const faces = new Set(sc.faces);
    for (const [k, f] of measured) if (!faces.has(k)) { faces.add(k); if (!sc.fonts.includes(f.family)) out.fonts = [...out.fonts, f.family].sort(); }
    return { ...out, faces: [...faces].sort() };
  };
  for (let k = 0; k < CANDIDATES; k++) {
    const r = passesAll(spec, m, P, T, k, 'c' + k, measured);
    if (r.first) return { scene: done(r.first), tried: k + 1, failures: [] };
    last = r.failures;
  }
  const tries: Spec[] = [spec];
  if (spec.pick.layout) tries.push({ ...spec, pick: { ...spec.pick, layout: null } });
  if (spec.pick.motif) tries.push({ ...spec, pick: { ...spec.pick, layout: null, motif: null } });
  for (const s of tries.slice(0, -1)) {
    const r = passesAll(s, m, P, T, -1, 'fallback', measured);
    if (r.first) return { scene: done(r.first), tried: CANDIDATES + 1, failures: last };
  }
  const r = build(tries[tries.length - 1], m, P, T, -1);
  return { scene: done(sceneOf(spec, r?.items ?? [], P, T, 'fallback', measured, r?.frame ?? '', r?.transform ?? 'none', r?.inert)), tried: CANDIDATES + 1, failures: last };
}

export function layout(spec: Spec, m: Measure, use: Use = {}): Scene {
  return solve(spec, m, use).scene;
}
