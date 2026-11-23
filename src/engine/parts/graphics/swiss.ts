/**
 * Swiss graphics (spec 8.0, 8.1): the first graphic fills the box layout gave it, its parameters drawn across
 * their whole ranges; about six rolls in ten cut a second graphic into it (a disc, a column, a band, or inside
 * a block), on a plate of ground, ink or accent; about one in ten adds a third. Everything from the graphic
 * stream, so it never moves text.
 */
import type { Form } from '../../../data/palettes/types';
import type { Rect } from '../../geom';
import { GRAPHICS } from '../../graphics';
import { blockCells } from '../../graphics/blocks';
import { chooseParams } from '../../graphics/params';
import { mkGraphic } from '../../items';
import { mix, pick } from '../../rng';
import type { GraphicItem } from '../../scene';
import type { GraphicsPart } from '../types';

export const SWISS_GRAPHICS = ['topo', 'blocks', 'bars', 'dots', 'disc', 'lines'];
/** Graphics that read as a field, so they may be drawn reversed out of a plate. */
const FIELDS = ['topo', 'dots', 'lines', 'bars'];
export const CUTS = ['disc', 'column', 'band', 'block'] as const;
type Role = 'accent' | 'ink' | 'ground';

/** The graphic's three colours on a plate of one role: a loud colour, a second mark colour and the colour it cuts with. */
function coloursOn(P: Form, plate: Role | null): Record<string, string> {
  const g = plate ? P[plate] : P.ground;
  const a = [P.accent, P.ink, P.ground].find((x) => x !== g) ?? P.ink;
  return { a, ink: [P.ink, P.ground, P.accent].find((x) => x !== g && x !== a) ?? a, bg: g };
}
const fillsOf = (C: Record<string, string>, plate?: string) => [...new Set([...Object.values(C), ...(plate ? [plate] : [])])];

export const swissGraphics: GraphicsPart = {
  id: 'swiss', uses: SWISS_GRAPHICS, vocab: SWISS_GRAPHICS, motifs: SWISS_GRAPHICS,
  place(c, plan) {
    const { spec, P, W, rg } = c, MR = plan.boxes.graphic, mod = Number(plan.vals.mod);
    if (!MR) return [];
    // each placed graphic draws at paint time from a stream of its own
    const seed = (k: number) => mix(spec.seeds.graphic, 101 + k);
    const first = spec.pick.motif && SWISS_GRAPHICS.includes(spec.pick.motif) ? spec.pick.motif : pick(rg, SWISS_GRAPHICS);
    const reversed = rg() < 0.3 && FIELDS.includes(first);
    const p1 = chooseParams(GRAPHICS[first], spec.params, rg);
    const C1 = reversed ? coloursOn(P, 'accent') : { a: P.accent, ink: P.ink, bg: P.ground };
    const plate1 = reversed ? P.accent : undefined;
    const g1 = mkGraphic(first, MR, seed(0), 0, C1, fillsOf(C1, plate1), { W, mod, ...p1 });
    if (plate1) g1.plate = plate1;
    g1.layer = 'back';
    const out: GraphicItem[] = [g1];
    // how many cut in: Advanced sets it, else the stream (about 6 in 10 one, 1 in 10 two)
    const u = rg(), set = spec.params['graphics.cut'];
    const cuts = typeof set === 'number' ? Math.max(0, Math.min(2, Math.round(set))) : u < 0.1 ? 2 : u < 0.62 ? 1 : 0;
    // the visible part of the first graphic's box: inside the page
    const pg = plan.page;
    const vx = Math.max(MR.x, pg.x), vy = Math.max(MR.y, pg.y);
    const V = { x: vx, y: vy, w: Math.min(MR.x + MR.w, pg.x + pg.w) - vx, h: Math.min(MR.y + MR.h, pg.y + pg.h) - vy };
    if (V.w < mod || V.h < mod) return out;
    const used = new Set([first]);
    const M = Number(plan.vals.M);
    for (let k = 0; k < cuts; k++) {
      const name = pick(rg, SWISS_GRAPHICS.filter((n) => !used.has(n)));
      used.add(name);
      const shapes = CUTS.filter((s) => s !== 'block' || (first === 'blocks' && k === 0));
      const shape = pick(rg, shapes), plateRole = pick(rg, ['accent', 'ink', 'ground'] as Role[]);
      const a = rg(), b = rg(), mm = Math.min(V.w, V.h);
      let box: Rect;
      if (shape === 'disc') {
        const r = mm * (0.18 + a * 0.3);
        box = { x: V.x + r + (V.w - 2 * r) * b, y: V.y + r + (V.h - 2 * r) * rg(), w: 0, h: 0 };
        box = { x: box.x - r, y: box.y - r, w: 2 * r, h: 2 * r };
      } else if (shape === 'column') {
        const cols = Math.max(1, Math.round((V.w - 2 * M) / mod)), cw = 1 + Math.floor(a * Math.min(3, cols));
        const c0 = Math.floor(b * Math.max(1, cols - cw + 1));
        box = { x: Math.max(V.x, M + c0 * mod), y: V.y, w: Math.min(cw * mod, V.x + V.w - Math.max(V.x, M + c0 * mod)), h: V.h };
      } else if (shape === 'band') {
        const h = Math.min(V.h, Math.max(mod, Math.round((V.h * (0.18 + a * 0.3)) / mod) * mod));
        box = { x: V.x, y: V.y + (V.h - h) * b, w: V.w, h };
      } else {
        const cells = blockCells(MR, { sx: p1.sx, sy: p1.sy, side: p1.side }, mod);
        box = cells.slice().sort((p, q) => q.w * q.h - p.w * p.h)[0];
      }
      const C = coloursOn(P, plateRole);
      const g = mkGraphic(name, box, seed(k + 1), 0, C, fillsOf(C, P[plateRole]), { W, mod, ...chooseParams(GRAPHICS[name], spec.params, rg) });
      g.cut = shape === 'disc' ? 'disc' : 'rect';
      g.plate = P[plateRole];
      g.layer = 'front';
      out.push(g);
    }
    return out;
  },
};
