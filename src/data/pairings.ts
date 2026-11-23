/**
 * Font pairings (spec 6). R1 carries only the pairings built on the bundled core set;
 * R3 brings in the rest of docs/design/pairings.md with online loading.
 */
import type { StyleId } from '../engine/spec';
import type { FontRef } from '../engine/scene';

export interface Pairing {
  id: string;
  name: string;
  display: FontRef;     // the title
  text: FontRef;        // subtitle and body
  label?: FontRef;      // small upper-case labels; defaults to text
  serif?: FontRef;      // a subtitle face where the style uses one
  mono: FontRef;
  pixel?: FontRef;
  notes: string;
}

const f = (family: string, weight: number, italic = false): FontRef => ({ family, weight, italic });

export const PAIRINGS: Record<StyleId, Pairing[]> = {
  swiss: [
    { id: 'sw-inter-tight', name: 'Inter Tight', display: f('Inter Tight', 800), text: f('Inter Tight', 400), label: f('Inter Tight', 700), mono: f('Inter Tight', 500), notes: 'Spike, approved look. Default.' },
  ],
  pomo: [
    { id: 'pm-bricolage', name: 'Bricolage / Instrument', display: f('Bricolage Grotesque', 800), text: f('DM Mono', 400), serif: f('Instrument Serif', 400, true), mono: f('DM Mono', 400), notes: 'Spike, approved look. Default.' },
  ],
  brutal: [
    { id: 'br-anton', name: 'Anton', display: f('Anton', 400), text: f('DM Mono', 400), mono: f('DM Mono', 400), notes: 'Spike, shown. Default.' },
    { id: 'br-archivo-black', name: 'Archivo Black', display: f('Archivo Black', 400), text: f('DM Mono', 400), mono: f('DM Mono', 400), notes: 'Spike, shown.' },
  ],
  vapor: [
    { id: 'vp-unbounded', name: 'Unbounded', display: f('Unbounded', 800), text: f('Inter Tight', 500), mono: f('DM Mono', 400), pixel: f('Silkscreen', 400), notes: 'Spike, shown. Default.' },
  ],
};

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
export const UI_FONTS = [
  { family: 'DM Sans', weight: 400, file: 'dm-sans-latin-400-normal.woff2' },
  { family: 'DM Sans', weight: 500, file: 'dm-sans-latin-500-normal.woff2' },
  { family: 'DM Sans', weight: 700, file: 'dm-sans-latin-700-normal.woff2' },
];
