/** The design is data (spec 3). Schema v1, validation and migration. */
import type { Format } from './formats';
import { FORMATS } from './formats';
import { PHOTO_ROLES, type PhotoPlace, type PhotoSpec } from './photo';

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
export interface Spec {
  v: 1;
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
  text: {
    title: TextSlot<string>;
    subtitle: TextSlot<string>;
    info: TextSlot<InfoPair[]>;
    caption: TextSlot<string>;
  };
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

export const DEFAULT_TEXT: Spec['text'] = {
  title: { on: true, v: 'Signal and noise', pos: null },
  subtitle: { on: true, v: 'A modular identity system', pos: null },
  info: { on: true, v: [{ k: 'Where', v: 'Lisboa' }, { k: 'When', v: '23 Nov 2026' }, { k: 'Edition', v: '01' }], pos: null },
  caption: { on: true, v: 'Vol. 01 — generated, not drawn', pos: null },
};

export function defaultSpec(seeds?: Partial<Spec['seeds']>): Spec {
  return {
    v: 1, style: 'swiss', format: '3:4', mode: 'light', finish: 'clean', marks: 'off',
    seeds: { layout: 1, colour: 2, graphic: 3, type: 4, ...seeds },
    pick: { palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null },
    photo: null,
    params: {},
    text: structuredClone(DEFAULT_TEXT),
  };
}

const unit = (v: unknown, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : undefined);
/** A stored photo reference: an id, a treatment name or null, and only the known place fields in range; anything else: null. */
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
  return { id: r.id, treatment: typeof r.treatment === 'string' && r.treatment ? r.treatment : null, place };
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

function slotText(raw: any, d: TextSlot<string>): TextSlot<string> {
  if (raw == null || typeof raw !== 'object') return structuredClone(d);
  return { on: bool(raw.on, d.on), v: str(raw.v, d.v).slice(0, 400), pos: strOrNull(raw.pos) };
}
function slotInfo(raw: any, d: TextSlot<InfoPair[]>): TextSlot<InfoPair[]> {
  if (raw == null || typeof raw !== 'object') return structuredClone(d);
  const list = Array.isArray(raw.v) ? raw.v : d.v;
  const v = list
    .filter((p: any) => p && typeof p === 'object')
    .slice(0, 3)
    .map((p: any) => ({ k: str(p.k, '').slice(0, 60), v: str(p.v, '').slice(0, 120) }));
  return { on: bool(raw.on, d.on), v, pos: strOrNull(raw.pos) };
}

/**
 * Accept anything, return a valid v1 spec. Unknown fields are dropped, bad values take defaults.
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
    v: 1,
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
    text: {
      title: slotText(r.text?.title, d.text.title),
      subtitle: slotText(r.text?.subtitle, d.text.subtitle),
      info: slotInfo(r.text?.info, d.text.info),
      caption: slotText(r.text?.caption, d.text.caption),
    },
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
  if (r.v !== 1) out.push('v is not 1');
  if (!['swiss', 'pomo', 'brutal', 'vapor'].includes(r.style)) out.push('unknown style');
  if (!(r.format in FORMATS)) out.push('unknown format');
  for (const f of ['layout', 'colour', 'graphic', 'type']) if (typeof r.seeds?.[f] !== 'number') out.push('seed ' + f + ' missing');
  if (!r.text || typeof r.text !== 'object') out.push('text missing');
  return out;
}

/** A short code for the seed chip and file names. */
export function seedCode(s: Spec['seeds']): string {
  const h = (s.layout ^ Math.imul(s.colour, 3) ^ Math.imul(s.graphic, 5) ^ Math.imul(s.type, 7)) >>> 0;
  const x = h.toString(16).toUpperCase().padStart(8, '0');
  return x.slice(0, 4) + '-' + x.slice(4);
}
