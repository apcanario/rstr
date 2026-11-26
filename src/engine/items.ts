/** Small constructors that compute each item's world quad. */
import { apply, bounds, pad, rectQuad, union, unapply, xfQuad, type Quad, type Rect, type Xf } from './geom';
import type { Measure } from './measure';
import type { FontRef, GraphicItem, Paint, RectItem, Run, TextItem } from './scene';
import type { Slot } from './spec';

export interface TextIn {
  slot: Slot; part: string; font: FontRef; size: number; tracking?: number; runs: Run[]; xf?: Xf; clip?: Rect;
  fill: Paint; stroke?: { paint: Paint; width: number; halo?: boolean }; echoes?: { dx: number; dy: number; paint: Paint; halo?: Paint }[];
  ink: string[]; min: number; group?: string; waive?: number[];
}

/** Local ink rect of one run. */
export function runInk(m: Measure, font: FontRef, size: number, tracking: number, r: Run): Rect {
  const mt = m(r.s, font, size, tracking), sx = r.sx ?? 1, sy = r.sy ?? 1;
  return { x: r.x - mt.left * sx, y: r.y - mt.ascent * sy, w: (mt.left + mt.right) * sx, h: (mt.ascent + mt.descent) * sy };
}

export function mkText(m: Measure, o: TextIn): TextItem {
  const tracking = o.tracking ?? 0;
  const rects: Rect[] = [];
  for (const r of o.runs) {
    if (!r.s) continue;
    let ink = runInk(m, o.font, o.size, tracking, r);
    const sw = o.stroke ? o.stroke.width : 0;   // paint shows the outer half of a stroke twice this wide
    if (sw) ink = { x: ink.x - sw, y: ink.y - sw, w: ink.w + 2 * sw, h: ink.h + 2 * sw };
    const all = [ink, ...(o.echoes ?? []).map((e) => ({ ...ink, x: ink.x + e.dx, y: ink.y + e.dy }))];
    rects.push(union(all));
  }
  let local = rects.length ? union(rects) : { x: 0, y: 0, w: 0, h: 0 };
  if (o.clip) {
    const c = o.clip;
    const x = Math.max(local.x, c.x), y = Math.max(local.y, c.y);
    local = { x, y, w: Math.max(0, Math.min(local.x + local.w, c.x + c.w) - x), h: Math.max(0, Math.min(local.y + local.h, c.y + c.h) - y) };
  }
  const scale = Math.min(...o.runs.map((r) => Math.min(r.sx ?? 1, r.sy ?? 1)), 1e9);
  return {
    kind: 'text', slot: o.slot, part: o.part, font: o.font, size: o.size, tracking, runs: o.runs, xf: o.xf, clip: o.clip,
    fill: o.fill, stroke: o.stroke, echoes: o.echoes, quad: xfQuad(o.xf, rectQuad(local)), ink: o.ink,
    ...(o.group ? { group: o.group } : {}), ...(o.waive ? { waive: o.waive } : {}),
    px: o.size * (Number.isFinite(scale) ? scale : 1), min: o.min,
  };
}

export function mkRect(r: Rect, fill: Paint, o: { xf?: Xf; plate?: boolean; shadow?: { dx: number; dy: number; fill: string }; stroke?: { colour: string; width: number } } = {}): RectItem {
  const sw = o.stroke ? o.stroke.width / 2 : 0;
  const rr = sw ? { x: r.x - sw, y: r.y - sw, w: r.w + 2 * sw, h: r.h + 2 * sw } : r;
  return {
    kind: 'rect', r, xf: o.xf, fill, plate: o.plate, shadow: o.shadow, stroke: o.stroke,
    quad: xfQuad(o.xf, rectQuad(rr)),
    shadowQuad: o.shadow ? xfQuad(o.xf, rectQuad({ ...r, x: r.x + o.shadow.dx, y: r.y + o.shadow.dy })) : undefined,
  };
}

export function mkGraphic(name: string, box: Rect, seed: number, skipN: number, colours: Record<string, string>, fills: string[], params: GraphicItem['params'] = {}, o: { xf?: Xf; extent?: Rect; avoid?: Quad[] } = {}): GraphicItem {
  const quad = o.xf ? xfQuad(o.xf, rectQuad(o.extent ?? box)) : rectQuad(o.extent ?? box);
  return { kind: 'graphic', name, box, seed, skip: skipN, colours, params, fills, quad, xf: o.xf, avoid: o.avoid };
}

export const quadBounds = (q: Quad) => bounds(q);
export { apply };

/**
 * A plate under text item t, in its own orientation, its ink's bounds padded by `d` (review R14 M3: the photo's
 * plates and the colour edit's repair plates share this one helper, each with its own pad).
 */
export function plateUnder(t: TextItem, fill: string, d: number): RectItem {
  if (!t.xf) return mkRect(pad(bounds(t.quad), d), fill, { plate: true });
  const local: Quad = t.quad.map((p) => unapply(t.xf!, p));
  return mkRect(pad(bounds(local), d), fill, { xf: t.xf, plate: true });
}
