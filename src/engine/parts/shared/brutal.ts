/**
 * Brutalist title lines and the stretched block, shared by its layout part (to size the band) and its type part
 * (to set the title). Pure: reads nothing of either part.
 */
import type { Measure } from '../../measure';
import type { FontRef } from '../../scene';
import { upper } from './text';

/** The Brutalist rule weight and mono size, at canvas width W: layout sizes rows with them, type draws with them. */
export const brutalMetrics = (W: number) => ({ R: Math.max(6, Math.round(W * 0.012)), ms: Math.round(W * 0.023) });

/** The vertical stretch of the block (spec 8.3). */
export const KY_MIN = 0.55, KY_MAX = 1.9;
/** A block narrowed by less than this still counts as full width (rounding of the layout's boxes). */
export const KX_OK = 0.995;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Title lines: a typed line break is kept; otherwise one word per line up to four, else three balanced lines. */
export function brutalLines(title: string): string[] {
  const t = upper(title).trim();
  if (t.includes('\n')) return t.split('\n').map((l) => l.trim()).filter(Boolean);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return words;
  return balanced(words, 3);
}

/** Words in k lines of about equal length (by characters), in order. */
function balanced(words: string[], k: number): string[] {
  if (k >= words.length) return words;
  if (k <= 1) return [words.join(' ')];
  let best: string[] = [], score = Infinity;
  const go = (from: number, left: number, acc: string[]) => {
    if (left === 1) {
      const all = [...acc, words.slice(from).join(' ')], ls = all.map((l) => l.length);
      const s = Math.max(...ls) - Math.min(...ls);
      if (s < score) { score = s; best = all; }
      return;
    }
    for (let i = from + 1; i <= words.length - left + 1; i++) go(i, left - 1, [...acc, words.slice(from, i).join(' ')]);
  };
  go(0, k, []);
  return best;
}

/**
 * The breaks the title may take, most lines first: the rule's own (brutalLines), then the words in fewer, balanced
 * lines down to one. Spec 8.3: every line fills the full width; where the rule's lines at full width cannot fit the
 * height even at the least stretch (0.55), words join so each line is wider and lower, rather than the lines
 * shrinking off the width (review R1 M4). A typed line break is kept as typed.
 */
export function brutalBreaks(title: string): string[][] {
  return breaksFrom(brutalLines(title), upper(title).includes('\n'));
}
/** The breaks that start from these lines: they first, then their words in fewer balanced lines (none if typed). */
export function breaksFrom(first: string[], typed = false): string[][] {
  if (typed) return [first];
  const words = first.join(' ').split(/\s+/).filter(Boolean);
  const out = [first];
  for (let k = first.length - 1; k >= 1; k--) out.push(balanced(words, k));
  return out;
}

export interface BlockLine { l: string; left: number; asc: number; desc: number; s: number; h: number; }
/** Lines scaled to the inner width: their ink height at no stretch, and the gaps between them. */
export function blockInk(m: Measure, lines: string[], face: FontRef, iw: number, gap: number): { ls: BlockLine[]; ink: number; gaps: number } {
  const ls = lines.map((l) => {
    const t = m(l, face, 200);
    const s = iw / (t.left + t.right);
    return { l, left: t.left, asc: t.ascent, desc: t.descent, s, h: (t.ascent + t.descent) * s };
  });
  return { ls, ink: ls.reduce((a, o) => a + o.h, 0), gaps: gap * (lines.length - 1) };
}

/** Every line scaled to the inner width, then the block stretched (0.55 to 1.9) to the height A; where even 0.55 is too tall, the lines narrow (kx < 1). */
export function brutalBlock(m: Measure, lines: string[], face: FontRef, A: number, iw: number, gap: number): { ls: BlockLine[]; ky: number; kx: number; height: number } {
  const { ls, ink, gaps } = blockInk(m, lines, face, iw, gap);
  const ky = clamp((A - gaps) / ink, KY_MIN, KY_MAX), kx = Math.min(1, Math.max(0, A - gaps) / ink / KY_MIN);
  if (kx < 1) ls.forEach((o) => { o.s *= kx; o.h *= kx; });
  return { ls, ky, kx, height: ls.reduce((a, o) => a + o.h * ky, 0) + gaps };
}

/** The first break of the title, most lines first, whose lines fill the width within the stretch range in height A; else the one-line break, narrowed. */
export function brutalFit(m: Measure, breaks: string[][], face: FontRef, A: number, iw: number, gap: number): { lines: string[]; ls: BlockLine[]; ky: number; kx: number; height: number } {
  for (const lines of breaks) {
    const b = brutalBlock(m, lines, face, A, iw, gap);
    if (b.kx >= KX_OK) return { lines, ...b };
  }
  const lines = breaks[breaks.length - 1];
  return { lines, ...brutalBlock(m, lines, face, A, iw, gap) };
}

/** The least height the title can take with every line at full width (the break that is lowest, at the least stretch). */
export function brutalMinHeight(m: Measure, breaks: string[][], face: FontRef, iw: number, gap: number): number {
  return Math.min(...breaks.map((ls) => { const b = blockInk(m, ls, face, iw, gap); return b.ink * KY_MIN + b.gaps; }));
}

/** The height the title takes at stretch k with the rule's own lines (k clamped to the stretch range). */
export function brutalHeightAt(m: Measure, lines: string[], face: FontRef, iw: number, gap: number, k: number): number {
  const b = blockInk(m, lines, face, iw, gap);
  return b.ink * clamp(k, KY_MIN, KY_MAX) + b.gaps;
}
