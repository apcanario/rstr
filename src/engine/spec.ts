/** The design is data (spec 3). Schema v1, validation and migration. */
import type { Format } from './formats';
import { FORMATS } from './formats';
import { PHOTO_ROLES, type PhotoPlace, type PhotoSpec } from './photo';
import { isTreatment } from './treat';

export type StyleId = 'swiss' | 'pomo' | 'brutal' | 'vapor';
export type Mode = 'light' | 'dark';
export type Finish = 'clean' | 'grain' | 'grunge' | 'vhs' | 'glitch';
export type Marks = 'off' | 'light' | 'full';
export type Slot = 'title' | 'subtitle' | 'info' | 'caption';
/** Postmodern's two dialects (spec 8.2): the layout stream picks one unless pick.dialect is set. */
export type Dialect = 'icecream' | 'photocopy';
export const DIALECTS: Dialect[] = ['icecream', 'photocopy'];
export const SLOTS: Slot[] = ['title', 'subtitle', 'info', 'caption'];
export const STYLE_IDS: StyleId[] = ['swiss', 'pomo', 'brutal', 'vapor'];
export const FACETS = ['layout', 'colour', 'graphic', 'type'] as const;
export type Facet = (typeof FACETS)[number];

export interface InfoPair { k: string; v: string; }
/** The palette roles a design's colours can be edited by (spec 5, Advanced): every role but the gradient. */
export const COLOUR_ROLES = ['ground', 'ink', 'accent', 'accent2', 'accent3', 'paper', 'toner', 'spot', 'window', 'windowInk', 'chrome'] as const;
export type ColourRole = (typeof COLOUR_ROLES)[number];
/**
 * Colours edited for this design only (spec 5): per mode, because every palette has a light and a dark form written
 * by hand; each role set to a new #rrggbb. Absent or null: the palette's own colours.
 */
export type ColourEdits = Partial<Record<Mode, Partial<Record<ColourRole, string>>>>;
export interface TextSlot<V> { on: boolean; v: V; pos: string | null; }
/** The four text slots of a v1 spec (spec 8.5): what a style's type part sets as the lead layer of each slot's level. */
export interface SlotText {
  title: TextSlot<string>;
  subtitle: TextSlot<string>;
  info: TextSlot<InfoPair[]>;
  caption: TextSlot<string>;
}

/** Text layers (spec 8.6, row R17): six levels; a layer has one. */
export type Level = 'headline' | 'subhead' | 'body' | 'label' | 'caption' | 'data';
export const LEVELS: Level[] = ['headline', 'subhead', 'body', 'label', 'caption', 'data'];
/** Highest first: where the layers cannot all fit, the lowest levels shrink first (spec 8.6). */
export const LEVEL_RANK: Level[] = ['headline', 'subhead', 'data', 'body', 'label', 'caption'];
export const MAX_LAYERS = 8;
/** The level each v1 slot migrates to (spec 8.6), and the slot whose lead layer each level's first layer is set as. */
export const SLOT_LEVEL: Record<Slot, Level> = { title: 'headline', subtitle: 'subhead', info: 'data', caption: 'caption' };
/** The slot a layer of each level is named under in the Scene (text items carry a slot; body and label have none of their own). */
export const LEVEL_SLOT: Record<Level, Slot> = { headline: 'title', subhead: 'subtitle', body: 'subtitle', label: 'caption', caption: 'caption', data: 'info' };
export interface TextLayer {
  id: string;
  level: Level;
  /** Data: up to three label/value pairs; every other level: a string. */
  v: string | InfoPair[];
  on: boolean;
  /** Where it goes, from the style's positions (spec 8.5, Advanced): read for the lead layer of a slot's level. */
  pos: string | null;
}
export interface Spec {
  v: 2;
  style: StyleId;
  format: Format;
  mode: Mode;
  finish: Finish;
  marks: Marks;
  seeds: Record<Facet, number>;
  pick: { palette: string | null; colours: ColourEdits | null; pairing: string | null; motif: string | null; layout: string | null; dialect: Dialect | null };
  /** The design's photo (spec 8.9): its id on the phone, its treatment (R15) and where Advanced or New crop pinned it. */
  photo: PhotoSpec | null;
  params: Record<string, number | string | boolean>;
  /** The text layers (spec 8.6), in list order: zero to MAX_LAYERS. */
  text: TextLayer[];
}

/** Making a new seed: the one place the engine uses the platform random source. */
export function newSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}
export function newSeeds(prev?: Spec['seeds'], locks?: Partial<Record<Facet, boolean>>): Spec['seeds'] {
  const out = {} as Spec['seeds'];
  for (const f of FACETS) out[f] = locks?.[f] && prev ? prev[f] : newSeed();
  return out;
}

export const DEFAULT_SLOTS: SlotText = {
  title: { on: true, v: 'Signal and noise', pos: null },
  subtitle: { on: true, v: 'A modular identity system', pos: null },
  info: { on: true, v: [{ k: 'Where', v: 'Lisboa' }, { k: 'When', v: '23 Nov 2026' }, { k: 'Edition', v: '01' }], pos: null },
  caption: { on: true, v: 'Vol. 01 — generated, not drawn', pos: null },
};

export function defaultSpec(seeds?: Partial<Spec['seeds']>): Spec {
  return {
    v: 2, style: 'swiss', format: '3:4', mode: 'light', finish: 'clean', marks: 'off',
    seeds: { layout: 1, colour: 2, graphic: 3, type: 4, ...seeds },
    pick: { palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null },
    photo: null,
    params: {},
    text: structuredClone(DEFAULT_TEXT),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// text layers (spec 8.6)

/** A v1 spec's four slots as layers (spec 8.6 migration): title to headline, subtitle to subhead, info to data, caption to caption; ids t1 to t4. */
export function layersOf(t: SlotText): TextLayer[] {
  return SLOTS.map((k, i) => ({ id: 't' + (i + 1), level: SLOT_LEVEL[k], v: structuredClone(t[k].v), on: t[k].on, pos: t[k].pos }));
}
export const DEFAULT_TEXT: TextLayer[] = layersOf(DEFAULT_SLOTS);

export const isData = (l: TextLayer): l is TextLayer & { v: InfoPair[] } => l.level === 'data';
export const pairsOf = (l: TextLayer): InfoPair[] => (Array.isArray(l.v) ? l.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim()) : []);
export const stringOf = (l: TextLayer): string => (typeof l.v === 'string' ? l.v : '');
/** On and with something to draw. */
export const hasContent = (l: TextLayer): boolean => l.on && (l.level === 'data' ? pairsOf(l).length > 0 : !!stringOf(l).trim());

/**
 * The lead layer of each slot's level: the first layer of the level that is on, else its first layer (so a v1 slot
 * that was off stays off with its words). With two headlines the first in the list leads (spec 8.6).
 */
export function leadsOf(layers: readonly TextLayer[]): Partial<Record<Slot, TextLayer>> {
  const out: Partial<Record<Slot, TextLayer>> = {};
  for (const k of SLOTS) {
    const of = layers.filter((l) => l.level === SLOT_LEVEL[k]);
    const lead = of.find((l) => l.on) ?? of[0];
    if (lead) out[k] = lead;
  }
  return out;
}

/** The four slots the style's type part sets (spec 8.5): each from the lead layer of its level, or off and empty. */
export function slotsOf(layers: readonly TextLayer[]): SlotText {
  const L = leadsOf(layers);
  const one = (k: Exclude<Slot, 'info'>): TextSlot<string> => (L[k] ? { on: L[k]!.on, v: stringOf(L[k]!), pos: L[k]!.pos } : { on: false, v: '', pos: null });
  return {
    title: one('title'),
    subtitle: one('subtitle'),
    info: L.info ? { on: L.info.on, v: Array.isArray(L.info.v) ? structuredClone(L.info.v) : [], pos: L.info.pos } : { on: false, v: [], pos: null },
    caption: one('caption'),
  };
}

/** The layers set by the shared layer placer (parts/shared/layers.ts): every one on, with words, that does not lead its slot. */
export function extrasOf(layers: readonly TextLayer[]): TextLayer[] {
  const leads = new Set(Object.values(leadsOf(layers)).map((l) => l!.id));
  return layers.filter((l) => !leads.has(l.id) && hasContent(l));
}

/** A fresh id: t<n>, the first n not taken. */
export function newLayerId(layers: readonly TextLayer[]): string {
  const taken = new Set(layers.map((l) => l.id));
  for (let n = 1; ; n++) if (!taken.has('t' + n)) return 't' + n;
}

const unit = (v: unknown, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : undefined);
/** A stored photo reference: an id, a known treatment (R15) or null, and only the known place fields in range; anything else: null. */
export function photoRef(raw: unknown): PhotoSpec | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as any;
  if (typeof r.id !== 'string' || !r.id || r.id.length > 80) return null;
  let place: PhotoPlace | null = null;
  if (r.place && typeof r.place === 'object' && !Array.isArray(r.place)) {
    const p: PhotoPlace = {};
    if ((PHOTO_ROLES as readonly string[]).includes(r.place.role)) p.role = r.place.role;
    const s = unit(r.place.scale, 1, 2.5), x = unit(r.place.x, 0, 1), y = unit(r.place.y, 0, 1);
    if (s !== undefined) p.scale = s;
    if (x !== undefined) p.x = x;
    if (y !== undefined) p.y = y;
    if (typeof r.place.crop === 'number' && Number.isFinite(r.place.crop)) p.crop = Math.floor(Math.abs(r.place.crop)) >>> 0;
    if (Object.keys(p).length) place = p;
  }
  return { id: r.id, treatment: isTreatment(r.treatment) ? r.treatment : null, place };
}

const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const seedOf = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(Math.abs(v)) >>> 0 : d);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const HEX = /^#[0-9a-f]{6}$/i;
/** Colour edits as stored: only known modes and roles, only #rrggbb (lower case); nothing left: null. */
export function colourEdits(raw: unknown): ColourEdits | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: ColourEdits = {};
  for (const md of ['light', 'dark'] as const) {
    const r = (raw as any)[md];
    if (r == null || typeof r !== 'object') continue;
    const one: Partial<Record<ColourRole, string>> = {};
    for (const k of COLOUR_ROLES) if (typeof r[k] === 'string' && HEX.test(r[k])) one[k] = r[k].toLowerCase();
    if (Object.keys(one).length) out[md] = one;
  }
  return Object.keys(out).length ? out : null;
}

const pairsIn = (list: unknown): InfoPair[] => (Array.isArray(list) ? list : [])
  .filter((p: any) => p && typeof p === 'object')
  .slice(0, 3)
  .map((p: any) => ({ k: str(p.k, '').slice(0, 60), v: str(p.v, '').slice(0, 120) }));

/** A v2 layer list as stored: known levels only, ids unique, at most MAX_LAYERS; anything else dropped. */
function layersIn(raw: unknown[]): TextLayer[] {
  const out: TextLayer[] = [];
  for (const r of raw) {
    if (out.length >= MAX_LAYERS) break;
    if (r == null || typeof r !== 'object') continue;
    const x = r as any;
    if (!(LEVELS as string[]).includes(x.level)) continue;
    const level = x.level as Level;
    let id = typeof x.id === 'string' && x.id && x.id.length <= 24 ? x.id : '';
    if (!id || out.some((l) => l.id === id)) id = newLayerId(out);
    const v = level === 'data' ? pairsIn(x.v) : str(x.v, '').slice(0, 400);
    out.push({ id, level, v, on: bool(x.on, true), pos: strOrNull(x.pos) });
  }
  return out;
}

function slotText(raw: any, d: TextSlot<string>): TextSlot<string> {
  if (raw == null || typeof raw !== 'object') return structuredClone(d);
  return { on: bool(raw.on, d.on), v: str(raw.v, d.v).slice(0, 400), pos: strOrNull(raw.pos) };
}
function slotInfo(raw: any, d: TextSlot<InfoPair[]>): TextSlot<InfoPair[]> {
  if (raw == null || typeof raw !== 'object') return structuredClone(d);
  const v = pairsIn(Array.isArray(raw.v) ? raw.v : d.v);
  return { on: bool(raw.on, d.on), v, pos: strOrNull(raw.pos) };
}

/**
 * Accept anything, return a valid v2 spec. Unknown fields are dropped, bad values take defaults.
 * Migrates a v1 spec (spec 8.6): its four text slots become layers t1 to t4 (`layersOf`), so it draws as it did.
 * Migrates the spike's shape (v absent): seeds.motif -> seeds.graphic, a type seed added,
 * top-level palette / motif / layout -> pick. Never throws.
 */
export function migrate(raw: unknown): Spec {
  const d = defaultSpec();
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return d; }
  }
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const r = raw as any;
  const seeds = r.seeds && typeof r.seeds === 'object' ? r.seeds : {};
  const legacy = r.v == null;
  const pickRaw = r.pick && typeof r.pick === 'object' ? r.pick : {};
  const spec: Spec = {
    v: 2,
    style: oneOf(r.style, ['swiss', 'pomo', 'brutal', 'vapor'] as const, d.style),
    format: oneOf(r.format, Object.keys(FORMATS) as Format[], d.format),
    mode: oneOf(r.mode, ['light', 'dark'] as const, d.mode),
    finish: oneOf(r.finish, ['clean', 'grain', 'grunge', 'vhs', 'glitch'] as const, d.finish),
    marks: oneOf(r.marks, ['off', 'light', 'full'] as const, d.marks),
    seeds: {
      layout: seedOf(seeds.layout, d.seeds.layout),
      colour: seedOf(seeds.colour, d.seeds.colour),
      graphic: seedOf(seeds.graphic ?? seeds.motif, d.seeds.graphic),
      type: seedOf(seeds.type, d.seeds.type),
    },
    pick: {
      palette: strOrNull(pickRaw.palette ?? (legacy ? r.palette : null)),
      colours: colourEdits(pickRaw.colours),
      pairing: strOrNull(pickRaw.pairing),
      motif: strOrNull(pickRaw.motif ?? (legacy ? r.motif : null)),
      layout: strOrNull(pickRaw.layout ?? (legacy ? r.layout : null)),
      dialect: (DIALECTS as string[]).includes(pickRaw.dialect) ? pickRaw.dialect : null,
    },
    photo: photoRef(r.photo),
    params: {},
    text: r.v === 2 && Array.isArray(r.text) ? layersIn(r.text) : r.v === 2 ? structuredClone(DEFAULT_TEXT) : layersOf({
      title: slotText(r.text?.title, DEFAULT_SLOTS.title),
      subtitle: slotText(r.text?.subtitle, DEFAULT_SLOTS.subtitle),
      info: slotInfo(r.text?.info, DEFAULT_SLOTS.info),
      caption: slotText(r.text?.caption, DEFAULT_SLOTS.caption),
    }),
  };
  if (r.params && typeof r.params === 'object' && !Array.isArray(r.params)) {
    for (const [k, v] of Object.entries(r.params)) {
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') spec.params[k] = v;
    }
  }
  return spec;
}

/** Problems with a raw spec, for a paste box: empty means valid as it stands. */
export function validate(raw: unknown): string[] {
  const out: string[] = [];
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return ['not an object'];
  const r = raw as any;
  if (r.v !== 2) out.push(r.v === 1 ? 'v is 1: its text slots become layers' : 'v is not 2');
  if (!['swiss', 'pomo', 'brutal', 'vapor'].includes(r.style)) out.push('unknown style');
  if (!(r.format in FORMATS)) out.push('unknown format');
  for (const f of ['layout', 'colour', 'graphic', 'type']) if (typeof r.seeds?.[f] !== 'number') out.push('seed ' + f + ' missing');
  if (!Array.isArray(r.text)) out.push('text is not a layer list');
  return out;
}

/** A short code for the seed chip and file names. */
export function seedCode(s: Spec['seeds']): string {
  const h = (s.layout ^ Math.imul(s.colour, 3) ^ Math.imul(s.graphic, 5) ^ Math.imul(s.type, 7)) >>> 0;
  const x = h.toString(16).toUpperCase().padStart(8, '0');
  return x.slice(0, 4) + '-' + x.slice(4);
}

/** The lead layer of a slot's level (the object itself, for tests and tools that change it in place). */
export const lead = (layers: TextLayer[], k: Slot): TextLayer => leadsOf(layers)[k]!;
