/**
 * Runs a style's five parts for one candidate: layout plans, ground and graphics draw under, type sets the text
 * on top, then graphics may read the finished Scene (knock-outs). Graphics and type work in the plan's local
 * page; here they are put on the canvas by the plan's transform. Ground is never transformed.
 */
import { compose, xfQuad, type Xf } from '../geom';
import type { GraphicItem, Item } from '../scene';
import type { Parts, PartCtx, Plan } from '../parts/types';
import { PHOTO_FLOOR, PHOTO_TRIES, photoChoice, photoItem, photoOf, photoShare, photoSpot, photoText } from '../photo';
import { COLOUR_ROLES, LEVEL_RANK, SLOT_LEVEL, SLOTS, extrasOf, flagWeight, hasContent, leadsOf } from '../spec';
import { placeLayers } from '../parts/shared/layers';
import { treatOf } from '../treat';

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
  let text = parts.type.set(c, plan, below);
  if (!text) return null;
  // text layers (spec 8.6): each slot's items draw the lead layer of its level; every other layer is set by the shared
  // placer in the room left (parts/shared/layers.ts)
  const leads = leadsOf(c.spec.text);
  for (const it of text) if (it.kind === 'text' && leads[it.slot]) it.lid = leads[it.slot]!.id;
  const extras = extrasOf(c.spec.text);
  if (extras.length) {
    let r = placeLayers(c, plan, below, text, parts.type, extras);
    // the lowest levels give way first (spec 8.6, review R17 S1): where a layer is flagged while the lead of a lower
    // level is drawn, the slots of the lower leads are set again without them and those leads placed after the
    // flagged layer, in what it leaves; the arrangement whose flags weigh least is kept
    const rank = (id: string) => LEVEL_RANK.indexOf(c.spec.text.find((l) => l.id === id)!.level);
    const hi = r.flagged.length ? Math.min(...r.flagged.map(rank)) : Infinity;
    const lower = SLOTS.filter((s) => leads[s] && hasContent(leads[s]!) && LEVEL_RANK.indexOf(SLOT_LEVEL[s]) > hi);
    if (lower.length) {
      const tx = { ...c.tx };
      for (const s of lower) tx[s] = { ...tx[s], on: false } as never;
      const c2 = { ...c, tx }, plan2 = { ...plan };
      const text2 = parts.type.set(c2, plan2, below);
      if (text2) {
        for (const it of text2) if (it.kind === 'text' && leads[it.slot]) it.lid = leads[it.slot]!.id;
        const r2 = placeLayers(c2, plan2, below, text2, parts.type, [...extras, ...lower.map((s) => leads[s]!)]);
        if (flagWeight(c.spec.text, r2.flagged) < flagWeight(c.spec.text, r.flagged)) { text = text2; r = r2; plan.inert = plan2.inert; }
      }
    }
    text.push(...r.items);
  }
  const items = [...below, ...text.map((i) => place(i, plan.xf))];
  parts.graphics.after?.(c, plan, items);
  // the photo (spec 8.9): placed by its own layout stream among the items under the text, which the type part set
  // without it; then text over it is measured against its pixels or gets a plate. After the graphics' after() (which
  // keeps knocked-out graphics off the type, so contrast is read as drawn); every text item then moves up by what was
  // inserted under it, and the knock-outs' glyph indices with it.
  const photo = photoOf(c.spec.photo?.id);
  if (photo) {
    const ch = photoChoice(c.spec), n0 = items.length;
    // its treatment (R15): the graphic stream's, from the style's list (the dialect's, where it has one)
    const treat = treatOf(c.spec, c.P, (plan.dialect && parts.graphics.treatmentsOf?.[plan.dialect]) || parts.graphics.treatments);
    const colours = [...new Set(COLOUR_ROLES.map((k) => c.P[k as keyof typeof c.P]).filter((v): v is string => typeof v === 'string'))];
    // spec 8.9 floor: each role in the stream's order, each placement of it in turn, until one shows PHOTO_FLOOR of
    // its box; else the placement that shows most. A candidate whose text over the photo fails is not taken.
    let best: { items: Item[]; share: number } | null = null, first: Item[] | null = null;
    search: for (const role of ch.order) {
      const r = ch.r(role);
      for (let k = 0; k < (role === 'ground' ? 2 : PHOTO_TRIES); k++) {
        const spot = photoSpot(role, below, ground.length, c.W, c.H, plan.page, plan.xf, plan.boxes.graphic, r, k);
        const its = items.slice();
        its.splice(spot.at, 0, photoItem(photo, spot, ch.scale, ch.x, ch.y, c.P.ground, treat, c.W / 1080));
        const ok = photoText(its, spot.at, below.length + 1, photo, colours, c.W, c.H, c.P.ground, c.spec.format);
        first ??= its;
        if (!ok) continue;
        const share = photoShare(its, spot.at, c.W, c.H);
        (its[spot.at] as GraphicItem).params.share = Math.round(share * 1000) / 1000;
        if (!best || share > best.share + 1e-9) best = { items: its, share };
        if (share >= PHOTO_FLOOR) break search;
      }
    }
    if (!best && !c.fallback) return null;
    items.splice(0, items.length, ...(best ?? { items: first! }).items);
    const d = items.length - n0;
    for (const it of items) if (it.kind === 'graphic' && it.knock) it.knock = { ...it.knock, glyphs: it.knock.glyphs.map((i) => i + d) };
  }
  // the ground's surface pass goes over everything, type included (spec 8.2 copier pass); never transformed
  items.push(...(parts.ground.pass?.(c, plan, items) ?? []));
  return { items, plan };
}
