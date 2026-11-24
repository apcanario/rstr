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
import { chooseParams, clampTo } from '../../graphics/params';
import { mkGraphic } from '../../items';
import { mix, pick } from '../../rng';
import type { Item } from '../../scene';
import type { GraphicsPart } from '../types';

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

/** Everything Brutalist graphics decides, in stream order, before any item is made: pure on the graphic stream. */
export function brutalDraw(spec: { pick: { motif: string | null }; params: Record<string, unknown> }, P: Form, rg: () => number, band: Rect): BrutalDraw {
  const first = spec.pick.motif && BRUTAL_GRAPHICS.includes(spec.pick.motif) ? spec.pick.motif : pick(rg, BRUTAL_GRAPHICS);
  const up = rg();
  // reversed out of a plate of ink or accent, about one roll in four
  const plate: Role | null = up < 0.13 ? 'ink' : up < 0.26 ? 'accent' : null;
  const params = heavyParams(first, spec.params, rg);
  const u = rg(), set = spec.params['graphics.cut'];
  const drawn = typeof set === 'number' ? Math.max(0, Math.min(2, Math.round(set))) : u < 0.1 ? 2 : u < 0.62 ? 1 : 0;
  const under = plate ? P[plate] : P.ground;
  const roles = (['accent', 'ink', 'ground'] as Role[]).filter((r) => P[r] !== under);
  const cuts: BrutalCut[] = [];
  const used = new Set([first]), shapes = new Set<string>();
  const { x, y, w, h } = band;
  for (let k = 0; k < drawn; k++) {
    const name = pick(rg, BRUTAL_GRAPHICS.filter((n) => !used.has(n)));
    used.add(name);
    const shape = pick(rg, BRUTAL_CUTS.filter((s) => !shapes.has(s) && !(s === 'disc' && name === 'disc')));
    shapes.add(shape);
    const role = pick(rg, roles.length ? roles : (['accent', 'ink', 'ground'] as Role[]));
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
    cuts.push({ name, shape, role, box, params: heavyParams(name, spec.params, rg) });
  }
  return { first, plate, params, box: band, cuts };
}

export const brutalGraphics: GraphicsPart = {
  id: 'brutal', uses: BRUTAL_GRAPHICS, vocab: BRUTAL_GRAPHICS, motifs: BRUTAL_GRAPHICS,
  place(c, plan) {
    const { spec, P, W } = c, band = plan.boxes.graphic;
    if (!band) return [];
    const d = brutalDraw(spec, P, c.rg, band);
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
