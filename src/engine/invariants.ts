/** Spec 9.2, checked on the Scene. */
import { contrast, mixHex, needRatio } from './colour';
import { STORY_TEXT_BOTTOM, STORY_TEXT_TOP } from './formats';
import { contains, overlaps, type Quad } from './geom';
import type { Item, Paint, Scene, TextItem } from './scene';

export interface Failure { rule: number; part: string; msg: string; }

export function sample(p: Paint, q: Quad): string[] {
  if (typeof p === 'string') return [p];
  const dx = p.x1 - p.x0, dy = p.y1 - p.y0, L = dx * dx + dy * dy || 1;
  const ts = q.map(([x, y]) => ((x - p.x0) * dx + (y - p.y0) * dy) / L);
  const t0 = Math.max(0, Math.min(1, Math.min(...ts))), t1 = Math.max(0, Math.min(1, Math.max(...ts)));
  const at = (t: number) => {
    const s = p.stops;
    if (t <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) if (t <= s[i][0]) return mixHex(s[i - 1][1], s[i][1], (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0] || 1));
    return s[s.length - 1][1];
  };
  return [at(t0), at(t1), ...p.stops.filter(([t]) => t > t0 && t < t1).map(([, c]) => c)];
}

/** Every colour a paint can show: the colour, or each stop of a gradient. */
export const coloursOf = (p: Paint): string[] => (typeof p === 'string' ? [p] : p.stops.map(([, c]) => c));

/** An outline at least this wide (as a share of the type size) carries legibility on its own. */
export const OUTLINE_MIN = 0.04;
/** A paper halo at least this wide (share of the type size) is what the fill of a haloed word sits on. */
export const HALO_MIN = 0.05;
/** The halo's colours if the item has a halo wide enough to carry its fill (spec 8.2, paper edge), else null. */
export const haloOf = (t: TextItem): string[] | null => (t.stroke?.halo && t.stroke.width >= HALO_MIN * t.size - 1e-9 ? coloursOf(t.stroke.paint) : null);

/**
 * The colours that carry a text item's legibility, derived from what is painted, never from what a style
 * claims: the outline's colours if the item has an outline at least OUTLINE_MIN of its size wide (the
 * fill inside it is then not checked), else every colour of the fill. Echoes are offset copies of the
 * text itself and count as its own ink, not as background (changelog, R1 Choices).
 */
export function inkOf(t: TextItem): string[] {
  if (t.stroke && t.stroke.width >= OUTLINE_MIN * t.size - 1e-9) return coloursOf(t.stroke.paint);
  return coloursOf(t.fill);
}

const avoided = (it: Item, q: Quad) => it.kind === 'graphic' && !!it.avoid?.some((a) => contains(a, q));

/** Every colour that can sit directly behind text item i. */
export function behind(scene: Scene, i: number): string[] {
  const T = scene.items[i] as TextItem, out = new Set<string>();
  for (let j = i - 1; j >= 0; j--) {
    const it = scene.items[j];
    if (it.kind === 'text') continue;
    if (it.kind === 'graphic') {
      if (!avoided(it, T.quad) && overlaps(it.quad, T.quad)) it.fills.forEach((c) => out.add(c));
      continue;
    }
    if (overlaps(it.quad, T.quad)) {
      sample(it.fill, T.quad).forEach((c) => out.add(c));
      if (contains(it.quad, T.quad)) return [...out];
    }
    if (it.shadowQuad && it.shadow && overlaps(it.shadowQuad, T.quad)) {
      out.add(it.shadow.fill);
      if (contains(it.shadowQuad, T.quad)) return [...out];
    }
  }
  out.add(scene.ground);
  return [...out];
}

/**
 * Rule 4 for text item i (spec 5): null if it passes, else what failed. A haloed word's fill sits on its halo;
 * anything else is read against what is behind it.
 */
export function lowContrast(scene: Scene, i: number): string | null {
  const t = scene.items[i] as TextItem;
  const halo = haloOf(t), bg = halo ?? behind(scene, i), need = needRatio(t.px);
  for (const c of halo ? coloursOf(t.fill) : inkOf(t)) for (const b of bg) {
    const r = contrast(c, b);
    if (r < need - 1e-6) return `contrast ${r.toFixed(2)} < ${need} (${c} on ${b})`;
  }
  return null;
}

export function check(scene: Scene, rules: number[] = [1, 2, 3, 4, 5]): Failure[] {
  const f: Failure[] = [];
  const story = scene.format === '9:16';
  const texts = scene.items.map((it, i) => [it, i] as const).filter(([it]) => it.kind === 'text') as [TextItem, number][];
  const tol = 0.5;
  for (const [t, i] of texts) {
    const name = t.slot + '.' + t.part;
    if (rules.includes(1)) {
      const ys = t.quad.map((p) => p[1]), xs = t.quad.map((p) => p[0]);
      if (Math.min(...xs) < -tol || Math.max(...xs) > scene.w + tol || Math.min(...ys) < -tol || Math.max(...ys) > scene.h + tol)
        f.push({ rule: 1, part: name, msg: 'leaves the canvas' });
      else if (story && (Math.min(...ys) < STORY_TEXT_TOP - tol || Math.max(...ys) > STORY_TEXT_BOTTOM + tol))
        f.push({ rule: 1, part: name, msg: `enters a story zone (y ${Math.round(Math.min(...ys))} to ${Math.round(Math.max(...ys))})` });
    }
    if (rules.includes(3)) {
      for (let j = i + 1; j < scene.items.length; j++) {
        const it = scene.items[j];
        if (it.kind === 'text' || (it.kind === 'graphic' && it.pass)) continue;
        const hit = (overlaps(it.quad, t.quad) || (it.kind === 'rect' && it.shadowQuad && overlaps(it.shadowQuad, t.quad))) && !avoided(it, t.quad);
        if (hit) f.push({ rule: 3, part: name, msg: `${it.kind}${it.kind === 'graphic' ? ' ' + it.name : ''} drawn over it` });
      }
    }
    if (rules.includes(4) && !t.waive?.includes(4)) {
      const low = lowContrast(scene, i);
      if (low) f.push({ rule: 4, part: name, msg: low });
    }
    if (rules.includes(5) && t.px < t.min - 1e-6) f.push({ rule: 5, part: name, msg: `${t.px.toFixed(1)} px under the minimum ${t.min}` });
  }
  if (rules.includes(2)) {
    for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
      const ga = texts[a][0].group;
      if (ga && ga === texts[b][0].group) continue;
      if (overlaps(texts[a][0].quad, texts[b][0].quad))
        f.push({ rule: 2, part: texts[a][0].slot + '.' + texts[a][0].part, msg: 'overlaps ' + texts[b][0].slot + '.' + texts[b][0].part });
    }
  }
  return f;
}
