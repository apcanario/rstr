/** The proof of spec 9.2 and 9.3 over many seeds. Run by the unit tests (stub measure) and the smoke run (real fonts). */
import { FORMAT_LIST, type Format } from './formats';
import { check, type Failure } from './invariants';
import { solve } from './layout';
import type { Measure } from './measure';
import { mix } from './rng';
import type { Item, Scene } from './scene';
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

export interface Opts { styles?: StyleId[]; formats?: Format[]; modes?: Mode[]; n?: number; start?: number; }
export interface Report { count: number; fallbacks: number; failures: { spec: Spec; failures: Failure[] }[]; }

export function* specs(o: Opts = {}): Generator<Spec> {
  const variants = textVariants();
  for (const style of o.styles ?? STYLE_IDS)
    for (const format of o.formats ?? FORMAT_LIST)
      for (const mode of o.modes ?? (['light', 'dark'] as Mode[]))
        for (let i = o.start ?? 0; i < (o.start ?? 0) + (o.n ?? 200); i++) {
          const v = variants[i % variants.length];
          const s = defaultSpec(seedSet(i));
          s.style = style; s.format = format; s.mode = mode; s.text = structuredClone(v.text);
          yield s;
        }
}

/** 9.2 rules 1 to 5 on the final Scene of every spec. */
export function runInvariants(m: Measure, o: Opts = {}): Report {
  const r: Report = { count: 0, fallbacks: 0, failures: [] };
  for (const spec of specs(o)) {
    r.count++;
    const { scene } = solve(spec, m);
    if (scene.layout === 'fallback') r.fallbacks++;
    const f = check(scene);
    if (f.length && r.failures.length < 50) r.failures.push({ spec, failures: f });
  }
  return r;
}

const round = (q: number[][]) => q.map((p) => p.map((v) => Math.round(v * 100) / 100));
const boxes = (sc: Scene, keep: (i: Item) => boolean) =>
  JSON.stringify(sc.items.filter(keep).map((i) => [i.kind, i.kind === 'graphic' ? [i.name, i.box, i.seed, i.skip, i.params, i.xf] : i.kind === 'text' ? [i.slot, i.part] : 0, round(i.quad)]));

/** 9.3: the colour seed moves no box; the type seed moves no graphic; the graphic seed moves no text box. */
export function runIndependence(m: Measure, o: Opts = {}): { count: number; failures: { spec: Spec; facet: string }[] } {
  const out = { count: 0, failures: [] as { spec: Spec; facet: string }[] };
  for (const spec of specs(o)) {
    out.count++;
    const base = solve(spec, m).scene;
    const vary = (facet: 'colour' | 'type' | 'graphic') => {
      const s = structuredClone(spec);
      s.seeds[facet] = mix(s.seeds[facet], 77);
      return solve(s, m).scene;
    };
    const c = vary('colour');
    if (boxes(base, () => true) !== boxes(c, () => true)) out.failures.push({ spec, facet: 'colour moved a box' });
    const t = vary('type');
    if (boxes(base, (i) => i.kind === 'graphic') !== boxes(t, (i) => i.kind === 'graphic')) out.failures.push({ spec, facet: 'type moved a graphic' });
    const g = vary('graphic');
    if (boxes(base, (i) => i.kind === 'text') !== boxes(g, (i) => i.kind === 'text')) out.failures.push({ spec, facet: 'graphic moved a text box' });
  }
  return out;
}
