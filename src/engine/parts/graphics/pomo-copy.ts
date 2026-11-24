/**
 * Postmodern photocopy graphics (spec 8.2): four to six found graphics under everything, as the spike's `grunge`
 * chose them: halftone disc, ink slab, scribble, tape strips, X marks, faint contours, line blocks, torn edge,
 * registration marks, a redacted bar. Each is opaque, in the toner, the spot colour, or a mix of paper and toner
 * (faint contours, tape), so the pixels behind any text are colours the Scene declares. The big ones gather in the
 * layout's graphic box; marks go anywhere. After the type is set, every graphic keeps off the caption (its fading
 * copies sit on bare paper); the title words carry their paper edge and the other slots sit on paper plates.
 */
import { mixHex } from '../../colour';
import { GRAPHICS } from '../../graphics';
import { FOUND } from '../../graphics/found';
import { chooseParams } from '../../graphics/params';
import { pad, rectQuad, xfQuad, type Rect, type Xf } from '../../geom';
import { mkGraphic } from '../../items';
import { shuffle } from '../../rng';
import type { GraphicItem, Item } from '../../scene';
import type { PartCtx, Plan } from '../types';

/** One found graphic in a rotated frame: box and clip in its own frame, quad on the page. */
function framed(c: PartCtx, name: string, box: Rect, at: Xf | undefined, colours: Record<string, string>, extra: Record<string, number | string | boolean> = {}): GraphicItem {
  const { W, spec, rg } = c;
  const params = { ...chooseParams(GRAPHICS[name], spec.params, rg), W, ...extra };
  const g = mkGraphic(name, box, spec.seeds.graphic, rg.n, colours, [...new Set(Object.values(colours))], params);
  // the item draws from the graphic stream where placement stopped; skip past what the draw may take
  for (let i = 0; i < 400; i++) rg();
  if (at) { g.frame = at; g.quad = xfQuad(at, rectQuad(box)); }
  g.layer = 'back';
  return g;
}

export function copyGraphics(c: PartCtx, plan: Plan): Item[] {
  const { W, P, spec, rg } = c, pg = plan.page, gb = plan.boxes.graphic ?? pg;
  const paper = P.paper ?? P.ground, toner = P.toner ?? P.ink, spot = P.spot ?? toner;
  const pickC = () => (rg() < 0.35 ? spot : toner);
  const faint = mixHex(paper, toner, 0.42), tapeC = mixHex(paper, spot === toner ? toner : spot, 0.32);
  const kinds = shuffle(rg, [...FOUND]);
  const motif = FOUND.includes(spec.pick.motif ?? '') ? spec.pick.motif! : null;
  if (motif) { kinds.splice(kinds.indexOf(motif), 1); kinds.unshift(motif); }
  const n = 4 + Math.floor(rg() * 3);
  const inG = () => ({ x: gb.x + rg() * gb.w, y: gb.y + rg() * gb.h });
  const out: GraphicItem[] = [];
  for (const k of kinds.slice(0, n)) {
    switch (k) {
      case 'dots': {
        const r = W * (0.16 + rg() * 0.16), p = inG();
        const g = framed(c, 'dots', { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }, undefined, { a: pickC() });
        g.cut = 'disc';
        out.push(g);
        break;
      }
      case 'slab': {
        const w = W * (0.4 + rg() * 0.55), h = W * (0.08 + rg() * 0.16), p = inG(), rot = (rg() - 0.5) * 0.5;
        out.push(framed(c, 'slab', { x: -w / 2, y: -h / 2, w, h }, { x: p.x, y: p.y, rot }, { accent: pickC(), ink: paper }));
        break;
      }
      case 'scribble': {
        const s = W * (0.35 + rg() * 0.3), p = inG();
        out.push(framed(c, 'scribble', { x: p.x - s / 2, y: p.y - s / 2, w: s, h: s }, undefined, { a: rg() < 0.4 ? spot : toner }));
        break;
      }
      case 'tape': out.push(framed(c, 'tape', { ...pg }, undefined, { a: tapeC })); break;
      case 'xmarks': out.push(framed(c, 'xmarks', { x: pg.x + W * 0.03, y: pg.y + W * 0.03, w: pg.w - W * 0.06, h: pg.h - W * 0.06 }, undefined, { a: toner })); break;
      case 'topo': {
        const h = pg.h * (0.45 + rg() * 0.3), y = pg.y + rg() * (pg.h - h);
        out.push(framed(c, 'topo', { x: pg.x - 2, y, w: pg.w + 4, h }, undefined, { ink: faint, a: toner }));
        break;
      }
      case 'lines': {
        const w = W * (0.3 + rg() * 0.45), h = W * (0.15 + rg() * 0.3), p = inG(), rot = (rg() - 0.5) * 0.3;
        out.push(framed(c, 'lines', { x: -w / 2, y: -h / 2, w, h }, { x: p.x, y: p.y, rot }, { a: toner, ink: spot }));
        break;
      }
      case 'torn': {
        const w = W * (0.45 + rg() * 0.5), h = pg.h * (0.16 + rg() * 0.2), p = inG(), rot = (rg() - 0.5) * 0.2;
        out.push(framed(c, 'torn', { x: -w / 2, y: -h / 2, w, h }, { x: p.x, y: p.y, rot }, { a: rg() < 0.5 ? spot : toner }));
        break;
      }
      case 'register': out.push(framed(c, 'register', { x: pg.x + W * 0.02, y: pg.y + W * 0.02, w: pg.w - W * 0.04, h: pg.h - W * 0.04 }, undefined, { a: toner })); break;
      default: {
        const w = W * (0.35 + rg() * 0.45), h = W * 0.3, p = inG();
        out.push(framed(c, 'redact', { x: Math.max(pg.x, p.x - w / 2), y: p.y - h / 2, w, h }, undefined, { a: toner }));
      }
    }
  }
  return out;
}

/** Every graphic keeps off the caption's copies: they fade towards the paper and sit on nothing else. */
export function copyAfter(c: PartCtx, _plan: Plan, items: Item[]) {
  const caps = items.filter((i) => i.kind === 'text' && i.slot === 'caption').map((i) => xfQuad(undefined, i.quad));
  if (!caps.length) return;
  const padded = caps.map((q) => {
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    return rectQuad(pad({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, c.W * 0.008));
  });
  for (const it of items) {
    if (it.kind !== 'graphic' || it.pass || it.layer === 'ground') continue;
    it.avoid = [...(it.avoid ?? []), ...padded];
  }
}
