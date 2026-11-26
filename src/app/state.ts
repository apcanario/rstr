/**
 * The app's state as pure functions (spec 10.1): Shuffle with locks, the per-facet rerolls, Back steps, Kept,
 * and what is saved on the phone. No DOM here, so the unit tests run them directly.
 */
import { freshDraw, pushRecent } from '../engine/proof';
import { facetOfParam } from '../engine/controls';
import { FACETS, MAX_LAYERS, migrate, newLayerId, newSeed, type Facet, type InfoPair, type Level, type Spec, type TextLayer } from '../engine/spec';

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

/**
 * Values set by hand that belong to a facet (spec 10.3): Shuffle and that facet's reroll clear them unless the facet is
 * locked. Params by key (`facetOfParam`: layout.*, g.*, graphics.*, vapor.*, type.*, the Paper edge); the slots'
 * positions are Layout's (the layout stream picks them, spec 8.5); this design's edited colours are Colour's (spec 5).
 * Finish strengths and the marks allowed belong to no facet: Shuffle keeps them, as it keeps the finish and the marks.
 */
function dropFacet(s: Spec, f: Facet): Spec {
  let out = s;
  if (Object.keys(s.params).some((k) => facetOfParam(k) === f)) {
    const params = { ...s.params };
    for (const k of Object.keys(params)) if (facetOfParam(k) === f) delete params[k];
    out = { ...out, params };
  }
  if (f === 'layout' && s.text.some((l) => l.pos !== null)) out = { ...out, text: s.text.map((l) => (l.pos !== null ? { ...l, pos: null } : l)) };
  // where the photo sits is the layout stream's (spec 3, 8.9): Advanced's role, scale and offset, and New crop's crop
  if (f === 'layout' && s.photo?.place) out = { ...out, photo: { ...s.photo, place: null } };
  // its treatment is the graphic stream's (spec 3, 8.9, R15); its parameters are photo.* params (above)
  if (f === 'graphic' && out.photo?.treatment) out = { ...out, photo: { ...out.photo, treatment: null } };
  if (f === 'colour' && s.pick.colours) out = { ...out, pick: { ...out.pick, colours: null } };
  return out;
}

/** Spec 10.1: new seeds for every unlocked facet, that facet's pick and its hand-set values cleared. A locked facet keeps all. */
export function shuffle(s: Spec, locks: Locks, seed: () => number = newSeed): Spec {
  const seeds = { ...s.seeds }, pick = { ...s.pick };
  let out: Spec = s;
  for (const f of FACETS) {
    if (locks[f]) continue;
    seeds[f] = seed();
    pick[PICK_OF[f]] = null;
    out = dropFacet(out, f);
  }
  return { ...out, seeds, pick: { ...pick, colours: out.pick.colours } };
}

/**
 * Shuffle as the app runs it (spec 8.0, review R9 S1): a design whose variety key (`keyOf`: layout, transform, first
 * and second graphic, palette, within one style and format) repeats one of the recent shuffles is drawn again, a few
 * times at most (freshDraw). `recent` is the session's last keys; the result carries them on. All locked: no change.
 */
export function shuffleFresh(s: Spec, locks: Locks, recent: readonly string[], keyOf: (s: Spec) => string, seed: () => number = newSeed): { spec: Spec; recent: string[] } {
  if (FACETS.every((f) => locks[f])) return { spec: s, recent: [...recent] };
  const { value, key } = freshDraw(() => shuffle(s, locks, seed), keyOf, recent);
  return { spec: value, recent: pushRecent(recent, key) };
}

/** Look tab: New layout, New colours, New graphic, New type. One facet only, whatever the locks. */
export function reroll(s: Spec, f: Facet, seed: () => number = newSeed): Spec {
  const d = dropFacet(s, f);
  return { ...d, seeds: { ...s.seeds, [f]: seed() }, pick: { ...d.pick, [PICK_OF[f]]: null } };
}

/**
 * A style change: picks name things of one style (an edited colour set is one style's palette), so they all go, and
 * so do the values set by hand of the four facets (spec 3: params are per style; review R10 M3). The finish
 * strengths and the marks allowed are settings outside the facets and stay, as the finish and marks do. Seeds stay.
 */
export function withStyle(s: Spec, style: Spec['style']): Spec {
  const params = Object.fromEntries(Object.entries(s.params).filter(([k]) => facetOfParam(k) === null));
  // a treatment picked by hand is the Graphic facet's, like the rest (R15)
  return { ...s, style, params, photo: s.photo && s.photo.treatment ? { ...s.photo, treatment: null } : s.photo, pick: { palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null } };
}

/** A photo chosen from the phone (spec 8.9): its id in, its treatment and anything pinned about where it sat gone. */
export const withPhoto = (s: Spec, id: string | null): Spec => ({ ...s, photo: id ? { id, treatment: null, place: null } : null });

/**
 * New crop (spec 10.2 Photo): a new crop seed for the photo alone; its role stays, and a scale or offset set by hand
 * goes, since it would win over the new crop. Nothing else of the design moves.
 */
export function newCrop(s: Spec, seed: () => number = newSeed): Spec {
  if (!s.photo) return s;
  const role = s.photo.place?.role;
  return { ...s, photo: { ...s.photo, place: { ...(role ? { role } : {}), crop: seed() } } };
}

/** Push the design before a change onto Back, keeping the newest BACK_STEPS. */
export function pushBack(back: Spec[], prev: Spec): Spec[] {
  const out = [...back, prev];
  return out.length > BACK_STEPS ? out.slice(out.length - BACK_STEPS) : out;
}

/** Info as one field: "Where: Lisboa · When: 23 Nov 2026". A part without a colon has an empty label. */
export function infoText(v: InfoPair[]): string {
  return v.map((p) => (p.k ? `${p.k}: ${p.v}` : p.v)).join(' · ');
}
export function parseInfo(t: string): InfoPair[] {
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

// ---------------------------------------------------------------------------------------------------------------
// text layers (spec 8.6, 10.2, 10.3): add, remove, reorder, level, words, on/off. Pure; the Text tab calls them.

/** A new layer of a level at the end of the list, empty and on; none past MAX_LAYERS. */
export function addLayer(s: Spec, level: Level): Spec {
  if (s.text.length >= MAX_LAYERS) return s;
  return { ...s, text: [...s.text, { id: newLayerId(s.text), level, v: level === 'data' ? [] : '', on: true, pos: null }] };
}
export const removeLayer = (s: Spec, id: string): Spec => ({ ...s, text: s.text.filter((l) => l.id !== id) });
/** One step up (-1) or down (+1) the list; at an end, nothing. */
export function moveLayer(s: Spec, id: string, by: -1 | 1): Spec {
  const i = s.text.findIndex((l) => l.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= s.text.length) return s;
  const text = s.text.slice();
  [text[i], text[j]] = [text[j], text[i]];
  return { ...s, text };
}
/** The words of a layer as its field shows them: data as "Label: value · ...". */
export const layerText = (l: TextLayer): string => (Array.isArray(l.v) ? infoText(l.v) : l.v);
/** A new level: the words carry over (to and from data through the field's form); a position, which names a slot's place, goes. */
export function setLevel(s: Spec, id: string, level: Level): Spec {
  return { ...s, text: s.text.map((l) => {
    if (l.id !== id || l.level === level) return l;
    const words = layerText(l);
    return { ...l, level, v: level === 'data' ? parseInfo(words) : words, pos: null };
  }) };
}
export const setLayerText = (s: Spec, id: string, t: string): Spec => ({ ...s, text: s.text.map((l) => (l.id === id ? { ...l, v: l.level === 'data' ? parseInfo(t) : t } : l)) });
export const toggleLayer = (s: Spec, id: string): Spec => ({ ...s, text: s.text.map((l) => (l.id === id ? { ...l, on: !l.on } : l)) });
