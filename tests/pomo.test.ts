/** Postmodern, both dialects (row R6, spec 8.2, 8.5) on the stub measure. */
import { describe, expect, test } from 'vitest';
import { contrast, needRatio } from '../src/engine/colour';
import { bounds } from '../src/engine/geom';
import { GRAPHICS } from '../src/engine/graphics';
import { FOUND } from '../src/engine/graphics/found';
import { PATTERN_KINDS } from '../src/engine/graphics/pattern';
import { SHAPE_NAMES } from '../src/engine/graphics/shape';
import { check, haloOf } from '../src/engine/invariants';
import { choosePalette, solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { COPY_LAYOUTS, ICE_LAYOUTS, POMO_POS } from '../src/engine/parts/layout/pomo';
import { copier } from '../src/engine/graphics/copier';
import { coverOf, GHOST, OVER, unitsOf, type Ink } from '../src/engine/parts/type/pomo-copy';
import { fit, fitShort, inkW } from '../src/engine/text';
import { blendDist } from '../src/engine/pixels';
import { rng } from '../src/engine/rng';
import { seedSet, shuffleSeeds, specs } from '../src/engine/proof';
import type { GraphicItem, Scene, TextItem } from '../src/engine/scene';
import { lead, slotsOf, defaultSpec, migrate, type Dialect, type Slot, type Spec } from '../src/engine/spec';

const show = (fs: unknown[]) => fs.slice(0, 3).map((f) => JSON.stringify(f)).join('\n');
const texts = (sc: Scene) => sc.items.filter((i): i is TextItem => i.kind === 'text');
const pomo = (i: number, dialect: Dialect | null, f: Spec['format'] = '3:4', mode: Spec['mode'] = 'light') => {
  const s = defaultSpec(shuffleSeeds(i));
  s.style = 'pomo'; s.format = f; s.mode = mode; s.pick.dialect = dialect;
  return s;
};

describe('the two dialects (spec 8.2)', () => {
  test('the layout stream picks either about half the time; pick.dialect, a picked layout or a picked motif fixes it', () => {
    let copy = 0;
    for (let i = 0; i < 300; i++) {
      const sc = solve(pomo(i, null), stubMeasure).scene;
      if (COPY_LAYOUTS.includes(sc.frame)) copy++;
      else expect(ICE_LAYOUTS).toContain(sc.frame);
    }
    expect(Math.abs(copy / 300 - 0.5)).toBeLessThan(0.08);
    for (let i = 0; i < 40; i++) {
      expect(ICE_LAYOUTS).toContain(solve(pomo(i, 'icecream'), stubMeasure).scene.frame);
      expect(COPY_LAYOUTS).toContain(solve(pomo(i, 'photocopy'), stubMeasure).scene.frame);
      const s = pomo(i, null);
      s.pick.motif = 'scribble';
      const sc = solve(s, stubMeasure).scene;
      expect(COPY_LAYOUTS).toContain(sc.frame);
      expect(sc.graphics[0]).toBe('scribble');
      s.pick.motif = null; s.pick.layout = 'stairs';
      expect(solve(s, stubMeasure).scene.frame).toBe('stairs');
      // a picked layout wins over a picked dialect of the other kind (review R6 M4)
      s.pick.dialect = 'photocopy';
      expect(solve(s, stubMeasure).scene.frame).toBe('stairs');
      s.pick.dialect = 'icecream'; s.pick.layout = 'copy-low';
      expect(solve(s, stubMeasure).scene.frame).toBe('copy-low');
    }
  });
  test('the spec carries the dialect, and migration keeps only a known one', () => {
    expect(defaultSpec().pick.dialect).toBeNull();
    expect(migrate({ v: 1, style: 'pomo', pick: { dialect: 'photocopy' } }).pick.dialect).toBe('photocopy');
    expect(migrate({ v: 1, style: 'pomo', pick: { dialect: 'grunge' } }).pick.dialect).toBeNull();
  });
  test('eleven layouts, at least eight per style (spec 8.0); positions per slot (spec 8.5)', () => {
    expect(ICE_LAYOUTS.length + COPY_LAYOUTS.length).toBeGreaterThanOrEqual(8);
    for (const list of Object.values(POMO_POS)) expect(list.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ice cream (spec 8.2)', () => {
  test('thirteen shapes and five ground patterns, every one drawn in 300 shuffles; five to eight shapes a design', () => {
    expect(SHAPE_NAMES.length).toBe(13);
    expect(PATTERN_KINDS).toBe(5);
    const shapes = new Set<string>(), kinds = new Set<number>();
    let tiles = 0;
    for (let i = 0; i < 300; i++) {
      const sc = solve(pomo(i, 'icecream'), stubMeasure).scene;
      const gs = sc.items.filter((g): g is GraphicItem => g.kind === 'graphic' && g.name === 'shape');
      expect(gs.length).toBeGreaterThanOrEqual(5);
      expect(gs.length).toBeLessThanOrEqual(8);
      gs.forEach((g) => shapes.add(String(g.params.shape)));
      sc.items.forEach((g) => { if (g.kind === 'graphic' && g.name === 'pattern') kinds.add(Number(g.params.kind)); });
      if (texts(sc).some((t) => t.part.startsWith('tile'))) tiles++;
    }
    expect([...shapes].sort()).toEqual([...SHAPE_NAMES].sort());
    expect(kinds.size).toBe(5);
    // the second title treatment (letters on tiles) is drawn
    expect(tiles).toBeGreaterThan(20);
  });
  test('no shape or found graphic is drawn over text: every graphic comes before every text item, rule 3 passes', () => {
    const bad: unknown[] = [];
    for (const s of specs({ styles: ['pomo'], n: 100, variants: 'cycle', pick: { dialect: 'icecream' } })) {
      const sc = solve(s, stubMeasure).scene;
      const firstText = sc.items.findIndex((i) => i.kind === 'text');
      const late = sc.items.slice(Math.max(0, firstText)).filter((i) => i.kind === 'graphic');
      if (late.length) bad.push({ spec: s, late: late.map((g) => (g as GraphicItem).name) });
      if (check(sc, [3]).length) bad.push({ spec: s, f: check(sc, [3]) });
    }
    expect(bad, show(bad)).toEqual([]);
  });
  test('the subtitle: one line where it fits at 0.75 of its start size; on two lines never one word alone on the last (review bundle 3 S1)', () => {
    let one = 0, two = 0;
    for (const s of specs({ styles: ['pomo'], n: 200, variants: 'cycle', pick: { dialect: 'icecream' } })) {
      const subs = texts(solve(s, stubMeasure).scene).filter((t) => t.slot === 'subtitle');
      if (!subs.length) continue;
      if (subs.length === 1) { one++; continue; }
      two++;
      if (slotsOf(s.text).subtitle.v.trim().split(/\s+/).length >= 3) expect(subs[subs.length - 1].runs[0].s.trim().split(/\s+/).length, JSON.stringify(s)).toBeGreaterThanOrEqual(2);
    }
    console.log(`ice cream subtitle: ${one} on one line, ${two} on two`);
    expect(one).toBeGreaterThan(two);
    // the case the greedy wrap gets wrong: "system" alone on the second line
    const font = { family: 'Gentium Book Plus', weight: 400, italic: true }, w = (x: string, px: number) => inkW(stubMeasure(x, font, px));
    const text = 'A modular identity system', maxW = w('A modular identity', 100) + 1;
    expect(w(text, 75)).toBeGreaterThan(maxW);
    const greedy = fit(stubMeasure, { text, font, maxW, maxH: 1000, start: 100, min: 20, lh: 1.15, maxLines: 2 })!;
    expect(greedy.lines).toEqual(['A modular identity', 'system']);
    const short = fitShort(stubMeasure, { text, font, maxW, maxH: 1000, start: 100, floor: 75, min: 20, lh: 1.15, maxLines: 2 })!;
    expect(short.lines).toEqual(['A modular', 'identity system']);
    expect(short.size).toBe(100);
    // and one line when it fits at 0.75 of the start
    expect(fitShort(stubMeasure, { text, font, maxW: w(text, 80), maxH: 1000, start: 100, floor: 75, min: 20, lh: 1.15, maxLines: 2 })!.lines).toEqual([text]);
  });
  test('the shapes keep off the caption by one shadow offset (review bundle 3 M4)', () => {
    let caps = 0;
    for (const s of specs({ styles: ['pomo'], n: 60, variants: 'cycle', pick: { dialect: 'icecream' } })) {
      const sc = solve(s, stubMeasure).scene, cap = texts(sc).find((t) => t.slot === 'caption');
      if (!cap) continue;
      caps++;
      const C = bounds(cap.quad), d = sc.w * 0.013;
      for (const g of sc.items) {
        if (g.kind !== 'graphic' || g.layer === 'ground' || g.pass) continue;
        const ok = (g.avoid ?? []).some((q) => { const A = bounds(q); return A.x <= C.x - d + 0.5 && A.y <= C.y - d + 0.5 && A.x + A.w >= C.x + C.w + d - 0.5 && A.y + A.h >= C.y + C.h + d - 0.5; });
        expect(ok, JSON.stringify({ spec: s, g: g.name })).toBe(true);
      }
    }
    expect(caps).toBeGreaterThan(20);
  });
  test('3:4 shapes reach the lower 40% of the page (bundle 1 M1, carried to R6)', () => {
    let low = 0;
    for (let i = 0; i < 100; i++) {
      const s = pomo(i, 'icecream');
      const sc = solve(s, stubMeasure).scene;
      if (sc.transform !== 'none') { low++; continue; }
      const gs = sc.items.filter((g): g is GraphicItem => g.kind === 'graphic' && g.name === 'shape');
      if (gs.some((g) => g.xf!.y > 1440 * 0.6)) low++;
    }
    expect(low).toBe(100);
  });
});

describe('photocopy (spec 8.2)', () => {
  test('ten found graphics, four to six a design, every one in 300 shuffles; the copier pass is the last item, over the type', () => {
    expect(FOUND.length).toBeGreaterThanOrEqual(10);
    for (const f of FOUND) expect(GRAPHICS[f]).toBeDefined();
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const sc = solve(pomo(i, 'photocopy'), stubMeasure).scene;
      expect(sc.graphics.length).toBeGreaterThanOrEqual(4);
      expect(sc.graphics.length).toBeLessThanOrEqual(6);
      sc.graphics.forEach((g) => seen.add(g));
      const last = sc.items[sc.items.length - 1];
      expect(last.kind === 'graphic' && last.name === 'copier' && last.pass).toBe(true);
      // no found graphic is drawn after a text item; the pass is texture, not a graphic over text
      const firstText = sc.items.findIndex((x) => x.kind === 'text');
      expect(sc.items.slice(firstText).filter((x) => x.kind === 'graphic' && !x.pass)).toEqual([]);
    }
    expect([...seen].sort()).toEqual([...FOUND].sort());
  });
  test('every title word its own face: at least two faces where there are two words or more (size and case: the next test)', () => {
    for (let i = 0; i < 200; i++) {
      const sc = solve(pomo(i, 'photocopy', (['1:1', '3:4', '9:16'] as const)[i % 3]), stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const words = texts(sc).filter((t) => t.slot === 'title');
      expect(new Set(words.map((w) => w.font.family + w.font.weight + (w.font.italic ? 'i' : ''))).size, JSON.stringify(sc.layout)).toBeGreaterThanOrEqual(2);
    }
    expect(unitsOf('Signal and noise')).toEqual(['Signal', 'and', 'noise']);
    expect(unitsOf('Eight plain words make a long poster title')).toEqual(['Eight plain', 'words make', 'a long', 'poster title']);
  });
  test('own size and case (review R6 S6): two sizes in at least 90% of designs of two words or more, never one case for every word', () => {
    let many = 0, oneSize = 0;
    const same: unknown[] = [], oneCase: unknown[] = [];
    const caseOf = (t: string) => (t === t.toUpperCase() ? (t === t.toLowerCase() ? '' : 'U') : t === t.toLowerCase() ? 'L' : 'M');
    for (let i = 0; i < 200; i++) {
      const sc = solve(pomo(i, 'photocopy', (['1:1', '3:4', '9:16'] as const)[i % 3]), stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const words = texts(sc).filter((t) => t.slot === 'title' && !t.part.endsWith('b'));
      if (words.length < 2) continue;
      many++;
      if (new Set(words.map((w) => w.size)).size < 2) { oneSize++; same.push({ i, sizes: words.map((w) => w.size) }); }
      const cs = new Set(words.map((w) => caseOf(w.runs[0].s)).filter(Boolean));
      if (cs.size === 1 && !cs.has('M')) oneCase.push({ i, words: words.map((w) => w.runs[0].s) });
    }
    if (same.length) console.log('photocopy designs with one title size:', JSON.stringify(same));
    expect(many).toBeGreaterThan(150);
    expect(oneSize / many).toBeLessThanOrEqual(0.1);
    expect(oneCase, show(oneCase)).toEqual([]);
  });
  test('one word sliced, one boxed, one ghosted in every design of two words or more; the slice never on the boxed word, nor on the ghost from three words (review R6 S4)', () => {
    const bad: unknown[] = [];
    let n = 0;
    for (const s of specs({ styles: ['pomo'], n: 200, variants: 'cycle', pick: { dialect: 'photocopy' } })) {
      const sc = solve(s, stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const P = choosePalette(s), ws = texts(sc).filter((t) => t.slot === 'title');
      const words = ws.filter((t) => !t.part.endsWith('b'));
      if (words.length < 2) continue;
      n++;
      const cut = ws.filter((t) => t.part.endsWith('b')), boxed = words.filter((t) => t.fill === P.paper && !haloOf(t)), hot = words.filter((t) => t.echoes?.length);
      if (cut.length !== 1 || boxed.length !== 1 || hot.length !== 1 || boxed[0].part + 'b' === cut[0].part || (words.length >= 3 && hot[0].part + 'b' === cut[0].part)) bad.push({ spec: s, cut: cut.length, boxed: boxed.length, hot: hot.length });
    }
    expect(n).toBeGreaterThan(100);
    expect(bad, show(bad)).toEqual([]);
  });
  test('the ghost sits clear of the paper halo: offset 0.10 to 0.16 em on each axis, with its own paper halo while the edge is on (review R6 E1)', () => {
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const sc = solve(pomo(i, 'photocopy'), stubMeasure).scene;
      for (const t of texts(sc)) for (const e of t.echoes ?? []) {
        n++;
        for (const d of [e.dx, e.dy]) { expect(d / t.size).toBeGreaterThanOrEqual(GHOST[0] - 1e-9); expect(d / t.size).toBeLessThanOrEqual(GHOST[1] + 1e-9); }
        expect(Math.hypot(e.dx, e.dy) / t.size).toBeGreaterThan(2 * 0.06);
        expect(e.halo).toBe(choosePalette(pomo(i, 'photocopy')).paper);
      }
    }
    expect(n).toBeGreaterThan(50);
  });
  test('no title word has more than 40% of its ink box under later title words, over 200 designs (review R6 S1)', () => {
    const bad: unknown[] = [];
    for (const s of specs({ styles: ['pomo'], n: 200, variants: 'cycle', pick: { dialect: 'photocopy' } })) {
      const sc = solve(s, stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const ws = texts(sc).filter((t) => t.slot === 'title');
      const inks: Ink[] = ws.filter((t) => !t.part.endsWith('b')).map((t) => {
        const mt = stubMeasure(t.runs[0].s, t.font, t.size), b = ws.find((x) => x.part === t.part + 'b');
        return { x: t.xf!.x, y: t.xf!.y, rot: t.xf!.rot, l: mt.left, r: mt.right + (b ? b.runs[0].x : 0), a: mt.ascent, d: mt.descent };
      });
      inks.forEach((k, j) => {
        const c = coverOf(k, inks.slice(j + 1));
        if (c > 0.4) bad.push({ spec: s, word: j, cover: c.toFixed(2) });
      });
    }
    expect(bad, show(bad)).toEqual([]);
  });
  test('a title word runs past the page on one side only, by at most 0.3 em (review bundle 3 M3)', () => {
    let words = 0, over = 0;
    for (const s of specs({ styles: ['pomo'], n: 100, variants: 'cycle', pick: { dialect: 'photocopy' } })) {
      const sc = solve(s, stubMeasure).scene;
      for (const t of texts(sc).filter((x) => x.slot === 'title' && /^word\d+$/.test(x.part))) {
        words++;
        // the two ends of the word's baseline ink, on the canvas (the page may be turned): how far each lies outside it
        const r = t.runs[0], mt = stubMeasure(r.s, t.font, t.size), xf = t.xf!, cs = Math.cos(xf.rot), sn = Math.sin(xf.rot);
        const end = (u: number) => { const X = xf.x + (r.x + u) * cs, Y = xf.y + (r.x + u) * sn; return Math.max(-X, X - sc.w, -Y, Y - sc.h, 0); };
        const L = end(-mt.left), R = end(mt.right), slop = t.size * 0.06 + 1;
        expect(L > slop && R > slop, JSON.stringify({ spec: s, part: t.part, L, R })).toBe(false);
        const o = Math.max(L, R);
        if (o > 1) over++;
        expect(o, JSON.stringify({ spec: s, part: t.part, L, R })).toBeLessThanOrEqual(OVER * t.size + slop);
      }
    }
    console.log(`photocopy title words: ${words}, ${over} run past the page`);
    expect(over).toBeGreaterThan(0);
  });
  test('the copier pass: its dark edges keep off every text item (review R6 S3)', () => {
    for (let i = 0; i < 60; i++) {
      const s = pomo(i, 'photocopy', (['1:1', '3:4', '9:16'] as const)[i % 3]);
      const sc = solve(s, stubMeasure).scene;
      const g = sc.items[sc.items.length - 1] as GraphicItem;
      const ts = texts(sc).map((t) => bounds(t.quad));
      expect(g.keep!.l * sc.w).toBeLessThanOrEqual(Math.max(0, Math.min(...ts.map((b) => b.x))) + 1e-6);
      expect(g.keep!.r * sc.w).toBeLessThanOrEqual(Math.max(0, Math.min(...ts.map((b) => sc.w - b.x - b.w))) + 1e-6);
      expect(g.keep!.t * sc.h).toBeLessThanOrEqual(Math.max(0, Math.min(...ts.map((b) => b.y))) + 1e-6);
    }
    // on a white canvas with every edge on: keep 0 leaves the edge columns as light as the middle, keep 1 darkens them
    const run = (keep: number) => {
      const W = 200, H = 100, d = new Uint8ClampedArray(W * H * 4).fill(255);
      const ctx = { canvas: { width: W, height: H }, getImageData: () => ({ data: d }), putImageData: () => {} } as any;
      const g = { params: { edges: 1, grain: 0.2, streaks: 0, contrast: 1 }, keep: { l: keep, r: keep, t: keep } } as any;
      copier.draw(ctx, g, rng(7), null as any);
      const mean = (x0: number, x1: number, y0 = 50, y1 = 100) => { let t = 0, c = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { t += d[(y * W + x) * 4]; c++; } return t / c; };
      return { left: mean(0, 3), right: mean(W - 3, W), mid: mean(90, 110), top: mean(90, 110, 0, 1) };
    };
    const off = run(0), on = run(1);
    for (const k of ['left', 'right', 'top'] as const) expect(Math.abs(off[k] - off.mid)).toBeLessThan(25);
    expect(on.left).toBeLessThan(on.mid - 60);
    expect(on.right).toBeLessThan(on.mid - 60);
  });
  test('paper edge on: every title word passes contrast (its fill on its paper halo, or paper on its toner box), over 200 seed sets', () => {
    const bad: unknown[] = [];
    let words = 0, haloed = 0, boxed = 0, ghosts = 0, sliced = 0;
    for (const s of specs({ styles: ['pomo'], n: 200, variants: 'cycle', pick: { dialect: 'photocopy' } })) {
      const sc = solve(s, stubMeasure).scene;
      const P = choosePalette(s);
      for (const t of texts(sc).filter((x) => x.slot === 'title')) {
        words++;
        expect(t.waive).toBeUndefined();
        const halo = haloOf(t);
        if (halo) { haloed++; expect(halo).toEqual([P.paper]); expect(contrast(t.fill as string, P.paper!)).toBeGreaterThanOrEqual(needRatio(t.px)); }
        else { boxed++; expect(t.fill).toBe(P.paper); }
        if (t.echoes?.length) ghosts++;
        if (t.part.endsWith('b')) sliced++;
      }
      const f = check(sc, [4]).filter((x) => x.part.startsWith('title'));
      if (f.length) bad.push({ spec: s, f });
    }
    expect(bad, show(bad)).toEqual([]);
    expect(haloed).toBeGreaterThan(words / 2);
    expect(boxed).toBeGreaterThan(50);
    expect(ghosts).toBeGreaterThan(50);
    expect(sliced).toBeGreaterThan(50);
  });
  test('paper edge off (Advanced): no halo, rule 4 waived for the title words only, every other rule still holds', () => {
    const bad: unknown[] = [];
    for (const s of specs({ styles: ['pomo'], n: 30, variants: 'cycle', pick: { dialect: 'photocopy' }, params: { 'pomo.paperEdge': false } })) {
      const sc = solve(s, stubMeasure).scene;
      for (const t of texts(sc)) {
        if (t.slot === 'title' && !t.waive) expect(t.stroke).toBeUndefined();
        if (t.slot !== 'title') expect(t.waive).toBeUndefined();
        if (t.waive) { expect(t.waive).toEqual([4]); expect(t.stroke).toBeUndefined(); }
      }
      const f = check(sc);
      if (f.length) bad.push({ spec: s, f });
    }
    expect(bad, show(bad)).toEqual([]);
  });
  test('the waiver is honoured by rule 4 and by nothing else', () => {
    const s = pomo(3, 'photocopy');
    s.params['pomo.paperEdge'] = false;
    const sc = solve(s, stubMeasure).scene;
    const w = texts(sc).find((t) => t.waive)!;
    expect(w).toBeDefined();
    // make the waived word unreadable: rule 4 stays quiet for it, rule 5 does not
    const broke: Scene = { ...sc, items: sc.items.map((i) => (i === w ? { ...w, fill: sc.ground, px: 1 } : i)) };
    const f = check(broke);
    expect(f.some((x) => x.rule === 4 && x.part === 'title.' + w.part)).toBe(false);
    expect(f.some((x) => x.rule === 5 && x.part === 'title.' + w.part)).toBe(true);
  });
  test('the caption: three copies fading, the faintest still 4.5:1 on the paper; graphics keep off it', () => {
    for (let i = 0; i < 60; i++) {
      for (const mode of ['light', 'dark'] as const) {
        const s = pomo(i, 'photocopy', '1:1', mode), P = choosePalette(s);
        const sc = solve(s, stubMeasure).scene;
        const caps = texts(sc).filter((t) => t.slot === 'caption');
        if (sc.layout === 'fallback') continue;
        expect(caps.length).toBe(3);
        const r = caps.map((t) => contrast(t.fill as string, P.paper!));
        expect(r[0]).toBeGreaterThan(r[1]);
        expect(r[1]).toBeGreaterThan(r[2]);
        expect(r[2]).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('positions per slot (spec 8.5): text.<slot>.pos overrides the stream', () => {
  test('caption on the right edge, info on the left', () => {
    for (let i = 0; i < 30; i++) for (const d of ['icecream', 'photocopy'] as const) {
      const s = pomo(i, d);
      lead(s.text, 'caption').pos = 'right'; lead(s.text, 'info').pos = 'left';
      const sc = solve(s, stubMeasure).scene;
      if (sc.layout === 'fallback' || sc.transform !== 'none') continue;
      const cap = bounds(texts(sc).find((t) => t.slot === 'caption')!.quad), info = bounds(texts(sc).find((t) => t.slot === 'info')!.quad);
      expect(cap.x + cap.w / 2, d).toBeGreaterThan(540);
      if (d === 'photocopy' || sc.frame !== 'title-side') expect(info.x + info.w / 2, d + ' ' + sc.frame).toBeLessThan(540);
    }
  });
  test('9.2 holds with each position forced, both dialects', () => {
    const bad: unknown[] = [];
    for (const [slot, list] of Object.entries(POMO_POS)) for (const p of list) for (const d of ['icecream', 'photocopy'] as const) {
      for (let i = 0; i < 6; i++) for (const f of ['1:1', '3:4', '9:16'] as const) {
        const s = { ...pomo(i, d, f), seeds: seedSet(i) };
        lead(s.text, slot as Slot).pos = p;
        const sc = solve(s, stubMeasure).scene;
        const fl = check(sc);
        if (fl.length || sc.layout === 'fallback') bad.push({ slot, p, d, f, layout: sc.layout, fl });
      }
    }
    expect(bad, show(bad)).toEqual([]);
  });
});

describe('the pixel check (review R6 S2)', () => {
  test('a blend of three declared colours passes only on a photocopy Scene; elsewhere a colour inside their triangle is stray', () => {
    const red = [255, 0, 0], green = [0, 255, 0], blue = [0, 0, 255], allowed = [red, green, blue];
    const inside = [85, 85, 85];   // the triangle's centre: on no pair's segment
    expect(blendDist(inside, allowed, false)).toBeGreaterThan(6);
    expect(blendDist(inside, allowed, true)).toBeLessThanOrEqual(6);
    // a colour off the triangle is stray either way; a blend of two passes either way
    expect(blendDist([200, 200, 200], allowed, true)).toBeGreaterThan(6);
    expect(blendDist([128, 127, 0], allowed, false)).toBeLessThanOrEqual(6);
  });
});
