/** Blocks of items built at the origin and then put in place (Postmodern type, either dialect). Pure. */
import { bounds, compose, union, xfQuad, type Rect, type Xf } from '../../geom';
import type { Item } from '../../scene';

/** Move items built at the origin by a rigid transform (a block put in its place). */
export function moveItems(items: Item[], G: Xf): Item[] {
  return items.map((it) => {
    if (it.kind === 'graphic') return it;
    if (it.kind === 'rect') return { ...it, xf: compose(G, it.xf) ?? G, quad: xfQuad(G, it.quad), shadowQuad: it.shadowQuad && xfQuad(G, it.shadowQuad) };
    return { ...it, xf: compose(G, it.xf) ?? G, quad: xfQuad(G, it.quad) };
  });
}
/** The bounding box of a block's quads, shadows included. */
export function boxOf(items: Item[]): Rect {
  const rs = items.flatMap((i) => [bounds(i.quad), ...(i.kind === 'rect' && i.shadowQuad ? [bounds(i.shadowQuad)] : [])]);
  return rs.length ? union(rs) : { x: 0, y: 0, w: 0, h: 0 };
}
