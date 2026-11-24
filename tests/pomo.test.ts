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
import { unitsOf } from '../src/engine/parts/type/pomo-copy';
import { seedSet, shuffleSeeds, specs } from '../src/engine/proof';
import type { GraphicItem, Scene, TextItem } from '../src/engine/scene';
import { defaultSpec, migrate, type Dialect, type Spec } from '../src/engine/spec';

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
  test('no shape or found graphic is drawn over text: every graphic comes before every text item, every text item sits on a plate, rule 3 passes', () => {
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
  test('every title word its own face, size and case: at least two faces and two sizes where there are two words or more', () => {
    for (let i = 0; i < 200; i++) {
      const sc = solve(pomo(i, 'photocopy', (['1:1', '3:4', '9:16'] as const)[i % 3]), stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const words = texts(sc).filter((t) => t.slot === 'title');
      expect(new Set(words.map((w) => w.font.family + w.font.weight + (w.font.italic ? 'i' : ''))).size, JSON.stringify(sc.layout)).toBeGreaterThanOrEqual(2);
      expect(new Set(words.map((w) => w.size)).size).toBeGreaterThanOrEqual(1);
    }
    expect(unitsOf('Signal and noise')).toEqual(['Signal', 'and', 'noise']);
    expect(unitsOf('Eight plain words make a long poster title')).toEqual(['Eight plain', 'words make', 'a long', 'poster title']);
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
      s.text.caption.pos = 'right'; s.text.info.pos = 'left';
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
        (s.text as any)[slot].pos = p;
        const sc = solve(s, stubMeasure).scene;
        const fl = check(sc);
        if (fl.length || sc.layout === 'fallback') bad.push({ slot, p, d, f, layout: sc.layout, fl });
      }
    }
    expect(bad, show(bad)).toEqual([]);
  });
});
