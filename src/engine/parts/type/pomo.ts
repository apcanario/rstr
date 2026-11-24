/**
 * Postmodern type (spec 8.2, 8.5). Ice cream here; photocopy in pomo-copy.ts.
 *
 * Ice cream: the title in upper case as one tilted strip per line, each strip a different fill, stepping sideways,
 * with a hard shadow; or (the second treatment) every letter on its own tile. The subtitle in serif italic on a
 * highlight plate tilted the other way, under or over the title. Info in mono in a bordered box with a shadow, at
 * the free end of the page, right or left. Caption in mono up the left edge or down the right one. Every block is
 * built at the origin, measured by its quads, then put in its zone, so no block leaves the page or its margins.
 * In `stairs` the strips step across the whole page; in `title-side` the title and subtitle read up the left side.
 * Every piece of text sits on its own plate: shapes may sit behind the plates, never on the text (spec 8.2).
 */
import { firstInk, needRatio } from '../../colour';
import type { Rect, Xf } from '../../geom';
import { mkRect, mkText } from '../../items';
import type { Item } from '../../scene';
import { fit, fitLine, inkW } from '../../text';
import { boxOf, moveItems } from '../shared/block';
import { fitLines, upper } from '../shared/text';
import type { PartCtx, Plan, TypePart } from '../types';
import { copyType } from './pomo-copy';

const MIN = { title: 40, subtitle: 20, info: 16, caption: 16 };

interface Block { items: Item[]; b: Rect; }
const block = (items: Item[]): Block => ({ items, b: boxOf(items) });
const at = (B: Block, x: number, y: number): Item[] => moveItems(B.items, { x: x - B.b.x, y: y - B.b.y, rot: 0 });

function iceType(c: PartCtx, plan: Plan): Item[] | null {
  const { W, spec, m, P, T } = c;
  const M = plan.margin, tx = spec.text, force = c.fallback, pos = plan.pos ?? {};
  const d = W * 0.013;
  const A = { ink: P.ink, ground: P.ground, accent: P.accent, accent2: P.accent2 ?? P.accent, accent3: P.accent3 ?? P.ground };
  const area = plan.boxes.text, tz = plan.boxes.title ?? area, up = !!plan.titleUp;
  const ang = plan.slant, frame = plan.frame;
  const out: Item[] = [];
  const capRight = pos.caption === 'right' || up;

  // caption: mono along an edge on a ground strip, in the margin
  if (tx.caption.on && tx.caption.v.trim()) {
    const fs0 = Math.round(W * 0.019);
    const cf = fitLine(m, upper(tx.caption.v), T.mono, fs0, MIN.caption, area.h * 0.9, 0.18, force);
    if (!cf) { if (!force) return null; }
    else {
      const fs = cf.size, w = m(cf.lines[0], T.mono, fs, cf.tracking).width + fs * 1.2;
      const xf = capRight ? { x: plan.page.w - M * 0.42, y: area.y, rot: Math.PI / 2 } : { x: M * 0.42, y: area.y + area.h, rot: -Math.PI / 2 };
      out.push(mkRect({ x: -fs * 0.5, y: -fs * 0.2, w, h: fs * 1.5 }, P.ground, { xf, plate: true }));
      out.push(mkText(m, { slot: 'caption', part: 'line0', font: T.mono, size: fs, tracking: cf.tracking, runs: [{ s: cf.lines[0], x: 0, y: fs * 0.9 }], xf, fill: P.ink, ink: [P.ink], min: MIN.caption }));
    }
  }

  // info: mono in a bordered box with a shadow, at the free end of the page
  let info: Block | null = null;
  if (tx.info.on) {
    const pairs = tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim());
    if (pairs.length) {
      const fs0 = Math.round(W * 0.024);
      const strs = pairs.map((p) => (upper(p.k) + '  ' + p.v).trim());
      const f = fitLines(m, strs, T.mono, fs0, MIN.info, (area.w) * 0.62 - fs0 * 1.8, 0, force);
      if (!f) { if (!force) return null; }
      else {
        const fs = f.size, lh = fs * 1.55, pad = fs * 0.9;
        const bw = Math.max(...f.lines.map((l) => m(l, T.mono, fs).width)) + pad * 2, bh = f.lines.length * lh + pad * 1.5;
        const xf = { x: bw / 2, y: bh / 2, rot: ang * 0.4 };
        info = block([
          mkRect({ x: -bw / 2, y: -bh / 2, w: bw, h: bh }, P.ground, { xf, plate: true, shadow: { dx: d, dy: d, fill: P.ink }, stroke: { colour: P.ink, width: Math.max(2, W * 0.004) } }),
          mkText(m, { slot: 'info', part: 'box', font: T.mono, size: fs, runs: f.lines.map((l, i) => ({ s: l, x: -bw / 2 + pad, y: -bh / 2 + pad * 0.6 + (i + 0.72) * lh })), xf, fill: P.ink, ink: [P.ink], min: MIN.info }),
        ]);
      }
    }
  }
  const infoAtTop = plan.titleSide === 'bottom';
  const gap = W * 0.03;
  // what the title group may take: its zone, less the info box's band
  let zy0 = tz.y, zy1 = tz.y + tz.h;
  if (info && !up) {
    if (infoAtTop) zy0 = Math.max(zy0, area.y + info.b.h + gap);
    else zy1 = Math.min(zy1, area.y + area.h - info.b.h - gap);
  }
  const zone: Rect = up ? tz : { x: area.x, y: zy0, w: area.w, h: zy1 - zy0 };
  // in title-side the group reads up the page: its width runs along the zone's height
  const gw = up ? zone.h : zone.w, gh = up ? zone.w : zone.h;

  // subtitle: serif italic on a highlight plate, tilted the other way
  const subFont = T.serif ?? T.text;
  const ss = tx.subtitle.on && tx.subtitle.v.trim()
    ? fit(m, { text: tx.subtitle.v, font: subFont, maxW: gw - W * 0.1, maxH: W * 0.16, start: Math.round(W * 0.066 * Math.max(0.8, c.cap)), min: MIN.subtitle, lh: 1.15, maxLines: 2, force })
    : null;
  if (tx.subtitle.on && tx.subtitle.v.trim() && !ss && !force) return null;
  let sub: Block | null = null;
  if (ss) {
    const xf = { x: 0, y: 0, rot: -ang * 0.5 }, it: Item[] = [];
    const ink = firstInk([P.ink, P.ground], [A.accent3], needRatio(ss.size));
    ss.lines.forEach((l, i) => {
      const w = m(l, subFont, ss.size).width;
      it.push(mkRect({ x: -ss.size * 0.2, y: i * ss.size * 1.15, w: w + ss.size * 0.4, h: ss.size * 1.12 }, A.accent3, { xf, plate: true, shadow: { dx: d * 0.6, dy: d * 0.6, fill: P.ink } }));
    });
    ss.lines.forEach((l, i) => it.push(mkText(m, { slot: 'subtitle', part: 'line' + i, font: subFont, size: ss.size, runs: [{ s: l, x: 0, y: i * ss.size * 1.15 + ss.size * 0.82 }], xf, fill: ink, ink: [ink], min: MIN.subtitle })));
    sub = block(it);
  }

  // title: strips or tiles
  let title: Block | null = null;
  const titleText = tx.title.on ? tx.title.v.trim() : '';
  if (titleText) {
    const subH = sub ? sub.b.h + gap : 0;
    // a tall page (9:16) gives the title more to start from
    const maxH = gh - subH, start = Math.round(W * { small: 0.1, normal: 0.15, oversize: 0.2 }[plan.size] * c.cap * (c.story ? 1.25 : 1));
    const tiles = !force && plan.emphasis === 2 && frame !== 'stairs';
    title = tiles ? tileTitle(c, upper(titleText), gw - W * 0.04, maxH, start, d, A) : null;
    if (!title) title = stripTitle(c, ang, upper(titleText), gw, maxH, start, d, A, frame === 'stairs');
    if (!title) return null;
  }
  if (!title && !sub) { if (info) out.push(...at(info, plan.side === 'left' ? area.x : area.x + area.w - info.b.w, infoAtTop ? area.y : area.y + area.h - info.b.h)); return out; }

  // the group: title then subtitle (or subtitle over the title), stacked, aligned on the side the title hugs
  const first = pos.subtitle === 'over' ? sub : title, second = pos.subtitle === 'over' ? title : sub;
  const parts = [first, second].filter((b): b is Block => !!b);
  const right = pos.title === 'right';
  const groupW = Math.max(...parts.map((p) => p.b.w)), groupH = parts.reduce((a, p) => a + p.b.h, 0) + gap * (parts.length - 1);
  if (!force && (groupW > gw + 0.5 || groupH > gh + 0.5)) return null;
  const items: Item[] = [];
  let y = 0;
  for (const p of parts) {
    const x = right ? groupW - p.b.w : (p === sub && title ? W * 0.04 : 0);
    items.push(...at(p, Math.min(x, groupW - p.b.w), y));
    y += p.b.h + gap;
  }
  // put the group in its zone: top, bottom or centred, by the layout
  const vy = (h: number, span: number) => (frame === 'title-bottom' ? span - h : frame === 'title-top' || frame === 'stairs' ? 0 : (span - h) / 2);
  let G: Xf;
  if (up) {
    // reading up the left side: local x runs up from the zone's bottom, local y runs right from its left edge
    const along = vy(groupW, zone.h);
    G = { x: zone.x, y: zone.y + zone.h - along, rot: -Math.PI / 2 };
  } else {
    G = { x: right ? zone.x + zone.w - groupW : zone.x, y: zone.y + vy(groupH, zone.h), rot: 0 };
  }
  out.push(...moveItems(items, G));
  if (info) {
    const ix = plan.side === 'left' && !up ? area.x : area.x + area.w - info.b.w;
    out.push(...at(info, ix, infoAtTop ? area.y : area.y + area.h - info.b.h));
  }
  return out;
}

/** The title as one tilted strip per line, each a different fill, stepping sideways (spec 8.2). */
function stripTitle(c: PartCtx, slant: number, text: string, maxW: number, maxH: number, start: number, d: number, A: Record<string, string>, stairs: boolean): Block | null {
  const { W, m, T, fallback: force } = c;
  const step = stairs ? 0.55 : 0.22;
  // three lines step 2 x step x size; the widest line plus its step must fit, so fit narrower by the steps
  // a staircase takes one word a step (three steps at most)
  if (stairs) {
    const w = text.split(/\s+/).filter(Boolean);
    if (w.length > 1 && w.length <= 3) text = w.join('\n');
    else if (w.length > 3) { const k = Math.ceil(w.length / 3); text = [0, 1, 2].map((i) => w.slice(i * k, i * k + k).join(' ')).filter(Boolean).join('\n'); }
  }
  for (let px = Math.max(MIN.title, start); px >= MIN.title; px -= 2) {
    const tt = fit(m, { text, font: T.display, maxW: maxW - px * (0.32 + step * 2) - W * 0.02, maxH: Infinity, start: px, min: px, lh: 1.18, maxLines: 3 });
    if (!tt) continue;
    const b = strips(c, slant, tt.lines, tt.size, d, A, stairs ? Math.max(1.2, Math.min(2.4, (maxH - tt.size) / Math.max(1, tt.lines.length - 1) / tt.size)) : 1.2, step);
    if (b.b.w <= maxW + 0.5 && b.b.h <= maxH + 0.5) return b;
  }
  if (!force) return null;
  const tt = fit(m, { text, font: T.display, maxW: maxW - MIN.title * 0.8 - W * 0.02, maxH: Math.max(MIN.title, maxH / 1.3), start: MIN.title, min: MIN.title, lh: 1.18, maxLines: 3, force: true });
  return tt ? strips(c, slant, tt.lines, tt.size, d, A, 1.2, 0.22) : null;
}

function strips(c: PartCtx, slant: number, lines: string[], size: number, d: number, A: Record<string, string>, pitch: number, step: number): Block {
  const { m, P, T } = c;
  const xf = { x: 0, y: 0, rot: slant };
  const fills = [P.ink, A.accent, A.accent2], rects: Item[] = [], texts: Item[] = [];
  lines.forEach((l, i) => {
    const w = m(l, T.display, size).width, padX = size * 0.16, h = size * 1.06;
    const y = i * size * pitch, x = i * size * step, fc = fills[i % 3];
    rects.push(mkRect({ x, y, w: w + padX * 2, h }, fc, { xf, plate: true, shadow: { dx: d, dy: d, fill: P.ink } }));
    const ink = firstInk(fc === A.accent2 ? [P.ink, P.ground] : [P.ground, P.ink], [fc], needRatio(size));
    texts.push(mkText(m, { slot: 'title', part: 'line' + i, font: T.display, size, runs: [{ s: l, x: x + padX, y: y + size * 0.86 }], xf, fill: ink, ink: [ink], min: MIN.title }));
  });
  return block([...rects, ...texts]);
}

/** The second treatment: every letter on its own tile, tiles rocking a little, each with a hard shadow. */
function tileTitle(c: PartCtx, text: string, maxW: number, maxH: number, start: number, d: number, A: Record<string, string>): Block | null {
  const { m, P, T } = c;
  const words = text.split(/\s+/).filter(Boolean);
  const fills = [A.accent, P.ink, A.accent2, A.accent3];
  for (let px = start; px >= MIN.title; px -= 2) {
    const pad = px * 0.14, gapT = px * 0.12, space = px * 0.75, th = px * 1.16;  // a word gap that reads as one (review R6 S7)
    const cw = (ch: string) => Math.max(inkW(m(ch, T.display, px)) + pad * 2, px * 0.7);
    const ww = (w: string) => [...w].reduce((a, ch) => a + cw(ch) + gapT, -gapT);
    const lines: string[][] = [];
    let cur: string[] = [], curW = 0, ok = true;
    for (const w of words) {
      const wl = ww(w);
      if (wl > maxW) { ok = false; break; }
      const nw = cur.length ? curW + space + wl : wl;
      if (cur.length && nw > maxW) { lines.push(cur); cur = [w]; curW = wl; } else { cur.push(w); curW = nw; }
    }
    if (!ok) continue;
    if (cur.length) lines.push(cur);
    if (lines.length > 3 || lines.length * (th + gapT * 2) > maxH) continue;
    const rects: Item[] = [], texts: Item[] = [];
    let n = 0;
    lines.forEach((ln, li) => {
      let x = li * px * 0.3;
      const y = li * (th + gapT * 2);
      ln.forEach((w) => {
        for (const ch of w) {
          const tw = cw(ch), fc = fills[n % fills.length], rot = (n % 2 ? 1 : -1) * (0.03 + (n % 3) * 0.012);
          const xf = { x: x + tw / 2, y: y + th / 2, rot };
          rects.push(mkRect({ x: -tw / 2, y: -th / 2, w: tw, h: th }, fc, { xf, plate: true, shadow: { dx: d * 0.8, dy: d * 0.8, fill: P.ink } }));
          const ink = firstInk([P.ground, P.ink], [fc], needRatio(px)), mt = m(ch, T.display, px);
          texts.push(mkText(m, { slot: 'title', part: 'tile' + n, font: T.display, size: px, runs: [{ s: ch, x: -(mt.right - mt.left) / 2, y: (mt.ascent - mt.descent) / 2 }], xf, fill: ink, ink: [ink], min: MIN.title }));
          x += tw + gapT;
          n++;
        }
        x += space - gapT;
      });
    });
    const b = block([...rects, ...texts]);
    if (b.b.w <= maxW + 0.5 && b.b.h <= maxH + 0.5) return b;
  }
  return null;
}

export const pomoType: TypePart = {
  id: 'pomo', min: MIN,
  set(c, plan) {
    return plan.dialect === 'photocopy' ? copyType(c, plan) : iceType(c, plan);
  },
};
