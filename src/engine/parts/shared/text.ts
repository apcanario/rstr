import type { Measure } from '../../measure';
import type { FontRef } from '../../scene';
import { fitLine, inkW, type Fit } from '../../text';

/** Several single lines at one shared size: the largest size at which every line fits maxW. */
export function fitLines(m: Measure, lines: string[], font: FontRef, start: number, min: number, maxW: number, track = 0, force = false): { size: number; lines: string[]; fits: Fit[] } | null {
  const ls = lines.map((l) => l.replace(/\s*\n\s*/g, ' '));
  for (let px = Math.round(start); px >= min; px--) {
    const tr = track * px;
    if (ls.every((l) => inkW(m(l, font, px, tr)) <= maxW)) {
      const fits = ls.map((l) => fitLine(m, l, font, px, px, maxW, track)!);
      return { size: px, lines: ls, fits };
    }
  }
  if (!force) return null;
  const fits = ls.map((l) => fitLine(m, l, font, min, min, maxW, track, true));
  if (fits.some((f) => !f)) return null;
  return { size: min, lines: fits.map((f) => f!.lines[0]), fits: fits as Fit[] };
}

export const upper = (s: string) => s.toLocaleUpperCase('en');
