/**
 * Runs a style's five parts for one candidate: layout plans, ground and graphics draw under, type sets the text
 * on top, then graphics may read the finished Scene (knock-outs). Graphics and type work in the plan's local
 * page; here they are put on the canvas by the plan's transform. Ground is never transformed.
 */
import { compose, xfQuad, type Xf } from '../geom';
import type { Item } from '../scene';
import type { Parts, PartCtx, Plan } from '../parts/types';
import { photoChoice, photoItem, photoOf, photoSpot, photoText } from '../photo';
import { COLOUR_ROLES } from '../spec';

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
  // the photo (spec 8.9): placed by its own layout stream among the items under the text, which the type part set
  // without it; then text over it is measured against its pixels or gets a plate. After the graphics' after() (which
  // keeps knocked-out graphics off the type, so contrast is read as drawn); every text item then moves up by what was
  // inserted under it, and the knock-outs' glyph indices with it.
  const photo = photoOf(c.spec.photo?.id);
  if (photo) {
    const ch = photoChoice(c.spec), n0 = items.length;
    const spot = photoSpot(ch.role, below, ground.length, c.W, c.H, plan.page, plan.xf, plan.boxes.graphic, ch.r);
    items.splice(spot.at, 0, photoItem(photo, spot, ch.scale, ch.x, ch.y, c.P.ground));
    const colours = [...new Set(COLOUR_ROLES.map((k) => c.P[k as keyof typeof c.P]).filter((v): v is string => typeof v === 'string'))];
    const ok = photoText(items, spot.at, below.length + 1, photo, colours, c.W, c.H, c.P.ground, c.spec.format);
    const d = items.length - n0;
    for (const it of items) if (it.kind === 'graphic' && it.knock) it.knock = { ...it.knock, glyphs: it.knock.glyphs.map((i) => i + d) };
    if (!ok && !c.fallback) return null;
  }
  // the ground's surface pass goes over everything, type included (spec 8.2 copier pass); never transformed
  items.push(...(parts.ground.pass?.(c, plan, items) ?? []));
  return { items, plan };
}
