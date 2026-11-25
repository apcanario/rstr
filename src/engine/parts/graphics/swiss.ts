/**
 * Swiss graphics (spec 8.0, 8.1): the field of colour where the layout gives one, then the first graphic in the
 * box layout gave it, its parameters drawn across their whole ranges; about six rolls in ten cut a second graphic
 * into it (a disc, a column, a band, or inside a block), on a plate of ground, ink or accent; about one in ten
 * adds a third. Everything from the graphic stream, so it never moves text.
 *
 * Rules from the tuning pass (docs/tuning-R5.md): a cut-in never sits under the text panel (review R13 item 3);
 * a shape (disc, numeral, blocks, crosshairs) under a full-bleed panel is placed in the part the panel leaves
 * free, on an accent plate; a band keeps a module clear of the panel; crosshairs keep their marks off a disc
 * cut-in; the disc is never cut into a disc (it would be clipped flat, review bundle 1 S2); a
 * cut-in's plate is never the colour the first graphic sits on (it would only erase it); a shape stands in front
 * of its cut-ins; a column or band covers at most 60% of the graphic; blocks with a disc cut in draw no disc of
 * their own (review R5 S6); blocks in a box over a third of the page fill two cells or more (review R5 M5).
 */
import type { Form } from '../../../data/palettes/types';
import type { Rect } from '../../geom';
import { GRAPHICS } from '../../graphics';
import { FILLS, blockCells } from '../../graphics/blocks';
import { discGeom } from '../../graphics/disc';
import { chooseParams, paramKey } from '../../graphics/params';
import { mkGraphic, mkRect } from '../../items';
import { mix, pick } from '../../rng';
import type { Item } from '../../scene';
import { fieldColour } from '../shared/field';
import type { GraphicsPart, PartCtx, Plan } from '../types';
import { cutControl, libraryControls, motifPicker } from '../../controls';

export const SWISS_GRAPHICS = ['topo', 'blocks', 'bars', 'dots', 'disc', 'lines', 'rules', 'numeral', 'crosshairs', 'lattice', 'rings', 'waves'];
/** Graphics that read as a field, so they may be drawn reversed out of a plate (shapes are, beside a panel). */
const FIELDS = ['topo', 'dots', 'lines', 'bars', 'rules', 'lattice', 'rings', 'waves'];
/** Graphics that read as one shape: under a panel they go where the panel leaves room. */
const SHAPES = ['disc', 'numeral', 'blocks', 'crosshairs'];
export const CUTS = ['disc', 'column', 'band', 'block'] as const;
type Role = 'accent' | 'ink' | 'ground';

/** The graphic's three colours on a plate of one colour: a loud colour, a second mark colour and the colour it cuts with. */
function coloursOnHex(P: Form, g: string): Record<string, string> {
  const a = [P.accent, P.ink, P.ground].find((x) => x !== g) ?? P.ink;
  return { a, ink: [P.ink, P.ground, P.accent].find((x) => x !== g && x !== a) ?? a, bg: g };
}
const coloursOn = (P: Form, plate: Role | null) => coloursOnHex(P, plate ? P[plate] : P.ground);
const fillsOf = (C: Record<string, string>, plate?: string) => [...new Set([...Object.values(C), ...(plate ? [plate] : [])])];

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);
const clip = (r: Rect, b: Rect): Rect => {
  const x = Math.max(r.x, b.x), y = Math.max(r.y, b.y);
  return { x, y, w: Math.min(r.x + r.w, b.x + b.w) - x, h: Math.min(r.y + r.h, b.y + b.h) - y };
};
/** The largest part of V left free by B: above, below, left or right of it (V itself if they do not meet). */
export function freeOf(V: Rect, B?: Rect): Rect {
  if (!B) return V;
  const I = clip(V, B);
  if (I.w <= 0 || I.h <= 0) return V;
  const parts: Rect[] = [
    { x: V.x, y: V.y, w: V.w, h: I.y - V.y },
    { x: V.x, y: I.y + I.h, w: V.w, h: V.y + V.h - I.y - I.h },
    { x: V.x, y: V.y, w: I.x - V.x, h: V.h },
    { x: I.x + I.w, y: V.y, w: V.x + V.w - I.x - I.w, h: V.h },
  ];
  return parts.sort((p, q) => area(q) - area(p))[0];
}

type Shape = (typeof CUTS)[number];
/** One graphic cut into the first: which, its shape, the plate role it sits on, its box, its parameters. */
export interface Cut { name: string; shape: Shape; role: Role; box: Rect; params: Record<string, number>; }
/** Everything Swiss graphics decides, in stream order, before any item is made. */
export interface SwissDraw { first: string; reversed: boolean; params: Record<string, number>; box: Rect; /** cut-ins decided (0, 1 or 2) */ drawn: number; cuts: Cut[]; }

/**
 * The combination rule (spec 8.0, 8.1), pure on the graphic stream: the first graphic and its parameters,
 * whether it is reversed out of an accent plate, how many cut in, and each cut's graphic, shape, plate and box.
 * `block` is a cut shape only for the first cut into `blocks`. Null when the layout gave no graphic box.
 */
export function swissDraw(c: PartCtx, plan: Plan): SwissDraw | null {
  const { spec, rg } = c, MR0 = plan.boxes.graphic, mod = plan.module, M = plan.margin, panel = plan.boxes.panel;
  if (!MR0) return null;
  const first = spec.pick.motif && SWISS_GRAPHICS.includes(spec.pick.motif) ? spec.pick.motif : pick(rg, SWISS_GRAPHICS);
  // a shape beside a full-bleed panel sits on an accent plate, so the page is not left a field of bare ground (tuning)
  const reversed = (rg() < 0.3 && FIELDS.includes(first)) || (!!panel && SHAPES.includes(first));
  const p1 = chooseParams(GRAPHICS[first], spec.params, rg);
  // the visible part of the graphic's box: inside the page, and out of the text panel's rows or columns
  const pg = plan.page;
  const V = freeOf(clip(MR0, pg), panel);
  // a shape goes where the panel leaves room, out to the canvas edge the graphic's box reaches (a tilted page bleeds)
  const VB = freeOf(MR0, panel);
  const MR = panel && SHAPES.includes(first) && V.w >= mod && V.h >= mod ? VB : MR0;
  // blocks rolls only the patterns that fill two cells or more: one filled cell of three left the box mostly ground
  // (review R5 M5, which asked this for boxes over a third of the page; the tuning pass found it in smaller boxes
  // too); the single fills stay for pins and Advanced
  if (first === 'blocks' && typeof spec.params[paramKey('blocks', 'fill')] !== 'number' && FILLS[p1.fill].filter(Boolean).length < 2) {
    const two = FILLS.map((f, i) => (f.filter(Boolean).length >= 2 ? i : -1)).filter((i) => i >= 0);
    p1.fill = two[p1.fill % two.length];
  }
  const out: SwissDraw = { first, reversed, params: p1, box: MR, drawn: 0, cuts: [] };
  // how many cut in: Advanced sets it, else the stream (about 6 in 10 one, 1 in 10 two)
  const u = rg(), set = spec.params['graphics.cut'];
  out.drawn = typeof set === 'number' ? Math.max(0, Math.min(2, Math.round(set))) : u < 0.1 ? 2 : u < 0.62 ? 1 : 0;
  if (V.w < mod || V.h < mod) return out;
  // the colour the first graphic sits on: a cut-in plate of that colour would only erase it, so it takes another
  const F = plan.boxes.field, fcx = MR.x + MR.w / 2, fcy = MR.y + MR.h / 2;
  const under = F && fcx >= F.x && fcx <= F.x + F.w && fcy >= F.y && fcy <= F.y + F.h ? fieldColour(c.P) : reversed ? c.P.accent : c.P.ground;
  const roles = (['accent', 'ink', 'ground'] as Role[]).filter((r) => c.P[r] !== under);
  const used = new Set([first]);
  for (let k = 0; k < out.drawn; k++) {
    const name = pick(rg, SWISS_GRAPHICS.filter((n) => !used.has(n)));
    used.add(name);
    const shapes = CUTS.filter((s) => (s !== 'block' || (first === 'blocks' && k === 0)) && (s !== 'disc' || name !== 'disc'));
    const shape = pick(rg, shapes), role = pick(rg, roles.length ? roles : (['accent', 'ink', 'ground'] as Role[]));
    const a = rg(), b = rg(), mm = Math.min(V.w, V.h);
    let box: Rect;
    if (shape === 'disc' && first === 'blocks') {
      // into blocks the disc goes where the blocks' own disc was, in the largest cell (review R5 S6: an eclipse
      // beside it read as a mistake, and with the blocks' disc gone the cell was left bare)
      let big = clip(blockCells(MR, { sx: p1.sx, sy: p1.sy, side: p1.side }, mod).sort((p, q) => q.w * q.h - p.w * p.h)[0], V);
      if (big.w < mod / 2 || big.h < mod / 2) big = V;
      const r = Math.min(big.w, big.h) * (0.3 + a * 0.15);
      rg();
      box = { x: big.x + big.w / 2 - r, y: big.y + big.h / 2 - r, w: 2 * r, h: 2 * r };
    } else if (shape === 'disc') {
      const r = mm * (0.18 + a * 0.3);
      box = { x: V.x + r + (V.w - 2 * r) * b, y: V.y + r + (V.h - 2 * r) * rg(), w: 0, h: 0 };
      box = { x: box.x - r, y: box.y - r, w: 2 * r, h: 2 * r };
    } else if (shape === 'column') {
      const cols = Math.max(1, Math.round((V.w - 2 * M) / mod)), cw = 1 + Math.floor(a * Math.min(3, cols));
      const c0 = Math.floor(b * Math.max(1, cols - cw + 1));
      const x = Math.max(V.x, M + c0 * mod);
      // never more than 60% of what shows of the first graphic, so the cut never hides it (tuning)
      box = { x, y: V.y, w: Math.max(mod * 0.5, Math.min(cw * mod, V.x + V.w - x, V.w * 0.6)), h: V.h };
    } else if (shape === 'band') {
      // a band keeps one module clear of a text panel above or below it, so no sliver of the first graphic is
      // left between them (review bundle 2 M1)
      let y0 = V.y, y1 = V.y + V.h;
      if (panel && panel.x < V.x + V.w && panel.x + panel.w > V.x) {
        if (panel.y >= V.y + V.h - 1 && y1 - y0 > 3 * mod) y1 -= mod;
        if (panel.y + panel.h <= V.y + 1 && y1 - y0 > 3 * mod) y0 += mod;
      }
      const h = Math.min((y1 - y0) * 0.6, Math.max(mod, Math.round(((y1 - y0) * (0.18 + a * 0.3)) / mod) * mod));
      box = { x: V.x, y: y0 + (y1 - y0 - h) * b, w: V.w, h };
    } else {
      const cells = blockCells(MR, { sx: p1.sx, sy: p1.sy, side: p1.side }, mod);
      box = clip(cells.slice().sort((p, q) => q.w * q.h - p.w * p.h)[0], V);
    }
    out.cuts.push({ name, shape, role, box, params: chooseParams(GRAPHICS[name], spec.params, rg) });
  }
  // a disc cut into blocks takes the place of the blocks' own disc (review R5 S6): the blocks draw none then
  if (first === 'blocks' && typeof spec.params[paramKey('blocks', 'disc')] !== 'number' && out.cuts.some((k) => k.shape === 'disc')) out.params.disc = 0;
  return out;
}

export const swissGraphics: GraphicsPart = {
  id: 'swiss', uses: SWISS_GRAPHICS, vocab: SWISS_GRAPHICS, motifs: SWISS_GRAPHICS,
  // spec 10.3 Graphic: the first graphic, how many cut into it, and the parameters of each graphic drawn
  controls: (q) => [motifPicker(SWISS_GRAPHICS, 'Graphic'), cutControl(), ...libraryControls(q, SWISS_GRAPHICS)],
  place(c, plan) {
    const { spec, P, W } = c, mod = plan.module;
    const out: Item[] = [];
    const F = plan.boxes.field, fc = F ? fieldColour(P) : null;
    if (F && fc) out.push(mkRect(F, fc));
    const d = swissDraw(c, plan);
    if (!d) return out;
    // a graphic whose box lies in the field is drawn in colours that show on it
    const cx = d.box.x + d.box.w / 2, cy = d.box.y + d.box.h / 2;
    const onField = !!F && !!fc && cx >= F.x && cx <= F.x + F.w && cy >= F.y && cy <= F.y + F.h;
    // each placed graphic draws at paint time from a stream of its own
    const seed = (k: number) => mix(spec.seeds.graphic, 101 + k);
    const rev = d.reversed && !onField;
    const C1 = onField ? coloursOnHex(P, fc!) : rev ? coloursOn(P, 'accent') : { a: P.accent, ink: P.ink, bg: P.ground };
    const plate1 = rev ? P.accent : undefined;
    // crosshairs in front of a disc keep their marks off it (review bundle 2 M4): a disc-shaped cut-in, or the
    // disc graphic cut in on a plate (where discGeom puts it, satellite included)
    const avoid: Record<string, number> = {};
    if (d.first === 'crosshairs') d.cuts.filter((k) => k.shape === 'disc' || k.name === 'disc').slice(0, 2).forEach((k, i) => {
      const g = k.shape === 'disc' ? null : discGeom(k.box, k.params as Parameters<typeof discGeom>[1]);
      avoid['avoidX' + i] = g ? g.cx : k.box.x + k.box.w / 2; avoid['avoidY' + i] = g ? g.cy : k.box.y + k.box.h / 2;
      avoid['avoidR' + i] = Math.min(k.box.w, k.box.h) * (g ? k.params.radius : 0.5);
    });
    const g1 = mkGraphic(d.first, d.box, seed(0), 0, C1, fillsOf(C1, plate1), { W, mod, ...d.params, ...avoid });
    if (plate1) g1.plate = plate1;
    g1.layer = 'back';
    // a shape (disc, numeral, crosshairs) stands in front of what is cut in, so a cut never hides it (tuning)
    const shapeFront = SHAPES.includes(d.first) && d.first !== 'blocks';
    const cuts: Item[] = [];
    d.cuts.forEach((cut, k) => {
      const C = coloursOn(P, cut.role);
      const g = mkGraphic(cut.name, cut.box, seed(k + 1), 0, C, fillsOf(C, P[cut.role]), { W, mod, ...cut.params });
      g.cut = cut.shape === 'disc' ? 'disc' : 'rect';
      g.plate = P[cut.role];
      g.layer = shapeFront ? 'back' : 'front';
      cuts.push(g);
    });
    if (shapeFront && cuts.length) g1.lead = true;
    if (shapeFront) out.push(...cuts, g1); else out.push(g1, ...cuts);
    return out;
  },
};
