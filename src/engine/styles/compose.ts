/**
 * Runs a style's five parts for one candidate: layout plans, ground and graphics draw under, type sets the text
 * on top, then graphics may read the finished Scene (knock-outs). Graphics and type work in the plan's local
 * page; here they are put on the canvas by the plan's transform. Ground is never transformed.
 */
import { compose, xfQuad, type Xf } from '../geom';
import type { GraphicItem, Item } from '../scene';
import type { Parts, PartCtx, Plan } from '../parts/types';
import { PHOTO_FLOOR, PHOTO_TRIES, photoChoice, photoItem, photoOf, photoShare, photoSpot, photoText, type PhotoRole } from '../photo';
import { COLOUR_ROLES, LEVEL_RANK, SLOT_LEVEL, SLOTS, extrasOf, flagWeight, hasContent, leadsOf } from '../spec';
import { placeLayers } from '../parts/shared/layers';
import { treatOf } from '../treat';

export function place(it: Item, F: Xf | undefined): Item {
  if (!F) return it;
  if (it.kind === 'graphic') return { ...it, frame: compose(F, it.frame), quad: xfQuad(F, it.quad), avoid: it.avoid?.map((q) => xfQuad(F, q)) };
  if (it.kind === 'rect') return { ...it, xf: compose(F, it.xf), quad: xfQuad(F, it.quad), shadowQuad: it.shadowQuad && xfQuad(F, it.shadowQuad) };
  return { ...it, xf: compose(F, it.xf), quad: xfQuad(F, it.quad) };
}

/** A candidate in one form, set up to the photo: the items under and over it, the plan, and what the photo needs. */
export interface Base { parts: Parts; c: PartCtx; plan: Plan; items: Item[]; below: Item[]; nGround: number; }

/**
 * Where the photo goes in a candidate (spec 8.9): its role, the attempt of that role, the text over it that sits on a
 * plate (ordinals among the text items after the photo) and the share of its box that shows. Chosen once for every
 * form of the style (`photoPick`), so neither the colour seed nor the mode moves it (spec 9.3, review R12 E1).
 */
export interface PhotoPick { role: PhotoRole; k: number; plated: number[]; share: number; }

export function compose5(parts: Parts, c: PartCtx): { items: Item[]; plan: Plan } | null {
  const b = composeBase(parts, c);
  if (!b) return null;
  const pick = photoOf(c.spec.photo?.id) ? photoPick([b]) : null;
  if (photoOf(c.spec.photo?.id) && !pick) return null;
  return composeFinish(b, pick);
}

/** The five parts up to the photo: plan, ground, graphics, type, text layers, the graphics' after(). */
export function composeBase(parts: Parts, c: PartCtx): Base | null {
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
  return { parts, c, plan, items, below, nGround: ground.length };
}

/** The base's items with the photo placed at one attempt of a role (spec 8.9), in the base's form. */
function withPhoto(b: Base, role: PhotoRole, k: number): { its: Item[]; at: number } {
  const { c, plan, parts } = b, photo = photoOf(c.spec.photo?.id)!, ch = photoChoice(c.spec);
  // its treatment (R15): the graphic stream's, from the style's list (the dialect's, where it has one)
  const treat = treatOf(c.spec, c.P, (plan.dialect && parts.graphics.treatmentsOf?.[plan.dialect]) || parts.graphics.treatments);
  // the role's placements, drawn in turn from its own stream: attempt k is the k-th
  const r = ch.r(role);
  let spot = photoSpot(role, b.below, b.nGround, c.W, c.H, plan.page, plan.xf, plan.boxes.graphic, r, 0);
  for (let j = 1; j <= k; j++) spot = photoSpot(role, b.below, b.nGround, c.W, c.H, plan.page, plan.xf, plan.boxes.graphic, r, j);
  const its = b.items.slice();
  its.splice(spot.at, 0, photoItem(photo, spot, ch.scale, ch.x, ch.y, c.P.ground, treat, c.W / 1080));
  return { its, at: spot.at };
}

/** Text over the photo measured against its pixels in the base's form, the `force`d ordinals plated whatever they read. */
function textOver(b: Base, its: Item[], at: number, force: ReadonlySet<number>): { ok: boolean; plated: number[] } {
  const { c } = b, photo = photoOf(c.spec.photo?.id)!;
  const colours = [...new Set(COLOUR_ROLES.map((k) => c.P[k as keyof typeof c.P]).filter((v): v is string => typeof v === 'string'))];
  return photoText(its, at, b.below.length + 1, photo, colours, c.W, c.H, c.P.ground, c.spec.format, force);
}

/**
 * Spec 8.9 floor, over every form at once (`bases`: the same candidate in each form of the style, the form in use
 * first): each role in the stream's order, each placement of it in turn, until one shows PHOTO_FLOOR of its box; else
 * the placement that shows most. A placement is taken only where the text over it passes in every form; a text item
 * that needs a plate in one form gets it in all (the plate's colour is each form's own), so the plates and the
 * share are the same in every form. Null: no placement passes (the candidate fails; the fallback takes the first).
 */
export function photoPick(bases: Base[]): PhotoPick | null {
  const b0 = bases[0], ch = photoChoice(b0.c.spec);
  let best: PhotoPick | null = null, first: PhotoPick | null = null;
  for (const role of ch.order) {
    for (let k = 0; k < (role === 'ground' ? 2 : PHOTO_TRIES); k++) {
      // plates in one form are plates in all: repeat until no form adds one (a plate can sit under a neighbour)
      const plated = new Set<number>();
      let ok = true, stable = false, share = 0;
      for (let round = 0; round < 6 && ok && !stable; round++) {
        const n = plated.size;
        for (const [q, b] of bases.entries()) {
          const { its, at } = withPhoto(b, role, k);
          const r = textOver(b, its, at, plated);
          for (const o of r.plated) plated.add(o);
          if (q === 0) share = photoShare(its, at, b.c.W, b.c.H);
          if (!r.ok) { ok = false; break; }
        }
        stable = ok && plated.size === n;
      }
      const pk: PhotoPick = { role, k, plated: [...plated].sort((x, y) => x - y), share };
      first ??= pk;
      if (!ok || !stable) continue;
      if (!best || share > best.share + 1e-9) best = pk;
      if (share >= PHOTO_FLOOR) return best;
    }
  }
  return best ?? (b0.c.fallback ? first : null);
}

/** The candidate in the base's form with the photo where `pick` puts it (none: no photo), and the surface pass. */
export function composeFinish(b: Base, pick: PhotoPick | null): { items: Item[]; plan: Plan } {
  const { parts, c, plan } = b;
  let items = b.items;
  if (pick) {
    const n0 = items.length, w = withPhoto(b, pick.role, pick.k);
    textOver(b, w.its, w.at, new Set(pick.plated));
    (w.its[w.at] as GraphicItem).params.share = Math.round(photoShare(w.its, w.at, c.W, c.H) * 1000) / 1000;
    items = w.its;
    // every text item moved up by what was inserted under it, and the knock-outs' glyph indices with it
    const d = items.length - n0;
    for (const it of items) if (it.kind === 'graphic' && it.knock) it.knock = { ...it.knock, glyphs: it.knock.glyphs.map((i) => i + d) };
  }
  // the ground's surface pass goes over everything, type included (spec 8.2 copier pass); never transformed
  items.push(...(parts.ground.pass?.(c, plan, items) ?? []));
  return { items, plan };
}
