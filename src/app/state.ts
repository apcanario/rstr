/**
 * The app's state as pure functions (spec 10.1): Shuffle with locks, the per-facet rerolls, Back steps, Kept,
 * and what is saved on the phone. No DOM here, so the unit tests run them directly.
 */
import { FACETS, migrate, newSeed, type Facet, type Spec } from '../engine/spec';

/** Back keeps this many steps (spec 10.1). */
export const BACK_STEPS = 30;
/** The localStorage key of the saved app state. */
export const STORE_KEY = 'rstr.app.v1';

export type Locks = Record<Facet, boolean>;
export const NO_LOCKS: Locks = { layout: false, colour: false, graphic: false, type: false };

/** Which pick each facet's seed stands for (spec 3: a pick overrides its seed). */
export const PICK_OF: Record<Facet, keyof Spec['pick']> = { layout: 'layout', colour: 'palette', graphic: 'motif', type: 'pairing' };

/** Spec 10.1: new seeds for every unlocked facet, and that facet's pick cleared. A locked facet keeps both. */
export function shuffle(s: Spec, locks: Locks, seed: () => number = newSeed): Spec {
  const seeds = { ...s.seeds }, pick = { ...s.pick };
  for (const f of FACETS) {
    if (locks[f]) continue;
    seeds[f] = seed();
    pick[PICK_OF[f]] = null;
  }
  return { ...s, seeds, pick };
}

/** Look tab: New layout, New colours, New graphic, New type. One facet only, whatever the locks. */
export function reroll(s: Spec, f: Facet, seed: () => number = newSeed): Spec {
  return { ...s, seeds: { ...s.seeds, [f]: seed() }, pick: { ...s.pick, [PICK_OF[f]]: null } };
}

/** A style change: picks name things of one style, so they all go; seeds stay. */
export function withStyle(s: Spec, style: Spec['style']): Spec {
  return { ...s, style, pick: { palette: null, pairing: null, motif: null, layout: null } };
}

/** Push the design before a change onto Back, keeping the newest BACK_STEPS. */
export function pushBack(back: Spec[], prev: Spec): Spec[] {
  const out = [...back, prev];
  return out.length > BACK_STEPS ? out.slice(out.length - BACK_STEPS) : out;
}

/** Info as one field: "Where: Lisboa · When: 23 Nov 2026". A part without a colon has an empty label. */
export function infoText(v: Spec['text']['info']['v']): string {
  return v.map((p) => (p.k ? `${p.k}: ${p.v}` : p.v)).join(' · ');
}
export function parseInfo(t: string): Spec['text']['info']['v'] {
  return t.split(/[·|;]/).map((x) => x.trim()).filter(Boolean).slice(0, 3).map((x) => {
    const i = x.indexOf(':');
    return i < 0 ? { k: '', v: x } : { k: x.slice(0, i).trim(), v: x.slice(i + 1).trim() };
  });
}

/** Everything saved on the phone (spec 10.1): the current design, Back steps, Kept, the locks and the mode switch. */
export interface Saved {
  spec: Spec;
  back: Spec[];
  kept: Spec[];
  locks: Locks;
  advanced: boolean;
}

export const serialize = (s: Saved): string => JSON.stringify({ v: 1, ...s });

/** Read the saved state; anything missing or broken takes its default, and every spec is migrated. Never throws. */
export function restore(raw: string | null, fallback: () => Spec): Saved {
  let r: any = null;
  try { r = raw ? JSON.parse(raw) : null; } catch { r = null; }
  if (!r || typeof r !== 'object') return { spec: fallback(), back: [], kept: [], locks: { ...NO_LOCKS }, advanced: false };
  const list = (x: unknown, max: number) => (Array.isArray(x) ? x.slice(-max).map((s) => migrate(s)) : []);
  const locks = { ...NO_LOCKS };
  for (const f of FACETS) locks[f] = r.locks?.[f] === true;
  return {
    spec: r.spec ? migrate(r.spec) : fallback(),
    back: list(r.back, BACK_STEPS),
    kept: list(r.kept, 500),
    locks,
    advanced: r.advanced === true,
  };
}
