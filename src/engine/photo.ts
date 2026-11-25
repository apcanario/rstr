/**
 * The photo (spec 8.9, row R14). One photo per design, chosen from the phone and kept there: the spec holds only its
 * id. The engine never sees the file. The app registers a decoded photo here (`registerPhoto`): its pixel size, the
 * image paint draws, and a grid of its darkest and lightest pixels that layout measures text contrast against
 * (spec 8.9: text over a photo sits on a plate or a scrim unless the measured contrast against the pixels passes).
 * A spec whose photo is not registered draws as if it had none.
 *
 * Where the photo sits and how it is cropped is the layout stream's (spec 3, 8.9): a stream of its own, derived from
 * the layout seed, so a design without a photo draws exactly as before and Locking Layout holds role and crop. Its
 * role is one of: full-bleed ground; inside the graphic box (with the composition's tilt or quarter turn); cut into a
 * disc, a column or a band. Its scale runs from fitting (covering the box) to 2.5 times, its offset anywhere that keeps
 * the box covered. `photo.place` (Advanced, and New crop) pins any of them.
 */
import { contrast, luminance, needRatio, toHex } from './colour';
import { bounds, contains, overlaps, pad, rectQuad, unapply, xfQuad, type Quad, type Rect, type Xf } from './geom';
import { haloOf, inkOf, lowContrast } from './invariants';
import { mix, rng, type Rng } from './rng';
import type { GraphicItem, Item, Scene, TextItem } from './scene';
import type { Spec } from './spec';
import { mkRect } from './items';
import { PHOTO_ANY } from '../data/palettes/system';

export const PHOTO_ROLES = ['ground', 'box', 'disc', 'column', 'band'] as const;
export type PhotoRole = (typeof PHOTO_ROLES)[number];
/** What Advanced (and New crop) pins: absent fields are the layout stream's. `crop` reseeds the crop alone. */
export interface PhotoPlace { role?: PhotoRole; scale?: number; x?: number; y?: number; crop?: number; }
export interface PhotoSpec { id: string; treatment: string | null; place: PhotoPlace | null; }

/** The scale range of spec 8.9: from fitting the box to 2.5 times. */
export const SCALE_MIN = 1, SCALE_MAX = 2.5;
/** The long edge a photo is scaled to on import, at most (spec 8.9). */
export const LONG_EDGE = 5000;
/** The long edge of the picture the contrast grid is read from, and the grid cell in its pixels. */
export const GRID_EDGE = 1024, GRID_CELL = 8;
/** Measured contrast must clear the ratio of spec 5 by this factor: the grid is read from a smaller copy of the photo. */
export const MEASURE_MARGIN = 1.15;
/** What a photo can show anywhere, for every check that does not measure it: no ink passes against all three. */
export const ANY_COLOUR = PHOTO_ANY;

/** The darkest and lightest pixel of each cell, rgb triples, row by row. */
export interface Grid { cols: number; rows: number; lo: Uint8ClampedArray; hi: Uint8ClampedArray; }
export interface PhotoData { id: string; w: number; h: number; grid: Grid; img?: CanvasImageSource; }

const registry = new Map<string, PhotoData>();
export const registerPhoto = (p: PhotoData) => { registry.set(p.id, p); };
export const photoOf = (id: string | null | undefined): PhotoData | undefined => (id ? registry.get(id) : undefined);
export const forgetPhoto = (id: string) => { registry.delete(id); };

const lum8 = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The grid of an RGBA picture w x h: per cell of `cell` px, its darkest and lightest pixel. Pure. */
export function gridOf(px: Uint8ClampedArray | Uint8Array, w: number, h: number, cell = GRID_CELL): Grid {
  const cols = Math.max(1, Math.ceil(w / cell)), rows = Math.max(1, Math.ceil(h / cell));
  const lo = new Uint8ClampedArray(cols * rows * 3), hi = new Uint8ClampedArray(cols * rows * 3);
  const lv = new Float32Array(cols * rows).fill(Infinity), hv = new Float32Array(cols * rows).fill(-Infinity);
  for (let y = 0; y < h; y++) {
    const gy = Math.floor(y / cell);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, k = gy * cols + Math.floor(x / cell);
      const L = lum8(px[i], px[i + 1], px[i + 2]);
      if (L < lv[k]) { lv[k] = L; lo[k * 3] = px[i]; lo[k * 3 + 1] = px[i + 1]; lo[k * 3 + 2] = px[i + 2]; }
      if (L > hv[k]) { hv[k] = L; hi[k * 3] = px[i]; hi[k * 3 + 1] = px[i + 1]; hi[k * 3 + 2] = px[i + 2]; }
    }
  }
  return { cols, rows, lo, hi };
}

/** The size a picture w x h is drawn at for the grid, long edge GRID_EDGE at most. */
export function gridSize(w: number, h: number): [number, number] {
  const k = Math.min(1, GRID_EDGE / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/** The size a photo is kept at: long edge LONG_EDGE at most (spec 8.9). */
export function keptSize(w: number, h: number): [number, number] {
  const k = Math.min(1, LONG_EDGE / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/**
 * Where a picture iw x ih is drawn so it covers box b (spec 8.9): scaled to cover, times `scale` (1 to 2.5), and
 * offset by x and y (0 to 1) across the room the scale leaves. Every value keeps the box covered. Pure.
 */
export function coverRect(b: Rect, iw: number, ih: number, scale: number, x: number, y: number): Rect {
  const s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale)), k = Math.max(b.w / iw, b.h / ih) * s;
  const w = iw * k, h = ih * k, cx = Math.max(0, Math.min(1, x)), cy = Math.max(0, Math.min(1, y));
  return { x: b.x - (w - b.w) * cx, y: b.y - (h - b.h) * cy, w, h };
}

/** The role, scale and offset of a design's photo: the layout stream's, each pinned by `place` where set. */
export function photoChoice(spec: Spec, roles: readonly PhotoRole[] = PHOTO_ROLES): { role: PhotoRole; scale: number; x: number; y: number; r: Rng } {
  const pl = spec.photo?.place ?? {};
  const rr = rng(mix(spec.seeds.layout, 0x9407));
  // the role: ground and the graphic box a little more often than each cut-in shape
  const w = roles.map((r) => (r === 'ground' || r === 'box' ? 1.5 : 1)), sum = w.reduce((a, b) => a + b, 0);
  let u = rr() * sum, role = roles[roles.length - 1];
  for (let i = 0; i < roles.length; i++) { if ((u -= w[i]) < 0) { role = roles[i]; break; } }
  const rc = rng(mix(mix(spec.seeds.layout, 0x9408), pl.crop ?? 0));
  // the scale leans toward fitting: most crops show most of the photo, some go close in
  const s0 = rc(), x0 = rc(), y0 = rc();
  return {
    role: pl.role && (PHOTO_ROLES as readonly string[]).includes(pl.role) ? pl.role : role,
    scale: typeof pl.scale === 'number' ? pl.scale : SCALE_MIN + (SCALE_MAX - SCALE_MIN) * s0 * s0,
    x: typeof pl.x === 'number' ? pl.x : x0,
    y: typeof pl.y === 'number' ? pl.y : y0,
    r: rng(mix(mix(spec.seeds.layout, 0x9409), pl.crop ?? 0)),
  };
}

/** The colours of the photo under a world quad: its darkest and lightest grid pixels there, or null if it is not all inside the photo's clip. */
export function measureUnder(p: PhotoData, g: GraphicItem, q: Quad): { lo: string; hi: string } | null {
  const F = g.frame, local = F ? q.map((pt) => unapply(F, pt)) : q, b = g.box;
  if (g.cut === 'disc') {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2;
    if (!local.every(([x, y]) => Math.hypot(x - cx, y - cy) <= r)) return null;
  } else if (!contains(rectQuad(b), local)) return null;
  const d = { x: Number(g.params.x), y: Number(g.params.y), w: Number(g.params.w), h: Number(g.params.h) };
  const B = bounds(local), G = p.grid;
  const c0 = Math.max(0, Math.floor(((B.x - d.x) / d.w) * G.cols)), c1 = Math.min(G.cols - 1, Math.floor(((B.x + B.w - d.x) / d.w) * G.cols));
  const r0 = Math.max(0, Math.floor(((B.y - d.y) / d.h) * G.rows)), r1 = Math.min(G.rows - 1, Math.floor(((B.y + B.h - d.y) / d.h) * G.rows));
  if (c1 < c0 || r1 < r0) return null;
  let lv = Infinity, hv = -Infinity, lo = 0, hi = 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const k = (r * G.cols + c) * 3;
    const a = lum8(G.lo[k], G.lo[k + 1], G.lo[k + 2]), z = lum8(G.hi[k], G.hi[k + 1], G.hi[k + 2]);
    if (a < lv) { lv = a; lo = k; }
    if (z > hv) { hv = z; hi = k; }
  }
  return { lo: toHex([G.lo[lo], G.lo[lo + 1], G.lo[lo + 2]]), hi: toHex([G.hi[hi], G.hi[hi + 1], G.hi[hi + 2]]) };
}

/** The box a cut-in shape takes inside a host box (spec 8.9: a disc, a column or a band), from the photo stream. */
function cutBox(role: 'disc' | 'column' | 'band', H: Rect, r: Rng): Rect {
  if (role === 'disc') {
    const d = Math.min(H.w, H.h) * (0.55 + 0.4 * r());
    return { x: H.x + (H.w - d) * r(), y: H.y + (H.h - d) * r(), w: d, h: d };
  }
  if (role === 'column') {
    const w = H.w * (0.22 + 0.2 * r());
    return { x: H.x + (H.w - w) * r(), y: H.y, w, h: H.h };
  }
  const h = H.h * (0.18 + 0.17 * r());
  return { x: H.x, y: H.y + (H.h - h) * r(), w: H.w, h };
}

/** Where the photo goes in one candidate: the box (local to `frame`), its clip, its layer and where it sits in the items. */
export interface PhotoSpot { role: PhotoRole; box: Rect; frame?: Xf; cut?: 'rect' | 'disc'; layer: 'ground' | 'back' | 'front'; at: number; }

/**
 * Where the photo sits among the items under the text: `ground` full-bleed over the ground layer (and over a field that covers the canvas), never transformed;
 * `box` in the design's first graphic's box, its clip and its frame (tilted or turned with the composition), drawn
 * over that graphic so the graphics cut into it still show; a cut-in shape inside the layout's graphic box (else the
 * first graphic's, else the page), over every graphic. A box under 6% of the canvas is too small to carry a photo:
 * `box` then takes a disc in the page.
 */
export function photoSpot(role: PhotoRole, below: Item[], nGround: number, W: number, H: number, page: Rect, xf: Xf | undefined, graphicBox: Rect | undefined, r: Rng): PhotoSpot {
  if (role === 'ground') {
    // over a field of colour that covers the whole canvas (a Swiss full field), which would hide it entirely
    const all = rectQuad({ x: 0, y: 0, w: W, h: H });
    let at = nGround;
    for (let j = nGround; j < below.length; j++) if (below[j].kind === 'rect' && contains(below[j].quad, all)) at = j + 1;
    return { role, box: { x: 0, y: 0, w: W, h: H }, layer: 'ground', at };
  }
  const gs = below.map((it, i) => [it, i] as const).filter(([it]) => it.kind === 'graphic' && it.layer !== 'ground' && !it.pass) as [GraphicItem, number][];
  const first = gs.find(([g]) => g.lead) ?? gs[0];
  const big = (b: Rect) => b.w * b.h >= 0.06 * W * H && Math.min(b.w, b.h) >= 0.18 * W;
  if (role === 'box' && first && big(first[0].box)) {
    const [g, i] = first;
    return { role, box: g.box, frame: g.frame, cut: g.cut === 'disc' ? 'disc' : 'rect', layer: 'back', at: i + 1 };
  }
  const host: { b: Rect; f?: Xf } = graphicBox && big(graphicBox) ? { b: graphicBox, f: xf } : first && big(first[0].box) ? { b: first[0].box, f: first[0].frame } : { b: page, f: xf };
  const shape = role === 'box' ? 'disc' : role;
  return { role, box: cutBox(shape, host.b, r), frame: host.f, cut: shape === 'disc' ? 'disc' : 'rect', layer: 'front', at: below.length };
}

/** The photo as a Scene item: drawn by the `photo` graphic, its picture placed to cover its box. */
export function photoItem(p: PhotoData, s: PhotoSpot, scale: number, x: number, y: number, ground: string): GraphicItem {
  const d = coverRect(s.box, p.w, p.h, scale, x, y);
  const quad = xfQuad(s.frame, rectQuad(s.box));
  return {
    kind: 'graphic', name: 'photo', box: s.box, seed: 0, skip: 0, colours: { missing: ground },
    params: { id: p.id, x: d.x, y: d.y, w: d.w, h: d.h, role: s.role, scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale)) },
    fills: [...ANY_COLOUR], quad, ...(s.frame ? { frame: s.frame } : {}), cut: s.cut ?? 'rect', layer: s.layer, tag: 'photo', regions: [],
  };
}

/** A plate under text item t, in its own orientation, a little larger than its ink. */
export function plateUnder(t: TextItem, fill: string, d = Math.max(6, t.size * 0.16)) {
  if (!t.xf) return mkRect(pad(bounds(t.quad), d), fill, { plate: true });
  const local: Quad = t.quad.map((p) => unapply(t.xf!, p));
  return mkRect(pad(bounds(local), d), fill, { xf: t.xf, plate: true });
}

/**
 * Text over the photo (spec 8.9): where the measured contrast against the photo's pixels under a text item passes
 * (by MEASURE_MARGIN, its ink lighter or darker than every pixel there), the photo records what it shows there; else
 * the text gets a plate (a scrim) of the design colour that reads best with its ink, under every text item. Repeated
 * until nothing more is added, since a plate may sit under a neighbour too. Returns false if some text over the photo
 * still fails: the candidate fails. `items` is changed in place.
 */
export function photoText(items: Item[], at: number, plateAt: number, p: PhotoData, colours: string[], W: number, H: number, ground: string, format: string): boolean {
  const g = items[at] as GraphicItem;
  const sc = { w: W, h: H, format, ground, items } as Scene;
  // measured: each text item the photo shows behind, wholly inside its clip, ink outside the pixels' range
  const regions: { quad: Quad; fills: string[] }[] = [];
  for (let i = at + 1; i < items.length; i++) {
    const t = items[i];
    if (t.kind !== 'text' || haloOf(t) || !overlaps(g.quad, t.quad)) continue;
    const q = rectQuad(pad(bounds(t.quad), 3));
    const m = measureUnder(p, g, q);
    if (!m) continue;
    const need = needRatio(t.px) * MEASURE_MARGIN, lo = luminance(m.lo), hi = luminance(m.hi);
    const ok = inkOf(t).every((c) => { const L = luminance(c); return (L < lo || L > hi) && contrast(c, m.lo) >= need && contrast(c, m.hi) >= need; });
    if (ok) regions.push({ quad: q, fills: [m.lo, m.hi] });
  }
  g.regions = regions;
  const plated = new Set<TextItem>();
  for (let pass = 0; pass < 4; pass++) {
    let added = false;
    for (let i = at + 1; i < items.length; i++) {
      const t = items[i];
      if (t.kind !== 'text' || plated.has(t) || t.waive?.includes(4) || !overlaps(g.quad, t.quad) || !lowContrast(sc, i)) continue;
      // the design colour that reads best with every ink of the text
      let best = colours[0], score = -1;
      for (const c of colours) { const s = Math.min(...inkOf(t).map((k) => contrast(k, c))); if (s > score + 1e-9) { score = s; best = c; } }
      items.splice(plateAt, 0, plateUnder(t, best));
      plated.add(t);
      added = true;
      i++;
    }
    if (!added) break;
  }
  for (let i = at + 1; i < items.length; i++) if (items[i].kind === 'text' && !(items[i] as TextItem).waive?.includes(4) && lowContrast(sc, i)) return false;
  return true;
}

/**
 * A test photo for the proofs (spec 9.4: "with a test photo"), drawn from a seed: a sky gradient, a bright sun, dark
 * hills, a mid-tone field with fine stripes and seeded speckle, so text over it meets light, dark and busy pixels.
 * RGBA, w x h. Pure.
 */
export function testPicture(w: number, h: number, seed = 1): Uint8ClampedArray {
  const r = rng(seed), out = new Uint8ClampedArray(w * h * 4);
  const sx = w * (0.25 + 0.5 * r()), sy = h * (0.15 + 0.2 * r()), sr = Math.min(w, h) * (0.08 + 0.08 * r());
  const ph = r() * 6.28, amp = h * (0.05 + 0.08 * r()), base = h * (0.5 + 0.15 * r());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, t = y / h;
    let c: [number, number, number] = [40 + 150 * t, 90 + 120 * t, 200 - 40 * t];
    if (Math.hypot(x - sx, y - sy) < sr) c = [255, 236, 180];
    const hill = base + amp * Math.sin((x / w) * 9 + ph);
    if (y > hill) c = [20 + 30 * Math.sin(x * 0.05), 40, 30];
    if (y > base + amp * 1.6) c = (Math.floor(x / 6) + Math.floor(y / 40)) % 2 ? [150, 120, 70] : [110, 90, 50];
    const n = (r() - 0.5) * 40;
    out[i] = c[0] + n; out[i + 1] = c[1] + n; out[i + 2] = c[2] + n; out[i + 3] = 255;
  }
  return out;
}

/** A registered test photo (no picture: layout only) for the unit tests and the tools. */
export function testPhoto(id: string, w: number, h: number, seed = 1): PhotoData {
  const [gw, gh] = gridSize(w, h);
  return { id, w, h, grid: gridOf(testPicture(gw, gh, seed), gw, gh) };
}
