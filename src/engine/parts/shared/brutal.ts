/** Brutalist title lines and the stretched block, shared by its layout part (to size the band) and its type part (to set the title). */
import type { Measure } from '../../measure';
import type { FontRef } from '../../scene';
import { upper } from './text';

/** The Brutalist rule weight and mono size, at canvas width W: layout sizes rows with them, type draws with them. */
export const brutalMetrics = (W: number) => ({ R: Math.max(6, Math.round(W * 0.012)), ms: Math.round(W * 0.023) });

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Title lines: a typed line break is kept; otherwise one word per line up to four, else three balanced lines. */
export function brutalLines(title: string): string[] {
  const t = upper(title).trim();
  if (t.includes('\n')) return t.split('\n').map((l) => l.trim()).filter(Boolean);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return words;
  const n = Math.ceil(words.length / 3);
  return [0, 1, 2].map((i) => words.slice(i * n, i * n + n).join(' ')).filter(Boolean);
}

export interface BlockLine { l: string; left: number; asc: number; desc: number; s: number; h: number; }
/** Every line scaled to the inner width, then the block stretched (0.55 to 1.9) to the height A. */
export function brutalBlock(m: Measure, lines: string[], face: FontRef, A: number, iw: number, gap: number): { ls: BlockLine[]; ky: number; height: number } {
  const ls = lines.map((l) => {
    const t = m(l, face, 200);
    const s = iw / (t.left + t.right);
    return { l, left: t.left, asc: t.ascent, desc: t.descent, s, h: (t.ascent + t.descent) * s };
  });
  const gaps = gap * (ls.length - 1), ink = ls.reduce((a, o) => a + o.h, 0);
  const ky = clamp((A - gaps) / ink, 0.55, 1.9), kx = Math.min(1, Math.max(0, A - gaps) / ink / 0.55);
  if (kx < 1) ls.forEach((o) => { o.s *= kx; o.h *= kx; });
  return { ls, ky, height: ls.reduce((a, o) => a + o.h * ky, 0) + gap * (ls.length - 1) };
}
