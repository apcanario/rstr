/** layout(spec, measure) -> Scene. A solver: candidates from the layout stream, the first that passes 9.2 wins. */
import { PAIRINGS, type Pairing } from '../data/pairings';
import { PALETTES, type Palette } from '../data/palettes';
import { FORMATS } from './formats';
import { check, type Failure } from './invariants';
import type { Measure } from './measure';
import { mix, pick, rng } from './rng';
import type { Item, Scene, TextItem } from './scene';
import type { Spec } from './spec';
import { STYLES } from './styles';
import { textArea, type BuildCtx } from './styles/types';

export const CANDIDATES = 20;
/** Title cap per candidate: later candidates try a smaller title. */
const capFor = (k: number) => (k <= 0 ? 1 : [1, 0.85, 0.72, 0.6][Math.floor(k / 2) % 4]);

export function choosePalette(spec: Spec): Palette {
  const list = PALETTES[spec.style];
  return list.find((p) => p.id === spec.pick.palette) ?? pick(rng(spec.seeds.colour), list);
}
export function choosePairing(spec: Spec): Pairing {
  const list = PAIRINGS[spec.style];
  return list.find((p) => p.id === spec.pick.pairing) ?? pick(rng(spec.seeds.type), list);
}

function build(spec: Spec, m: Measure, P: Palette, T: Pairing, k: number): Item[] | null {
  const style = STYLES[spec.style];
  const [W, H] = FORMATS[spec.format];
  const story = spec.format === '9:16';
  const { top, bot } = textArea(story, H, style.margin);
  const rf = rng(spec.seeds.layout);
  const rc = k > 0 ? rng(mix(spec.seeds.layout, k)) : null;
  const b: BuildCtx = {
    spec, W, H, story, top, bot, m, P, T, rf, k, fallback: k < 0, cap: capFor(k),
    cand<V>(list: readonly V[], safe?: V): V {
      const v = list[Math.floor(rf() * list.length)];
      if (k === 0) return v;
      if (k < 0 || !rc) return safe !== undefined ? safe : list[0];
      return list[Math.floor(rc() * list.length)];
    },
  };
  return style.build(b);
}

function sceneOf(spec: Spec, items: Item[], P: Palette, T: Pairing, layoutName: string): Scene {
  const [W, H] = FORMATS[spec.format];
  const fonts = [...new Set(items.filter((i): i is TextItem => i.kind === 'text').map((i) => i.font.family))];
  return { w: W, h: H, style: spec.style, format: spec.format, palette: P.id, pairing: T.id, layout: layoutName, ground: P.ground, items, fonts };
}

export interface Solved { scene: Scene; tried: number; failures: Failure[]; }

/**
 * A candidate passes only if it passes for every palette of the style: so the colour seed can never
 * move a box (9.3). The fallback keeps the frame and shortens text to fit.
 */
export function solve(spec: Spec, m: Measure): Solved {
  const P = choosePalette(spec), T = choosePairing(spec);
  const palettes = [P, ...PALETTES[spec.style].filter((p) => p !== P)];
  let last: Failure[] = [];
  for (let k = 0; k < CANDIDATES; k++) {
    let first: Scene | null = null, ok = true;
    for (const Q of palettes) {
      const items = build(spec, m, Q, T, k);
      if (!items) { ok = false; last = [{ rule: 0, part: '-', msg: 'text does not fit' }]; break; }
      const sc = sceneOf(spec, items, Q, T, 'c' + k);
      const f = check(sc, Q === P ? [1, 2, 3, 4, 5] : [4]);
      if (f.length) { ok = false; last = f; break; }
      if (!first) first = sc;
    }
    if (ok && first) return { scene: first, tried: k + 1, failures: [] };
  }
  const items = build(spec, m, P, T, -1) ?? [];
  const scene = sceneOf(spec, items, P, T, 'fallback');
  return { scene, tried: CANDIDATES + 1, failures: last };
}

export function layout(spec: Spec, m: Measure): Scene {
  return solve(spec, m).scene;
}
