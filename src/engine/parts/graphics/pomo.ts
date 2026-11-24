/**
 * Postmodern graphics (spec 8.2). Ice cream: five to eight of the thirteen shapes on a jittered lattice over the
 * whole page, each rotated, each with a hard ink shadow; every row of the lattice gets one before any row gets a
 * second, so no band of the page is left bare (bundle 1 M1: 3:4 left its lower 40% empty), and cells under the title
 * zone are taken last. In big-shape one huge shape sits behind the title. Photocopy: four to six found graphics
 * (pomo-copy.ts). Everything is drawn before the type: a shape or a found graphic never sits on top of text.
 */
import { GRAPHICS } from '../../graphics';
import { FOUND } from '../../graphics/found';
import { chooseParams } from '../../graphics/params';
import { SHAPE_NAMES, SHAPES } from '../../graphics/shape';
import { mkGraphic } from '../../items';
import { shuffle } from '../../rng';
import type { GraphicsPart, PartCtx, Plan } from '../types';
import { copyAfter, copyGraphics } from './pomo-copy';

function iceGraphics(c: PartCtx, plan: Plan) {
  const { W, spec, P, rg } = c, pg = plan.page;
  const d = W * 0.013;
  const A = { ink: P.ink, ground: P.ground, accent: P.accent, accent2: P.accent2 ?? P.accent, accent3: P.accent3 ?? P.ground };
  const pr = chooseParams(GRAPHICS.shape, spec.params);
  // an Advanced scale or spin moves the shape's reach; without one the extent is the spike's
  const reach = 0.55 * (pr.scale ?? 1) * (pr.spin ? 1.2 : 1), dd = d * (pr.shadow ?? 1);
  const gx = 3, gy = Math.max(3, Math.round((3 * pg.h) / pg.w + 0.25));
  const cw = pg.w / gx, ch = pg.h / gy;
  const tz = plan.boxes.title ?? plan.boxes.text;
  const under = (i: number, j: number) => {
    const x0 = Math.max(tz.x, i * cw), x1 = Math.min(tz.x + tz.w, (i + 1) * cw), y0 = Math.max(tz.y, j * ch), y1 = Math.min(tz.y + tz.h, (j + 1) * ch);
    return x1 > x0 && y1 > y0 && ((x1 - x0) * (y1 - y0)) / (cw * ch) > 0.5;
  };
  const count = 5 + Math.floor(rg() * 4);
  // one cell per row first (free cells before cells under the title), then the rest
  const rows = Array.from({ length: gy }, (_, j) => shuffle(rg, [0, 1, 2]).sort((a, b) => Number(under(a, j)) - Number(under(b, j))).map((i) => [i, j] as [number, number]));
  const first = shuffle(rg, rows.map((r) => r[0]));
  const rest = shuffle(rg, rows.flatMap((r) => r.slice(1))).sort((a, b) => Number(under(a[0], a[1])) - Number(under(b[0], b[1])));
  const cells = [...first, ...rest].slice(0, count);
  // a picked shape is drawn first
  const motif = SHAPE_NAMES.includes(spec.pick.motif ?? '') ? spec.pick.motif! : null;
  const big = plan.frame === 'big-shape';
  return cells.map((cell, k) => {
    // a tall page has more ground to fill: its shapes run larger (tuning pass, R6)
    let s = Math.min(cw, ch) * (0.7 + rg() * 0.55) * (c.story ? 1.25 : 1);
    let x = (cell[0] + 0.5 + (rg() - 0.5) * 0.5) * cw, y = (cell[1] + 0.5 + (rg() - 0.5) * 0.5) * ch;
    const rot = (rg() - 0.5) * 1.4;
    let name = SHAPE_NAMES[(Math.floor(rg() * SHAPE_NAMES.length) + k) % SHAPE_NAMES.length];
    if (k === 0 && motif) name = motif;
    if (k === 0 && big) { s = Math.min(pg.w, pg.h) * 0.78; x = tz.x + tz.w * 0.55; y = tz.y + tz.h * 0.5; }
    const params = SHAPES[name].choose(rg, A);
    const g = mkGraphic('shape', { x: 0, y: 0, w: pg.w, h: pg.h }, spec.seeds.graphic, 0, A, Object.values(A), { ...params, shape: name, s, d, k, ...pr },
      { xf: { x, y, rot }, extent: { x: -s * reach, y: -s * reach, w: s * reach * 2 + dd, h: s * reach * 2 + dd } });
    g.layer = k === 0 && big ? 'back' : 'front';
    g.tag = name;
    return g;
  });
}

export const pomoGraphics: GraphicsPart = {
  id: 'pomo', uses: ['shape', 'scribble', 'tape', 'xmarks', 'torn', 'register', 'redact', 'dots', 'slab', 'topo', 'lines'],
  vocab: [...SHAPE_NAMES, ...FOUND],
  vocabOf: { icecream: SHAPE_NAMES, photocopy: FOUND },
  motifs: [...FOUND, ...SHAPE_NAMES],
  pickFor: (g) => (g === 'shape' ? { dialect: 'icecream' } : FOUND.includes(g) ? { dialect: 'photocopy', motif: g } : {}),
  place(c, plan) {
    return plan.dialect === 'photocopy' ? copyGraphics(c, plan) : iceGraphics(c, plan);
  },
  after(c, plan, items) {
    if (plan.dialect === 'photocopy') copyAfter(c, plan, items);
  },
};
