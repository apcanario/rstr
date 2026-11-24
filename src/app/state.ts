/**
 * The app's state as pure functions (spec 10.1): Shuffle with locks, the per-facet rerolls, Back steps, Kept,
 * and what is saved on the phone. No DOM here, so the unit tests run them directly.
 */
import { FACETS, migrate, newSeed, type Facet, type Spec } from '../engine/spec';

/** Back keeps this many steps (spec 10.1). */
export const BACK_STEPS = 30;
/** Kept holds at most this many designs, newest first. */
export const KEPT_MAX = 500;
/** The localStorage key of the saved app state. */
export const STORE_KEY = 'rstr.app.v1';

export type Locks = Record<Facet, boolean>;
export const NO_LOCKS: Locks = { layout: false, colour: false, graphic: false, type: false };

/** Which pick each facet's seed stands for (spec 3: a pick overrides its seed). */
export const PICK_OF: Record<Facet, keyof Spec['pick']> = { layout: 'layout', colour: 'palette', graphic: 'motif', type: 'pairing' };

/** Values set by hand that belong to a facet (spec 10.3): Shuffle clears them unless that facet is locked. */
export const PARAMS_OF: Record<Facet, string[]> = { layout: [], colour: [], graphic: [], type: ['pomo.paperEdge'] };

function dropParams(params: Spec['params'], f: Facet): Spec['params'] {
  if (!PARAMS_OF[f].some((k) => k in params)) return params;
  const out = { ...params };
  for (const k of PARAMS_OF[f]) delete out[k];
  return out;
}

/** Spec 10.1: new seeds for every unlocked facet, that facet's pick and its hand-set values cleared. A locked facet keeps all. */
export function shuffle(s: Spec, locks: Locks, seed: () => number = newSeed): Spec {
  const seeds = { ...s.seeds }, pick = { ...s.pick };
  let params = s.params;
  for (const f of FACETS) {
    if (locks[f]) continue;
    seeds[f] = seed();
    pick[PICK_OF[f]] = null;
    params = dropParams(params, f);
  }
  return { ...s, seeds, pick, params };
}

/** Look tab: New layout, New colours, New graphic, New type. One facet only, whatever the locks. */
export function reroll(s: Spec, f: Facet, seed: () => number = newSeed): Spec {
  return { ...s, seeds: { ...s.seeds, [f]: seed() }, pick: { ...s.pick, [PICK_OF[f]]: null }, params: dropParams(s.params, f) };
}

/** A style change: picks name things of one style, so they all go; seeds stay. */
export function withStyle(s: Spec, style: Spec['style']): Spec {
  return { ...s, style, pick: { palette: null, pairing: null, motif: null, layout: null, dialect: null } };
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
  // Back is newest last (keep the end); Kept is newest first (keep the start)
  const list = (x: unknown, from: (a: unknown[]) => unknown[]) => (Array.isArray(x) ? from(x).map((s) => migrate(s)) : []);
  const locks = { ...NO_LOCKS };
  for (const f of FACETS) locks[f] = r.locks?.[f] === true;
  return {
    spec: r.spec ? migrate(r.spec) : fallback(),
    back: list(r.back, (a) => a.slice(-BACK_STEPS)),
    kept: list(r.kept, (a) => a.slice(0, KEPT_MAX)),
    locks,
    advanced: r.advanced === true,
  };
}

/** Keep: the design goes first, unless it is already kept; the list stays within KEPT_MAX. */
export function addKept(kept: Spec[], s: Spec): Spec[] {
  const key = JSON.stringify(s);
  return kept.some((x) => JSON.stringify(x) === key) ? kept : [s, ...kept].slice(0, KEPT_MAX);
}

/**
 * A `?s=` link over the saved state: a design that parses as an object replaces the saved one, which goes onto
 * Back; a link that does not parse changes nothing.
 */
export function openLink(saved: Saved, q: string | null): Saved {
  if (!q) return saved;
  let raw: unknown = null;
  try { raw = JSON.parse(q); } catch { return saved; }
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return saved;
  const spec = migrate(raw);
  if (JSON.stringify(spec) === JSON.stringify(saved.spec)) return saved;
  return { ...saved, spec, back: pushBack(saved.back, saved.spec) };
}
