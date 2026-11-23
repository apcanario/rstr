/** Fitting text to boxes, measured by ink (spec 4). */
import type { Measure, Metrics } from './measure';
import type { FontRef } from './scene';

export function wrap(m: Measure, text: string, font: FontRef, px: number, tracking: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + w : w;
      if (!line || inkW(m(t, font, px, tracking)) <= maxW) line = t;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

export const inkW = (mt: Metrics) => Math.max(0, mt.left) + mt.right;

export interface FitIn {
  text: string;
  font: FontRef;
  maxW: number;
  maxH: number;
  start: number;
  min: number;
  lh: number;            // line pitch in ems
  maxLines: number;
  track?: number;        // tracking in ems
  step?: number;
  force?: boolean;       // at the minimum, shorten with an ellipsis instead of failing
}
export interface Fit {
  size: number;
  lines: string[];
  tracking: number;
  metrics: Metrics[];
  asc: number;           // ink above the first baseline
  desc: number;          // ink below the last baseline
  height: number;        // ink height of the block
  width: number;         // widest ink line
  shortened: boolean;
}

function measureBlock(m: Measure, lines: string[], font: FontRef, px: number, tracking: number, lh: number): Fit {
  const metrics = lines.map((l) => m(l, font, px, tracking));
  const asc = metrics[0]?.ascent ?? 0, desc = metrics[metrics.length - 1]?.descent ?? 0;
  const height = asc + (lines.length - 1) * lh * px + desc;
  const width = Math.max(0, ...metrics.map(inkW));
  return { size: px, lines, tracking, metrics, asc, desc, height, width, shortened: false };
}

const ELL = '…';
function shorten(m: Measure, s: string, font: FontRef, px: number, tracking: number, maxW: number): string {
  if (inkW(m(s, font, px, tracking)) <= maxW) return s;
  let t = s;
  while (t.length > 0) {
    const sp = t.lastIndexOf(' ');
    t = sp > 0 && t.length - sp < 12 ? t.slice(0, sp) : t.slice(0, -1);
    const c = t.replace(/[\s.,;:—–-]+$/, '') + ELL;
    if (inkW(m(c, font, px, tracking)) <= maxW) return c;
  }
  return '';
}

/** The largest size, stepping down from start, at which the text fits; null if it does not fit at min. */
export function fit(m: Measure, o: FitIn): Fit | null {
  const step = o.step ?? 2;
  const text = o.text.trim();
  if (!text) return null;
  for (let px = Math.round(o.start); px >= o.min; px -= step) {
    const tr = (o.track ?? 0) * px;
    const lines = wrap(m, text, o.font, px, tr, o.maxW);
    if (lines.length > o.maxLines) continue;
    const b = measureBlock(m, lines, o.font, px, tr, o.lh);
    if (b.width <= o.maxW && b.height <= o.maxH) return b;
  }
  if (!o.force) return null;
  const px = o.min, tr = (o.track ?? 0) * px;
  let lines = wrap(m, text, o.font, px, tr, o.maxW);
  let cut = false;
  while (lines.length > 0) {
    const b = measureBlock(m, lines, o.font, px, tr, o.lh);
    if (lines.length <= o.maxLines && b.height <= o.maxH) break;
    lines = lines.slice(0, -1);
    cut = true;
  }
  if (!lines.length) return null;
  lines = lines.map((l, i) => {
    const last = i === lines.length - 1;
    const s = shorten(m, cut && last ? l + ELL : l, o.font, px, tr, o.maxW);
    if (s !== l) cut = true;
    return s;
  });
  if (lines.some((l) => !l)) return null;
  const b = measureBlock(m, lines, o.font, px, tr, o.lh);
  if (b.width > o.maxW || b.height > o.maxH) return null;
  b.shortened = cut;
  return b;
}

/** One line, shrink to fit a width (no wrapping). */
export function fitLine(m: Measure, text: string, font: FontRef, start: number, min: number, maxW: number, track = 0, force = false, maxH = Infinity): Fit | null {
  return fit(m, { text: text.replace(/\s*\n\s*/g, ' '), font, maxW, maxH, start, min, lh: 1, maxLines: 1, track, step: 1, force });
}
