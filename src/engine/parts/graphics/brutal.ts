/**
 * Brutalist graphics (spec 8.0, 8.3): blunt graphics in the band the layout leaves over: barcode stripes, an accent
 * slab with a disc, a row of asterisks, arrows, a huge numeral, and the shared library at its heaviest settings
 * (parameters drawn from the heavy end of their ranges). About six rolls in ten cut a second graphic into the first
 * (a disc, a column at one end, or a strip along it) on a plate of ink, accent or ground; about one in ten a third.
 * The first graphic is sometimes reversed out of a plate. Everything from the graphic stream, so it never moves text.
 */
import type { Form } from '../../../data/palettes/types';
import type { Rect } from '../../geom';
import { GRAPHICS } from '../../graphics';
import { numeralGeom } from '../../graphics/numeral';
import { chooseParams, clampTo } from '../../graphics/params';
import { mkGraphic } from '../../items';
import { mix, pick } from '../../rng';
import type { Item } from '../../scene';
import type { GraphicsPart } from '../types';
import { cutControls } from '../../controls';
import { pinnedCut } from './swiss';

export const BRUTAL_GRAPHICS = ['barcode', 'slab', 'asterisks', 'arrow', 'numeral', 'bars', 'lines', 'rules', 'dots', 'blocks', 'disc', 'lattice'];
export const BRUTAL_CUTS = ['disc', 'column', 'strip'] as const;
type Role = 'accent' | 'ink' | 'ground';

/**
 * The heavy end of each graphic's parameters (spec 8.3: the shared library at its heaviest): a drawn value u is
 * moved into the top 45% of the range (or the bottom 45% where low is heavy: fewer, thicker lines).
 */
const HEAVY: Record<string, Record<string, 'hi' | 'lo'>> = {
  barcode: { unit: 'hi', wide: 'hi' },
  asterisks: { weight: 'hi' },
  arrow: { weight: 'hi' },
  numeral: { weight: 'hi', scale: 'hi' },
  bars: { weight: 'hi', count: 'lo' },
  lines: { weight: 'hi', count: 'lo' },
  rules: { weight: 'hi', count: 'lo' },
  dots: { pitch: 'hi' },
  lattice: { weight: 'hi', filled: 'hi', cols: 'lo' },
  rings: { weight: 'hi', count: 'lo' },
};
function heavyParams(name: string, specParams: Record<string, unknown>, rg: () => number): Record<string, number> {
  const G = GRAPHICS[name], out = chooseParams(G, {}, rg), h = HEAVY[name] ?? {};
  for (const [k, end] of Object.entries(h)) {
    const R = G.params[k], t = (out[k] - R.min) / (R.max - R.min || 1);
    out[k] = clampTo(R, end === 'hi' ? R.min + (R.max - R.min) * (0.55 + 0.45 * t) : R.min + (R.max - R.min) * 0.45 * t);
  }
  // heavy asterisks stay asterisks: the arm's half-thickness at 0.14 to 0.24 of the radius and fewer arms the
  // thicker they are (arms x weight at most 0.7), so the arms never fill the star into a polygon (review R8 S4)
  if (name === 'asterisks') {
    const R = G.params.weight, t = (out.weight - R.min) / (R.max - R.min || 1);
    out.weight = 0.14 + 0.1 * Math.max(0, Math.min(1, (t - 0.55) / 0.45));
    out.arms = Math.max(G.params.arms.min, Math.min(out.arms, Math.floor(0.7 / out.weight)));
  }
  // Advanced values win (chooseParams without a stream returns only those)
  return { ...out, ...chooseParams(G, specParams) };
}

/** Colours of a graphic on a plate of one colour: ink and accent that show on it, and the plate itself. */
function coloursOn(P: Form, under: string): Record<string, string> {
  const ink = [P.ink, P.ground, P.accent].find((x) => x !== under) ?? P.ink;
  const a = [P.accent, P.ink, P.ground].find((x) => x !== under && x !== ink) ?? ink;
  return { ink, accent: a, a, bg: under };
}

export interface BrutalCut { name: string; shape: (typeof BRUTAL_CUTS)[number]; role: Role; box: Rect; params: Record<string, number>; }
export interface BrutalDraw { first: string; plate: Role | null; params: Record<string, number>; box: Rect; cuts: BrutalCut[]; }

/**
 * A huge numeral is huge (spec 8.3): its figure at least a quarter of the canvas width tall. Read at the heavy end's
 * smallest scale and thickest stroke (scale 0.91, weight 0.22: the smallest figure the heavy end can draw in the box),
 * so every figure drawn unpinned in a box that passes is at least that tall (review bundle 4 S2: in a band or a cut
 * of the band's height a numeral read as a few stray digits).
 */
export const NUMERAL_MIN = 0.25;
export const numeralHeight = (box: Rect, p: { weight: number; scale: number }): number => {
  const { u } = numeralGeom(box, { ...p, x: 0.5 });
  return u * (9.2 + p.weight * 10);
};
export const numeralFits = (box: Rect, W: number): boolean => numeralHeight(box, { weight: 0.22, scale: 0.91 }) >= W * NUMERAL_MIN - 1e-6;

/**
 * Everything Brutalist graphics decides, in stream order, before any item is made: pure on the graphic stream. `W`:
 * the canvas width (a numeral only where it is huge). `title`: the title's height; a band taller than the title takes
 * no cut-in unless Advanced asks for one, so a short title is not set under a pile of graphics (review bundle 4 S4).
 */
export function brutalDraw(spec: { pick: { motif: string | null }; params: Record<string, unknown> }, P: Form, rg: () => number, band: Rect, o: { W?: number; title?: number } = {}): BrutalDraw {
  const W = o.W ?? 1080, hand = !!spec.pick.motif && BRUTAL_GRAPHICS.includes(spec.pick.motif);
  let first = hand ? spec.pick.motif! : pick(rg, BRUTAL_GRAPHICS);
  // a numeral the band cannot hold huge gives way to another band graphic (one more draw, only then); a hand pick wins
  if (!hand && first === 'numeral' && !numeralFits(band, W)) first = pick(rg, BRUTAL_GRAPHICS.filter((n) => n !== 'numeral'));
  const up = rg();
  // reversed out of a plate of ink or accent, about one roll in four
  const plate: Role | null = up < 0.13 ? 'ink' : up < 0.26 ? 'accent' : null;
  const params = heavyParams(first, spec.params, rg);
  const u = rg(), set = spec.params['graphics.cut'], pin = pinnedCut(spec.params, first, BRUTAL_GRAPHICS, BRUTAL_CUTS);
  let drawn = typeof set === 'number' ? Math.max(0, Math.min(2, Math.round(set))) : u < 0.1 ? 2 : u < 0.62 ? 1 : 0;
  // a second graphic or a cut shape picked by hand (spec 10.3) is cut in: at least one, unless Advanced set none
  if ((pin.name || pin.shape) && typeof set !== 'number') drawn = Math.max(1, drawn);
  // a band taller than the title takes the first graphic alone, unless Advanced set the cut-ins or picked one (S4)
  if (o.title !== undefined && band.h > o.title && typeof set !== 'number' && !pin.name && !pin.shape) drawn = 0;
  const under = plate ? P[plate] : P.ground;
  // a cut's plate shows as a cut: never the first graphic's plate, nor the ink it is drawn in (every cut overlaps it;
  // review R8 S5: an ink disc cut into ink arrows read as one mass); else the accent
  const firstInk = coloursOn(P, under).ink;
  const roles = (['accent', 'ink', 'ground'] as Role[]).filter((r) => P[r] !== under && P[r] !== firstInk);
  const cuts: BrutalCut[] = [];
  const used = new Set([first]), shapes = new Set<string>();
  const { x, y, w, h } = band;
  for (let k = 0; k < drawn; k++) {
    let name = pick(rg, BRUTAL_GRAPHICS.filter((n) => !used.has(n)));
    // the first cut-in's graphic and shape picked by hand win (the stream is read as it would be, so nothing else moves)
    if (k === 0 && pin.name) name = pin.name;
    used.add(name);
    // a numeral is not cut in as a strip: a figure the strip's height reads as stray digits (review R8 M4)
    const legal = BRUTAL_CUTS.filter((s) => !shapes.has(s) && !(s === 'disc' && name === 'disc') && !(s === 'strip' && name === 'numeral'));
    let shape = pick(rg, legal);
    if (k === 0 && pin.shape && (legal as readonly string[]).includes(pin.shape)) shape = pin.shape as (typeof BRUTAL_CUTS)[number];
    shapes.add(shape);
    const role = pick(rg, roles.length ? roles : (['accent'] as Role[]));
    const a = rg(), b = rg();
    let box: Rect;
    if (shape === 'disc') {
      const r = Math.min(h, w) * (0.36 + 0.14 * a);
      box = { x: x + (w - 2 * r) * b, y: y + h / 2 - r, w: 2 * r, h: 2 * r };
    } else if (shape === 'column') {
      const cw = w * (0.22 + 0.2 * a);
      box = { x: b < 0.5 ? x : x + w - cw, y, w: cw, h };
    } else {
      const sh = h * (0.3 + 0.2 * a);
      box = { x, y: b < 0.5 ? y : y + h - sh, w, h: sh };
    }
    // a numeral cut in where its box cannot hold it huge gives way to another graphic (S2); the hand-picked second wins
    if (name === 'numeral' && !(k === 0 && pin.name) && !numeralFits(box, W)) {
      name = pick(rg, BRUTAL_GRAPHICS.filter((n) => !used.has(n) && n !== 'numeral' && !(shape === 'disc' && n === 'disc')));
      used.add(name);
    }
    cuts.push({ name, shape, role, box, params: heavyParams(name, spec.params, rg) });
  }
  return { first, plate, params, box: band, cuts };
}

export const brutalGraphics: GraphicsPart = {
  id: 'brutal', uses: BRUTAL_GRAPHICS, vocab: BRUTAL_GRAPHICS, motifs: BRUTAL_GRAPHICS,
  // spec 8.9 (R15): two colours and one accent (8.3): hard two-tone pictures, threshold first
  treatments: { allow: ['mono', 'threshold', 'halftone', 'dither', 'duotone'], favourite: 'threshold' },
  // spec 10.3 Graphic: the first graphic, how many cut into it, the second (the first cut-in) and how it is cut in,
  // and the parameters of each graphic drawn (a value set by hand wins over the heavy end); only the first graphic
  // where the design has no band (a picked one can still bring a band, review R10 S1)
  controls: (q) => cutControls(q, BRUTAL_GRAPHICS, BRUTAL_CUTS, () => BRUTAL_CUTS, { disc: 'Disc', column: 'Column', strip: 'Strip' }),
  place(c, plan) {
    const { spec, P, W } = c, band = plan.boxes.graphic;
    if (!band) return [];
    // the title's height (both halves of a split); up the edge the band stands beside the title, not under it
    const T = plan.titleUp ? 0 : [plan.boxes.title, plan.boxes.title2].reduce((a, b) => a + (b ? b.h : 0), 0);
    const d = brutalDraw(spec, P, c.rg, band, { W, title: T || undefined });
    const mod = (plan.page.w - 2 * plan.margin) / 6;
    const seed = (k: number) => mix(spec.seeds.graphic, 101 + k);
    const under = d.plate ? P[d.plate] : P.ground;
    const C1 = coloursOn(P, under);
    const g1 = mkGraphic(d.first, d.box, seed(0), 0, C1, [...new Set(Object.values(C1))], { W, mod, ...d.params });
    if (d.plate) g1.plate = P[d.plate];
    g1.layer = 'back';
    const out: Item[] = [g1];
    d.cuts.forEach((cut, k) => {
      const C = coloursOn(P, P[cut.role]);
      const g = mkGraphic(cut.name, cut.box, seed(k + 1), 0, C, [...new Set(Object.values(C))], { W, mod, ...cut.params });
      g.cut = cut.shape === 'disc' ? 'disc' : 'rect';
      g.plate = P[cut.role];
      g.layer = 'front';
      out.push(g);
    });
    return out;
  },
};
