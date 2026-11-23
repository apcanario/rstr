/**
 * Runs a style's five parts for one candidate: layout plans, ground and graphics draw under, type sets the text
 * on top, then graphics may read the finished Scene (knock-outs). Graphics and type work in the plan's local
 * page; here they are put on the canvas by the plan's transform. Ground is never transformed.
 */
import { compose, xfQuad, type Xf } from '../geom';
import type { Item } from '../scene';
import type { Parts, PartCtx, Plan } from '../parts/types';

export function place(it: Item, F: Xf | undefined): Item {
  if (!F) return it;
  if (it.kind === 'graphic') return { ...it, frame: compose(F, it.frame), quad: xfQuad(F, it.quad), avoid: it.avoid?.map((q) => xfQuad(F, q)) };
  if (it.kind === 'rect') return { ...it, xf: compose(F, it.xf), quad: xfQuad(F, it.quad), shadowQuad: it.shadowQuad && xfQuad(F, it.shadowQuad) };
  return { ...it, xf: compose(F, it.xf), quad: xfQuad(F, it.quad) };
}

export function compose5(parts: Parts, c: PartCtx): { items: Item[]; plan: Plan } | null {
  const plan = parts.layout.plan(c);
  if (!plan) return null;
  const ground = parts.ground.ground(c, plan);
  const below = [...ground, ...parts.graphics.place(c, plan).map((i) => place(i, plan.xf))];
  const text = parts.type.set(c, plan, below);
  if (!text) return null;
  const items = [...below, ...text.map((i) => place(i, plan.xf))];
  parts.graphics.after?.(c, plan, items);
  return { items, plan };
}
