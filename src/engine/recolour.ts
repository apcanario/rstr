/**
 * Colours edited for this design (spec 5, Advanced). The layout is solved with the palette's own colours, so an edit
 * never moves a box (the colour seed never does, 9.3); then every colour of the Scene that is a palette role's value
 * is swapped for the edited one. Where a text item then falls under the contrast of spec 5, the engine swaps its ink
 * for another of the design's colours, else puts a plate of one of them under it; where nothing passes, the text keeps
 * the best plate and the Scene lists it in `colourWarn` (the Colour tab warns). The edit is never refused.
 *
 * The faint pattern's recorded fill is mixed again from the edited ground and ink, as it is drawn (review R10 M1);
 * other colours the styles mix from roles (photocopy contours and tape) keep the palette's mix (Carried). Pure and
 * deterministic: no randomness.
 */
import type { Form } from '../data/palettes';
import { contrast, needRatio } from './colour';
import { patternFill } from './graphics/pattern';
import { designRoles, editedForm } from './controls';
import { bounds, type Quad } from './geom';
import { coloursOf, haloOf, lowContrast, OUTLINE_MIN } from './invariants';
import { plateUnder } from './items';
import type { Item, Paint, Scene, TextItem } from './scene';
import { COLOUR_ROLES, type Spec } from './spec';

/** palette value (lower case) -> edited value, for the roles this design edits in its mode. */
export function editMap(P: Form, s: Spec): Map<string, string> {
  const E = editedForm(P, s), out = new Map<string, string>();
  for (const r of COLOUR_ROLES) {
    const a = P[r], b = E[r];
    if (a && b && a.toLowerCase() !== b.toLowerCase() && !out.has(a.toLowerCase())) out.set(a.toLowerCase(), b);
  }
  return out;
}

function mapPaint(p: Paint, f: (c: string) => string): Paint {
  return typeof p === 'string' ? f(p) : { ...p, stops: p.stops.map(([t, c]) => [t, f(c)] as [number, string]) };
}
function mapItem(it: Item, f: (c: string) => string, ground: string): Item {
  if (it.kind === 'text') {
    return {
      ...it, fill: mapPaint(it.fill, f), ink: it.ink.map(f),
      ...(it.stroke ? { stroke: { ...it.stroke, paint: mapPaint(it.stroke.paint, f) } } : {}),
      ...(it.echoes ? { echoes: it.echoes.map((e) => ({ ...e, paint: mapPaint(e.paint, f), ...(e.halo ? { halo: mapPaint(e.halo, f) } : {}) })) } : {}),
    };
  }
  if (it.kind === 'rect') {
    return { ...it, fill: mapPaint(it.fill, f), ...(it.shadow ? { shadow: { ...it.shadow, fill: f(it.shadow.fill) } } : {}), ...(it.stroke ? { stroke: { ...it.stroke, colour: f(it.stroke.colour) } } : {}) };
  }
  // the photo's colours are its pixels, not palette roles: an edit never touches them
  if (it.name === 'photo') return it;
  const colours = Object.fromEntries(Object.entries(it.colours).map(([k, v]) => [k, f(v)]));
  // the faint pattern is drawn as the edited ink over the edited ground: its recorded fill is mixed again from them,
  // so rule 4 reads the colour drawn (review R10 M1)
  const fills = it.name === 'pattern' && it.layer === 'ground' ? [patternFill(f(ground), colours.ink, it.params)] : it.fills.map(f);
  return { ...it, colours, fills, ...(it.plate ? { plate: f(it.plate) } : {}) };
}

/** The text item with c as the colour that carries it (its fill, or its outline where the outline carries it). */
function withInk(t: TextItem, c: string): TextItem {
  if (!haloOf(t) && t.stroke && t.stroke.width >= OUTLINE_MIN * t.size - 1e-9) return { ...t, stroke: { ...t.stroke, paint: c }, ink: [c] };
  return { ...t, fill: c, ink: [c] };
}

/** The lowest contrast of the item's ink against bg. */
function worst(t: TextItem, bg: string[]): number {
  const inks = haloOf(t) ? coloursOf(t.fill) : t.stroke && t.stroke.width >= OUTLINE_MIN * t.size - 1e-9 ? coloursOf(t.stroke.paint) : coloursOf(t.fill);
  let w = Infinity;
  for (const c of inks) for (const b of bg) w = Math.min(w, contrast(c, b));
  return w;
}

/**
 * The Scene with this design's colour edits (spec 5); unchanged when there are none. Text that falls under contrast
 * takes another of the design's colours as its ink, else a plate; what cannot pass is named in `colourWarn`.
 */
export function applyColourEdits(sc0: Scene, P: Form, s: Spec): Scene {
  // the design's colours, read before the edit, so the list does not move as colours change
  const roles = designRoles(P, sc0), sc: Scene = { ...sc0, designRoles: roles };
  const map = editMap(P, s);
  if (!map.size) return sc;
  const f = (c: string) => map.get(c.toLowerCase()) ?? c;
  const items = sc.items.map((it) => mapItem(it, f, sc.ground));
  const out: Scene = { ...sc, ground: f(sc.ground), items };
  // the design's own colours as edited, its ink and ground first: the only colours a repair may use
  const E = editedForm(P, s), order = (g: string[]) => (g.includes('ink') || g.includes('toner') ? 0 : g.includes('ground') || g.includes('paper') ? 1 : 2);
  const cands = [...new Set([...roles].sort((a, b) => order(a) - order(b)).map((g) => E[g[0]]).filter((c): c is string => !!c).map((c) => c.toLowerCase()))];
  const warn: string[] = [];
  // a text item gets one plate at most: one that still fails keeps it and is warned of
  const plated = new Set<Item>();
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < items.length; i++) {
      const t = items[i];
      if (t.kind !== 'text' || t.waive?.includes(4) || plated.has(t) || !lowContrast(out, i)) continue;
      changed = true;
      // 1. another of the design's colours as its ink
      const swap = cands.map((c) => withInk(t, c)).find((u) => { items[i] = u; return !lowContrast(out, i); });
      if (swap) { items[i] = swap; continue; }
      items[i] = t;
      // 2. a plate of one colour under it, with the ink that reads best on it
      const need = needRatio(t.px);
      let best: { u: TextItem; plate: string; r: number } | null = null;
      for (const p of cands) for (const c of cands) {
        if (c === p) continue;
        const u = withInk(t, c), r = worst(u, haloOf(u) ?? [p]);
        if (!best || r > best.r + 1e-9) best = { u, plate: p, r };
      }
      if (!best) continue;
      // the plate goes under the first text item it would cover, so it is never drawn over text (rule 3)
      const plate = plateUnder(best.u, best.plate, Math.max(4, best.u.size * 0.12));
      let at = i;
      for (let j = 0; j < i; j++) if (items[j].kind === 'text' && overlapsQuad(items[j] as TextItem, plate.quad)) { at = j; break; }
      items[i] = best.u;
      plated.add(best.u);
      items.splice(at, 0, plate);
      out.items = items;
      if (best.r < need - 1e-6 || lowContrast(out, i + 1)) warn.push(`${t.slot}.${t.part}`);
      i++;
    }
    if (!changed) break;
  }
  out.items = items;
  // what is still under contrast after the repair (an item moved by a plate counts once)
  const low = items.map((t, i) => (t.kind === 'text' && !t.waive?.includes(4) && lowContrast(out, i) ? `${t.slot}.${t.part}` : null)).filter((x): x is string => !!x);
  const all = [...new Set([...warn.filter((w) => low.includes(w)), ...low])];
  if (all.length) out.colourWarn = all;
  return out;
}

function overlapsQuad(t: TextItem, q: Quad): boolean {
  const a = bounds(t.quad), b = bounds(q);
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
}
