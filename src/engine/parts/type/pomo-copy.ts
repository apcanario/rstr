/**
 * Postmodern photocopy type (spec 8.2): nineties magazine grunge, after the spike's `grunge` (ideas, not code).
 *
 * - Every title word (two words a unit past five) gets its own face, size and case from the pairing's display,
 *   serif and heavy faces. Negative leading: each word's top runs into the one above, so words collide (the title's
 *   words are one group for rule 2). One word sits in a toner box, set in paper; one has a ghost copy in the spot
 *   colour; one is sliced and its halves offset. A word may run off the page's side: it is cut by the edge.
 * - Paper edge (on by default): every word that is not boxed carries a paper-coloured halo, so its toner holds over
 *   ink and over its neighbours; rule 4 reads its fill against the halo. With `pomo.paperEdge` false (Advanced) the
 *   halo goes and rule 4 is waived for those words only (spec 8.2).
 * - Subtitle on cut-out paper strips, two words each, stepping across. Info on a paper label with a heavy top
 *   edge. Caption three times, fading: the faintest copy still reaches 4.5:1 on the paper, in every form.
 *
 * Info and caption share a band at the free end (opposite sides of it); the title and subtitle take the zone.
 * Word attitudes come from the layout seed (a stream of their own per candidate), never the graphic stream.
 */
import { firstInk, luminance, mixOf, needRatio, type Mix } from '../../colour';
import type { Rect, Xf } from '../../geom';
import { mkRect, mkText } from '../../items';
import { mix, rng, type Rng } from '../../rng';
import type { FontRef, Item } from '../../scene';
import { fitLine, inkW } from '../../text';
import { boxOf, moveItems } from '../shared/block';
import { fitLines, upper } from '../shared/text';
import type { PartCtx, Plan } from '../types';

const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };
/** Ghost, box and slice choices for each title unit. */
const RELS = [0.62, 0.85, 1, 1.25, 1.6];
/** The paper halo round a photocopy title word, in em. */
export const HALO = 0.06;
/** Negative leading: a word's padded top runs this share of itself into the word above. */
const LEAD = 0.78;
/** The ghost copy's offset, each axis, in em: clear of the 0.06 em halo so it shows as its own copy (review R6 E1). */
export const GHOST = [0.1, 0.16];
/** The most of a title word's ink box later title words may cover (review R6 S1; the refs collide by about a quarter). */
export const COVER = 0.35;
/** The most a title word may run past the page's side, in em, and past one side only (review bundle 3 M3). */
export const OVER = 0.3;

/** A word's ink box: x, y its baseline origin on the page, rot about it, l, r, a, d its ink extents. */
export interface Ink { x: number; y: number; rot: number; l: number; r: number; a: number; d: number; }
const inInk = (k: Ink, px: number, py: number) => {
  const dx = px - k.x, dy = py - k.y, cs = Math.cos(k.rot), sn = Math.sin(k.rot);
  const u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
  return u >= -k.l && u <= k.r && v >= -k.a && v <= k.d;
};
/** The corners of an ink box on the page, its extents grown by g. */
const cornersOf = (k: Ink, g = 0): [number, number][] => {
  const cs = Math.cos(k.rot), sn = Math.sin(k.rot);
  return [[-k.l - g, -k.a - g], [k.r + g, -k.a - g], [k.r + g, k.d + g], [-k.l - g, k.d + g]].map(([u, v]) => [k.x + u * cs - v * sn, k.y + u * sn + v * cs]);
};
/** Whether two ink boxes (each grown by its own g) meet: separating axes of two rotated rectangles. */
export function inksMeet(a: Ink, ga: number, b: Ink, gb: number): boolean {
  const A = cornersOf(a, ga), B = cornersOf(b, gb);
  for (const rot of [a.rot, b.rot]) for (const [ax, ay] of [[Math.cos(rot), Math.sin(rot)], [-Math.sin(rot), Math.cos(rot)]]) {
    const pa = A.map(([x, y]) => x * ax + y * ay), pb = B.map(([x, y]) => x * ax + y * ay);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}
/** The toner box round the boxed word, in em past its ink. */
export const BOX_PAD = 0.08;

/** The share of ink box k under any of the boxes over it, sampled on a 24 x 12 grid. */
export function coverOf(k: Ink, over: Ink[]): number {
  const cs = Math.cos(k.rot), sn = Math.sin(k.rot);
  let hit = 0;
  for (let a = 0; a < 24; a++) for (let c = 0; c < 12; c++) {
    const u = -k.l + ((a + 0.5) / 24) * (k.l + k.r), v = -k.a + ((c + 0.5) / 12) * (k.a + k.d);
    const px = k.x + u * cs - v * sn, py = k.y + u * sn + v * cs;
    if (over.some((o) => inInk(o, px, py))) hit++;
  }
  return hit / 288;
}

/** The contrast the caption's faintest copy fades to on the paper: 4.5:1 (spec 5) with room for the copier pass. */
export const CAPTION_FAINT = 7;
/** The middle copy's contrast on the paper: a step stronger than the faintest. */
export const CAPTION_MID = 9;
/** The mix of a toward b with the least share of b that reaches the ratio on a (so the copy fades as far as it may). */
/** Title units: the words, or past five words, pairs of them; a typed line break is kept as a unit break. */
export function unitsOf(title: string): string[] {
  const paras = title.split('\n').map((p) => p.trim().split(/\s+/).filter(Boolean)).filter((p) => p.length);
  const words = paras.flat();
  if (words.length <= 5) return words;
  return paras.flatMap((p) => { const out: string[] = []; for (let i = 0; i < p.length; i += 2) out.push(p.slice(i, i + 2).join(' ')); return out; });
}

interface Unit { s: string; face: FontRef; rel: number; size: number; }
interface Ext { top: number; bot: number; }

/** Vertical extent of a word's padded ink rect, rotated by rot about its baseline origin. */
function ext(left: number, right: number, asc: number, desc: number, pad: number, rot: number, dy: number): Ext {
  const sn = Math.sin(rot), cs = Math.cos(rot), ys: number[] = [];
  for (const u of [-left - pad, right + pad]) for (const v of [-asc - pad, desc + pad + dy]) ys.push(u * sn + v * cs);
  return { top: Math.min(...ys), bot: Math.max(...ys) };
}

export function copyType(c: PartCtx, plan: Plan): Item[] | null {
  const { W, spec, m, P, T } = c;
  const tx = c.tx, force = c.fallback, pos = plan.pos ?? {};
  const paper = P.paper ?? P.ground, toner = P.toner ?? P.ink, spot = P.spot ?? toner;
  // the label's plate, mixed from paper and toner: recorded, so a colour edit mixes it again (review R12 S1)
  const labelMix: Mix = luminance(paper) > 0.4 ? { a: paper, b: toner, k: -0.16 } : { a: toner, b: paper, k: 0.06 };
  const label = mixOf(labelMix);
  const edge = spec.params['pomo.paperEdge'] !== false;
  const area = plan.boxes.text, tz = plan.boxes.title ?? area;
  const rw: Rng = rng(mix(spec.seeds.layout, 0x9a9e5 + Math.max(0, c.k)));
  const gap = W * 0.025;
  const infoR: Item[] = [], infoT: Item[] = [], capT: Item[] = [];
  const atTop = plan.titleSide === 'bottom';
  const infoRight = c.tx.caption.pos ? pos.caption === 'left' : pos.info !== 'left';

  // the band at the free end: info label on one side, the caption's three copies on the other
  let infoB: { items: Item[]; w: number; h: number } | null = null;
  if (tx.info.on) {
    const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
    if (pairs.length) {
      const fs0 = Math.round(W * 0.024);
      const f = fitLines(m, pairs.map((p) => (upper(p.k) + ' ' + p.v).trim()), T.mono, fs0, MIN.info, area.w * 0.5 - fs0 * 1.4, 0, force);
      if (!f) { if (!force) return null; }
      else {
        const fs = f.size, bw = Math.max(...f.lines.map((l) => m(l, T.mono, fs).width)) + fs * 1.4, bh = f.lines.length * fs * 1.25 + fs * 1.1;
        const xf: Xf = { x: 0, y: 0, rot: (rw() - 0.5) * 0.07 };
        const ink = firstInk([toner, paper], [label], 4.5);
        infoB = { w: 0, h: 0, items: [
          { ...mkRect({ x: 0, y: 0, w: bw, h: bh }, label, { xf, plate: true }), mixed: { fill: labelMix } },
          mkRect({ x: 0, y: 0, w: bw, h: fs * 0.28 }, toner, { xf, plate: true }),
          mkText(m, { slot: 'info', part: 'label', font: T.mono, size: fs, runs: f.lines.map((l, i) => ({ s: l, x: fs * 0.7, y: fs * 1.5 + i * fs * 1.25 })), xf, fill: ink, ink: [ink], min: MIN.info }),
        ] };
        const b = boxOf(infoB.items);
        infoB.items = moveItems(infoB.items, { x: -b.x, y: -b.y, rot: 0 });
        infoB.w = b.w; infoB.h = b.h;
      }
    }
  }
  let capB: { items: Item[]; w: number; h: number } | null = null, stacked = false;
  if (tx.caption.on && tx.caption.v.trim()) {
    const fs0 = Math.round(W * 0.018);
    let cf = fitLine(m, upper(tx.caption.v), T.mono, fs0, MIN.caption, area.w * (infoB ? 0.44 : 0.9) - fs0, 0, force);
    // beside the label the caption may not fit a tilted page's narrower measure: it takes the band's whole width,
    // under the label (over it at the foot), rather than the design falling back (review R10 S2)
    if (!cf && infoB && !force) { cf = fitLine(m, upper(tx.caption.v), T.mono, fs0, MIN.caption, area.w * 0.9 - fs0, 0, false); stacked = !!cf; }
    if (!cf) { if (!force) return null; }
    else {
      const fs = cf.size, line = cf.lines[0];
      // three copies, the strongest at the bottom; the faintest still 4.5:1 on the paper (spec 5) once the copier pass
      // has run over it: at 4.6 the pass's streaks took it to 3.99 in cells (R15, read over a photo); at 5.4 to 3.52
      // and at 6.2 to 4.22 on paper with no photo (review R15 S3, every text item read); 7 holds over 600 designs
      // the two faded copies record their fade, so a colour edit fades them again from the edited colours (review R12 S1)
      const fades: (Mix | null)[] = [null, { a: paper, b: toner, fade: CAPTION_MID }, { a: paper, b: toner, fade: CAPTION_FAINT }];
      const items = fades.map((mx, i) => {
        const col = mx ? mixOf(mx) : toner;
        const t = mkText(m, { slot: 'caption', part: i ? 'copy' + i : 'line0', font: T.mono, size: fs, runs: [{ s: line, x: i * fs * 0.5, y: -i * fs * 1.22 }], fill: col, ink: [col], min: MIN.caption });
        return mx ? { ...t, mixed: { fill: mx } } : t;
      });
      const b = boxOf(items);
      capB = { items: moveItems(items, { x: -b.x, y: -b.y, rot: 0 }), w: b.w, h: b.h };
    }
  }
  const sgap = gap * 0.6;
  const bandH = stacked && infoB && capB ? infoB.h + sgap + capB.h : Math.max(infoB?.h ?? 0, capB?.h ?? 0);
  const bandY = atTop ? area.y : area.y + area.h - bandH;
  const ij = rw();
  if (infoB) {
    const moved = moveItems(infoB.items, { x: infoRight ? area.x + area.w - infoB.w - ij * W * 0.04 : area.x + ij * W * 0.04, y: atTop || stacked ? bandY : bandY + bandH - infoB.h, rot: 0 });
    infoR.push(...moved.filter((i) => i.kind === 'rect'));
    infoT.push(...moved.filter((i) => i.kind === 'text'));
  }
  if (capB) capT.push(...moveItems(capB.items, { x: infoRight ? area.x : area.x + area.w - capB.w, y: stacked || !atTop ? bandY + bandH - capB.h : bandY, rot: 0 }));

  // the zone left for title and subtitle
  let zy0 = tz.y, zy1 = tz.y + tz.h;
  if (bandH) { if (atTop) zy0 = Math.max(zy0, bandY + bandH + gap); else zy1 = Math.min(zy1, bandY - gap); }
  const zone: Rect = { x: tz.x, y: zy0, w: tz.w, h: zy1 - zy0 };
  if (zone.h < W * 0.1 && !force) return null;

  // subtitle: cut-out strips, two words each, stepping across
  let sub: { items: Item[]; w: number; h: number } | null = null;
  if (tx.subtitle.on && tx.subtitle.v.trim()) {
    const words = upper(tx.subtitle.v).split(/\s+/).filter(Boolean), chunks: string[] = [];
    for (let i = 0; i < words.length; i += 2) chunks.push(words.slice(i, i + 2).join(' '));
    const shown = chunks.slice(0, 4);
    if (chunks.length > 4) shown[3] = shown[3] + ' …';
    const f = fitLines(m, shown, T.mono, Math.round(W * 0.034), MIN.subtitle, Math.min(zone.w, area.w) - W * 0.06, 0.06, force);
    if (!f) { if (!force) return null; }
    else {
      const fs = f.size, tr = fs * 0.06, items: Item[] = [], stripTexts: Item[] = [];
      let sx = rw() * W * 0.1;
      f.lines.forEach((s, i) => {
        const w = m(s, T.mono, fs, tr).width + fs, maxX = Math.min(zone.w, area.w) - w;
        if (sx > maxX) sx = Math.max(0, Math.min(maxX, (i % 2) * W * 0.05));
        // a long strip turns less, so it never reaches the next one
        const xf: Xf = { x: sx, y: i * fs * 1.75, rot: (rw() - 0.5) * 2 * Math.min(0.03, (fs * 0.25) / w) };
        const fill = i === 0 && spot !== toner ? spot : label, ink = firstInk([toner, paper], [fill], needRatio(fs));
        items.push(mkRect({ x: 0, y: -fs * 1.05, w, h: fs * 1.45 }, fill, { xf, plate: true }));
        stripTexts.push(mkText(m, { slot: 'subtitle', part: 'strip' + i, font: T.mono, size: fs, tracking: tr, runs: [{ s, x: fs * 0.5, y: 0 }], xf, fill: ink, ink: [ink], min: MIN.subtitle }));
        sx += W * 0.09;
      });
      const all = [...items, ...stripTexts], b = boxOf(all);
      sub = { items: moveItems(all, { x: -b.x, y: -b.y, rot: 0 }), w: b.w, h: b.h };
    }
  }
  const subH = sub ? sub.h + gap : 0;

  // title words
  const titleText = tx.title.on ? tx.title.v.trim() : '';
  let tItems: { rects: Item[]; texts: Item[]; h: number } | null = null;
  if (titleText) {
    tItems = copyTitle(c, plan, titleText, zone, zone.h - subH, rw, { paper, toner, spot, edge });
    if (!tItems) return null;
  }
  // stack: title then subtitle, or subtitle over; at the zone's top, bottom or middle by the layout
  const over = pos.subtitle === 'over';
  const total = (tItems?.h ?? 0) + (sub && tItems ? gap : 0) + (sub?.h ?? 0);
  if (total > zone.h + 0.5 && !force) return null;
  const y0 = plan.frame === 'copy-low' ? zone.y + zone.h - total : plan.frame === 'copy-centre' ? zone.y + (zone.h - total) / 2 : zone.y;
  const ty = over && sub ? y0 + sub.h + gap : y0, sy = over || !tItems ? y0 : y0 + tItems.h + gap;
  const tR = tItems ? moveItems(tItems.rects, { x: 0, y: ty, rot: 0 }) : [], tT = tItems ? moveItems(tItems.texts, { x: 0, y: ty, rot: 0 }) : [];
  let sR: Item[] = [], sT: Item[] = [];
  if (sub) {
    const sx = zone.x + Math.max(0, Math.min(zone.w, area.w) - sub.w) * (pos.title === 'right' ? 0.8 : 0.1);
    const moved = moveItems(sub.items, { x: Math.min(sx, area.x + area.w - sub.w), y: sy, rot: 0 });
    sR = moved.filter((i) => i.kind === 'rect');
    sT = moved.filter((i) => i.kind === 'text');
  }
  // plates first (title boxes, strips, the label), then every text: no plate is ever drawn over text (rule 3),
  // and each text finds its own plate before any other (rule 4)
  return [...tR, ...sR, ...infoR, ...tT, ...sT, ...infoT, ...capT];
}

interface Inks { paper: string; toner: string; spot: string; edge: boolean; }

/** The title's words at the origin (y from 0, x on the page): their boxes, their text, and the block's height. */
function copyTitle(c: PartCtx, plan: Plan, title: string, zone: Rect, availH: number, rw: Rng, ink: Inks): { rects: Item[]; texts: Item[]; h: number } | null {
  const { W, m, T, fallback: force } = c, pg = plan.page, pos = plan.pos ?? {};
  const faces: FontRef[] = [T.display, T.serif ?? T.display, T.heavy ?? T.display];
  const raw = unitsOf(title);
  let fi = Math.floor(rw() * 3);
  const units: Unit[] = raw.map((s) => {
    fi = (fi + 1 + Math.floor(rw() * 2)) % 3;
    const face = force ? T.display : faces[fi];
    const serif = face === T.serif && face !== T.display;
    const cased = serif ? s : force || rw() < 0.72 ? upper(s) : s.toLocaleLowerCase('en');
    return { s: cased, face, rel: force ? 1 : RELS[Math.floor(rw() * RELS.length)], size: 0 };
  });
  // every title word its own case (review R6 S6): if the draws left every word in one case, the last word that
  // is not set in the serif takes the other one
  const caseOf = (t: string) => (t === t.toLocaleUpperCase('en') ? (t === t.toLocaleLowerCase('en') ? '' : 'U') : t === t.toLocaleLowerCase('en') ? 'L' : 'M');
  const cases = new Set(units.map((u) => caseOf(u.s)).filter(Boolean));
  if (!force && units.length > 1 && cases.size === 1 && !cases.has('M')) {
    const k = units.map((u, i) => (u.face === T.serif && u.face !== T.display ? -1 : i)).filter((i) => i >= 0).pop();
    if (k !== undefined) units[k].s = cases.has('U') ? units[k].s.toLocaleLowerCase('en') : upper(units[k].s);
  }
  const n = units.length;
  // one word hot (the ghost), one boxed, one sliced (spec 8.2): three different words where there are three; the
  // slice never falls on the boxed word (review R6 S4), and with two words it shares the ghost's
  const hot = Math.floor(rw() * n), boxed = n > 1 ? (hot + 1 + Math.floor(rw() * (n - 1))) % n : -1;
  const free = units.map((_, i) => i).filter((i) => i !== boxed && (n < 3 || i !== hot));
  const cut = free[Math.floor(rw() * free.length)];
  const rots = units.map(() => (rw() - 0.5) * 0.1);
  const xs = units.map(() => rw());
  const slice = 0.05 + rw() * 0.07;
  // the ghost sits clear of the paper halo (0.06 em past every glyph edge) and, paper edge on, carries its own
  // paper halo, so it reads as its own copy over ink (review R6 E1)
  const ghost = { dx: GHOST[0] + rw() * (GHOST[1] - GHOST[0]), dy: GHOST[0] + rw() * (GHOST[1] - GHOST[0]) };
  const full = zone.x <= plan.margin + 1 && zone.x + zone.w >= pg.w - plan.margin - 1;
  const wcap = full ? pg.w * 1.03 : zone.w * 1.06;
  const mult = { small: 0.55, normal: 0.8, oversize: 1 }[plan.size] * c.cap;
  // past the page a word overhangs one side only, by at most OVER em: its ink starts at the zone's far edge, so the
  // widest it may be is the room from there to the page's other side plus OVER em (review bundle 3 M3: a word cut
  // at both ends read as cropped)
  const room = Math.max(zone.x + zone.w, pg.w - zone.x);
  /** The ink's left x for a word wider than the zone: flush right (over the left side) or flush left (over the
   *  right), the drawn side unless it would run past the page by more than OVER em there. */
  const overSide = (w: number, sz: number, left: boolean) => {
    const overL = w - (zone.x + zone.w), overR = zone.x + w - pg.w;
    const useLeft = left ? overL <= OVER * sz + 0.5 || overL <= overR : !(overR <= OVER * sz + 0.5 || overR <= overL);
    return useLeft ? zone.x + zone.w - w : zone.x;
  };
  const sizeFor = (u: Unit, S: number) => {
    const w100 = Math.max(1, inkW(m(u.s, u.face, 100)));
    const cap = full ? (w100 / 100 > OVER ? room / (w100 / 100 - OVER) : Infinity) : (wcap / w100) * 100;
    return Math.max(1, Math.min(S * u.rel, cap));
  };
  const pad = (sz: number) => sz * Math.max(HALO, 0.09);
  /** Every word's baseline and x at the given sizes: negative leading, then pushed down until no earlier word is
   *  more than COVER of its ink box under the later ones (review R6 S1). */
  const stack = (sizeOf: (u: Unit) => number) => {
    const out: { sz: number; mt: ReturnType<typeof m>; b: number; ox: number; e: Ext; ink: Ink }[] = [];
    let b = 0, prevBot = 0, h = 0;
    units.forEach((u, i) => {
      const sz = sizeOf(u), mt = m(u.s, u.face, sz), w = inkW(mt), rot = rots[i];
      const e = ext(mt.left, mt.right, mt.ascent, mt.descent, pad(sz), rot, i === cut ? sz * 0.02 : 0);
      b = i === 0 ? -e.top : b + prevBot * 0.2 + -e.top * LEAD;
      const slack = zone.w - w;
      // wider than the zone: flush with one side of it and over the page's other side only (M3), the side by its draw
      const inkX = slack >= 0 ? zone.x + slack * (pos.title === 'right' ? 0.35 + 0.65 * xs[i] : 0.65 * xs[i]) : full ? overSide(w, sz, xs[i] < 0.5) : zone.x + slack / 2;
      const ox = inkX + Math.max(0, mt.left);
      const ink = (y: number): Ink => ({ x: ox, y, rot, l: mt.left, r: mt.right + (i === cut ? sz * slice : 0), a: mt.ascent, d: mt.descent });
      if (i > 0) {
        const worst = (y: number) => Math.max(...out.map((_, j) => coverOf(out[j].ink, [...out.slice(j + 1).map((o) => o.ink), ink(y)])));
        if (worst(b) > COVER) {
          // the least push that brings every earlier word under COVER (none at all once the word clears them)
          let lo = b, hi = b + Math.max(...out.map((o) => o.b + o.mt.descent)) - (b - mt.ascent) + sz;
          for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (worst(mid) > COVER) lo = mid; else hi = mid; }
          b = hi;
        }
        // the boxed word's toner box is drawn under every title word: an earlier word's paper halo (and the ghost's)
        // over it would put the boxed word's paper letters on paper (Carried R12 from bundle 3). The boxed word is
        // pushed down, as COVER pushes, until its box meets no earlier word's halo; later words cover it as usual
        if (i === boxed && !force) {
          const reach = (j: number) => out[j].sz * (HALO + (j === hot ? GHOST[1] + HALO : 0)) + 1;
          const hits = (y: number) => out.some((o, j) => inksMeet(o.ink, reach(j), ink(y), sz * BOX_PAD));
          if (hits(b)) {
            let lo = b, hi = b + Math.max(...out.map((o, j) => o.b + o.e.bot + reach(j))) - (b + e.top) + sz;
            for (let k = 0; k < 18 && hits(hi); k++) hi += sz;
            for (let k = 0; k < 16; k++) { const mid = (lo + hi) / 2; if (hits(mid)) lo = mid; else hi = mid; }
            b = hi;
          }
        }
      }
      prevBot = e.bot;
      h = Math.max(h, b + e.bot);
      out.push({ sz, mt, b, ox, e, ink: ink(b) });
    });
    return { out, h, end: b + prevBot };
  };
  const height = (S: number) => stack((u) => Math.round(sizeFor(u, S) * 2) / 2).h;
  // the largest base size whose stack fits the height
  let lo = MIN.title * 0.5, hi = W * (c.story ? 0.55 : 0.42) * mult;
  if (height(hi) <= availH) lo = hi;
  else for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (height(mid) <= availH) lo = mid; else hi = mid; }
  units.forEach((u) => { u.size = Math.round(sizeFor(u, lo) * 2) / 2; });
  if (units.some((u) => u.size < MIN.title)) {
    if (!force) return null;
    units.forEach((u) => {
      if (u.size >= MIN.title) return;
      u.size = MIN.title;
      const f = fitLine(m, u.s, u.face, MIN.title, MIN.title, wcap, 0, true);
      u.s = f?.lines[0] ?? '…';
    });
    while (units.length > 1 && stack((u) => u.size).h > availH) units.pop();
  }
  const placed = stack((u) => u.size);
  if (placed.h > availH + 0.5 && !force) return null;

  const rects: Item[] = [], texts: Item[] = [];
  units.forEach((u, i) => {
    const { sz, mt, b, ox } = placed.out[i], w = inkW(mt), rot = rots[i];
    const xf: Xf = { x: ox, y: b, rot };
    // cut by the page's side where the word runs past it
    const cs = Math.cos(rot), sn = Math.sin(rot), vs = [-mt.ascent - pad(sz), mt.descent + pad(sz)];
    const u0 = (Math.max(...vs.map((v) => v * sn)) - ox) / cs, u1 = (pg.w - ox + Math.min(...vs.map((v) => v * sn))) / cs;
    const clipX = -mt.left - pad(sz) < u0 || mt.right + pad(sz) + sz * 0.12 > u1 ? { x: u0, y: -sz * 3, w: u1 - u0, h: sz * 6 } : undefined;
    const isBox = i === boxed && !force;
    const base = { slot: 'title' as const, font: u.face, size: sz, xf, min: MIN.title, group: 'title' };
    if (isBox) {
      const p = sz * BOX_PAD;
      rects.push(mkRect({ x: -Math.max(0, mt.left) - p, y: -mt.ascent - p, w: w + 2 * p, h: mt.ascent + mt.descent + 2 * p }, ink.toner, { xf, plate: true }));
      texts.push({ ...mkText(m, { ...base, part: 'word' + i, runs: [{ s: u.s, x: 0, y: 0 }], clip: clipX, fill: ink.paper, ink: [ink.paper] }), boxed: true });
      return;
    }
    const look = {
      fill: ink.toner, ink: [ink.toner],
      ...(ink.edge ? { stroke: { paint: ink.paper, width: sz * HALO, halo: true } } : { waive: [4] }),
      ...(i === hot && !force ? { echoes: [{ dx: sz * ghost.dx, dy: sz * ghost.dy, paint: ink.spot, ...(ink.edge ? { halo: ink.paper } : {}) }] } : {}),
    };
    if (i === cut && !force && n > 0) {
      // sliced: the top part as set, the bottom part shifted along
      const yS = -sz * 0.4, dx = sz * slice;
      const inter = (a: Rect, k?: Rect): Rect => (k ? { x: Math.max(a.x, k.x), y: a.y, w: Math.max(0, Math.min(a.x + a.w, k.x + k.w) - Math.max(a.x, k.x)), h: a.h } : a);
      texts.push(mkText(m, { ...base, ...look, part: 'word' + i, runs: [{ s: u.s, x: 0, y: 0 }], clip: inter({ x: -W * 2, y: -sz * 3, w: W * 4, h: sz * 3 + yS }, clipX) }));
      texts.push(mkText(m, { ...base, ...look, part: 'word' + i + 'b', runs: [{ s: u.s, x: dx, y: sz * 0.02 }], clip: inter({ x: -W * 2, y: yS, w: W * 4, h: sz * 3 }, clipX) }));
      return;
    }
    texts.push(mkText(m, { ...base, ...look, part: 'word' + i, runs: [{ s: u.s, x: 0, y: 0 }], clip: clipX }));
  });
  const bb = boxOf([...rects, ...texts]);
  // the stack starts at y 0: its top is the first word's padded top
  return { rects, texts, h: Math.max(bb.y + bb.h, placed.end) };
}
