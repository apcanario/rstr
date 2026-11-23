/**
 * Google Fonts css2 requests and responses, as pure functions (spec 6). One request per family names only
 * the faces a pairing uses; the response's @font-face rules become FontFaces, latin and latin-ext only.
 * `tools/fetch_fonts.py` builds the same URLs.
 */
import { SOURCES } from './data/pairings';
import type { FontRef } from './engine/scene';

export const CSS_HOST = 'https://fonts.googleapis.com';
export const FILE_HOST = 'https://fonts.gstatic.com';

/** The faces grouped by family, in a stable order. */
export function byFamily(faces: FontRef[]): Map<string, FontRef[]> {
  const out = new Map<string, FontRef[]>();
  for (const f of faces) out.set(f.family, [...(out.get(f.family) ?? []), f]);
  return out;
}

/** The css2 URL for some faces of one family (an alias family maps to its real family and width). */
export function cssUrl(family: string, faces: FontRef[]): string {
  const src = SOURCES[family];
  const real = src?.family ?? family;
  // the ital axis is named only when an italic is asked for (a family without italics may refuse it)
  const ital = faces.some((f) => f.italic), wdth = src?.wdth;
  const tuples = [...new Map(faces.map((f) => {
    const t = [...(ital ? [f.italic ? 1 : 0] : []), ...(wdth != null ? [wdth] : []), f.weight];
    return [t.join(','), t] as const;
  })).values()].sort((a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
  const axes = [...(ital ? ['ital'] : []), ...(wdth != null ? ['wdth'] : []), 'wght'].join(',');
  return `${CSS_HOST}/css2?family=${encodeURIComponent(real).replace(/%20/g, '+')}:${axes}@${tuples.map((t) => t.join(',')).join(';')}&display=block`;
}

export interface FaceRule { subset: string; style: 'normal' | 'italic'; weight: number; url: string; unicodeRange?: string; }

const KEEP = new Set(['latin', 'latin-ext', '']);

/** The @font-face rules of a css2 response: subset (from the comment before it), style, weight, file, range. */
export function parseCss(css: string): FaceRule[] {
  const out: FaceRule[] = [];
  const re = /(?:\/\*\s*([^*]*?)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const body = m[2];
    const get = (k: string) => new RegExp(`${k}\\s*:\\s*([^;]+);?`).exec(body)?.[1].trim();
    const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(get('src') ?? '')?.[1];
    if (!url) continue;
    const w = parseInt(get('font-weight') ?? '400', 10);
    out.push({ subset: (m[1] ?? '').replace(/^\[\d+\]$/, 'n'), style: get('font-style') === 'italic' ? 'italic' : 'normal', weight: Number.isFinite(w) ? w : 400, url, unicodeRange: get('unicode-range') });
  }
  return out;
}

/** True if a unicode-range (absent: everything) covers every code point from `lo` to `hi`. */
export function covers(range: string | undefined, lo = 0x41, hi = 0x5a): boolean {
  if (!range) return true;
  const spans = range.split(',').map((t) => t.trim().replace(/^U\+/i, '')).filter(Boolean).map((t) => {
    if (t.includes('?')) return [parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16)];
    const [a, b] = t.split('-');
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
  for (let c = lo; c <= hi; c++) if (!spans.some(([a, b]) => a <= c && c <= b)) return false;
  return true;
}

/**
 * The rules to load for the wanted faces: latin and latin-ext. A font with neither (a CJK family served as
 * numbered slices) keeps only the slices that cover A-Z, never every slice; with none, the face has no rule
 * and fails (review R3 M3).
 */
export function rulesFor(rules: FaceRule[], faces: FontRef[]): { face: FontRef; rule: FaceRule }[] {
  const out: { face: FontRef; rule: FaceRule }[] = [];
  for (const face of faces) {
    const mine = rules.filter((r) => r.weight === face.weight && (r.style === 'italic') === !!face.italic);
    const kept = mine.filter((r) => KEEP.has(r.subset));
    for (const rule of kept.length ? kept : mine.filter((r) => covers(r.unicodeRange))) out.push({ face, rule });
  }
  return out;
}
