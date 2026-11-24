/**
 * Font pairings (spec 6): the data is `pairings.json`, from docs/design/pairings.md. Each style lists the
 * pairings it allows; the first is its default and uses core fonts only, so it always draws.
 * `tools/fetch_fonts.py` reads the same file for the APK build.
 */
import type { StyleId } from '../engine/spec';
import type { FontRef } from '../engine/scene';
import data from './pairings.json';

export interface Pairing {
  id: string;
  name: string;
  display: FontRef;     // the title
  text: FontRef;        // subtitle and body
  label?: FontRef;      // small upper-case labels; defaults to text
  serif?: FontRef;      // a subtitle face where the style uses one
  mono: FontRef;
  pixel?: FontRef;
  heavy?: FontRef;      // a heavy display face (Postmodern photocopy title words, spec 8.2)
  from: string;
  notes: string;
}

/** Where an alias family comes from on Google Fonts: the real family and a fixed width. */
export interface FontSource { family: string; wdth?: number; }

const raw = data as unknown as { sources: Record<string, FontSource>; pairings: Record<StyleId, (Omit<Pairing, 'notes'> & { notes?: string })[]> };

export const SOURCES: Record<string, FontSource> = raw.sources;

export const PAIRINGS: Record<StyleId, Pairing[]> = Object.fromEntries(
  Object.entries(raw.pairings).map(([s, list]) => [s, list.map((p) => ({ ...p, notes: p.notes ?? '' }))]),
) as Record<StyleId, Pairing[]>;

/** The style's default pairing: the first of its list. */
export const defaultPairing = (style: StyleId): Pairing => PAIRINGS[style][0];

export const ROLES = ['display', 'text', 'label', 'serif', 'mono', 'pixel', 'heavy'] as const;

/** Every face a pairing names, once each. */
export function facesOf(p: Pairing): FontRef[] {
  const out = new Map<string, FontRef>();
  for (const r of ROLES) {
    const f = p[r];
    if (f) out.set(faceKey(f), { family: f.family, weight: f.weight, ...(f.italic ? { italic: true } : {}) });
  }
  return [...out.values()];
}

export const faceKey = (f: FontRef) => `${f.family}|${f.weight}|${f.italic ? 'i' : 'n'}`;

/** The eight core families bundled with the web app, and the UI face. Files in public/fonts. */
export const CORE_FONTS: { family: string; weight: number; italic?: boolean; file: string }[] = [
  { family: 'Inter Tight', weight: 400, file: 'inter-tight-latin-400-normal.woff2' },
  { family: 'Inter Tight', weight: 500, file: 'inter-tight-latin-500-normal.woff2' },
  { family: 'Inter Tight', weight: 700, file: 'inter-tight-latin-700-normal.woff2' },
  { family: 'Inter Tight', weight: 800, file: 'inter-tight-latin-800-normal.woff2' },
  { family: 'Bricolage Grotesque', weight: 800, file: 'bricolage-grotesque-latin-800-normal.woff2' },
  { family: 'Instrument Serif', weight: 400, file: 'instrument-serif-latin-400-normal.woff2' },
  { family: 'Instrument Serif', weight: 400, italic: true, file: 'instrument-serif-latin-400-italic.woff2' },
  { family: 'DM Mono', weight: 400, file: 'dm-mono-latin-400-normal.woff2' },
  { family: 'Anton', weight: 400, file: 'anton-latin-400-normal.woff2' },
  { family: 'Archivo Black', weight: 400, file: 'archivo-black-latin-400-normal.woff2' },
  { family: 'Unbounded', weight: 800, file: 'unbounded-latin-800-normal.woff2' },
  { family: 'Silkscreen', weight: 400, file: 'silkscreen-latin-400-normal.woff2' },
];
export const CORE_FAMILIES = [...new Set(CORE_FONTS.map((f) => f.family))];
export const isCoreFace = (f: FontRef) => CORE_FONTS.some((c) => c.family === f.family && c.weight === f.weight && !!c.italic === !!f.italic);

export const UI_FONTS = [
  { family: 'DM Sans', weight: 400, file: 'dm-sans-latin-400-normal.woff2' },
  { family: 'DM Sans', weight: 500, file: 'dm-sans-latin-500-normal.woff2' },
  { family: 'DM Sans', weight: 700, file: 'dm-sans-latin-700-normal.woff2' },
];
