/** Ranged parameters of the library's graphics: drawn from the graphic stream, or the default, then any Advanced value. */
import type { Rng } from '../rng';
import type { GraphicItem } from '../scene';
import type { Graphic, Range } from './types';

/** The spec.params key that sets one parameter of one graphic wherever it is drawn (Advanced, R10). */
export const paramKey = (graphic: string, param: string) => `g.${graphic}.${param}`;

export const clampTo = (R: Range, v: number) => { const x = Math.max(R.min, Math.min(R.max, v)); return R.int ? Math.round(x) : x; };

/** A value across the whole range from one draw u in [0, 1): uniform, or uniform in log for scale-like parameters. */
export function lerpRange(R: Range, u: number): number {
  if (R.int) return Math.min(R.max, R.min + Math.floor(u * (R.max - R.min + 1)));
  if (R.log && R.min > 0) return R.min * Math.pow(R.max / R.min, u);
  return R.min + (R.max - R.min) * u;
}

/**
 * The parameter values for one placement of a graphic. With r, every parameter is drawn from it in declared
 * order (one draw each); without r, nothing is drawn and only Advanced values are returned (the graphic's draw
 * takes its default for the rest). Advanced values (`g.<name>.<param>` in spec.params) win either way.
 */
export function chooseParams(G: Graphic, specParams: Record<string, unknown>, r?: Rng): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, R] of Object.entries(G.params)) {
    if (r) out[k] = lerpRange(R, r());
    const set = specParams[paramKey(G.name, k)];
    if (typeof set === 'number' && Number.isFinite(set)) out[k] = clampTo(R, set);
  }
  return out;
}

/** A parameter's value on a placed item, or its default. */
export function val(g: GraphicItem, G: Graphic, k: string): number {
  const v = g.params[k];
  return typeof v === 'number' ? v : G.params[k].def;
}
