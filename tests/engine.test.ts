import { describe, expect, test } from 'vitest';
import { contrast, firstInk, needRatio } from '../src/engine/colour';
import { contains, overlaps, rectQuad } from '../src/engine/geom';
import { check, OUTLINE_MIN } from '../src/engine/invariants';
import { mkGraphic, mkRect, mkText } from '../src/engine/items';
import { layout } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { mix, rng } from '../src/engine/rng';
import type { Scene } from '../src/engine/scene';
import { defaultSpec, migrate, validate } from '../src/engine/spec';
import { fit } from '../src/engine/text';

describe('seeded generator', () => {
  test('same seed, same stream; values in [0, 1)', () => {
    const a = rng(42), b = rng(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(rng(43)()).not.toBe(rng(42)());
  });
  test('matches the spike generator', () => {
    // first draw of mulberry32(1) as the spike's engine.js computes it
    expect(rng(1)()).toBeCloseTo(0.6270739405881613, 12);
  });
  test('mix gives distinct streams', () => {
    expect(new Set([1, 2, 3, 4].map((k) => mix(99, k))).size).toBe(4);
  });
});

describe('contrast maths', () => {
  test('known ratios', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(contrast('#767676', '#FFFFFF')).toBeGreaterThan(4.5);
  });
  test('large text needs 3:1, small 4.5:1', () => {
    expect(needRatio(60)).toBe(3);
    expect(needRatio(59)).toBe(4.5);
  });
  test('firstInk falls back when the first choice fails', () => {
    expect(firstInk(['#E4002B', '#161616'], ['#F2EFE8'], 4.5)).toBe('#161616');
  });
});

describe('spec schema', () => {
  test('migrates the spike shape', () => {
    const s = migrate({ style: 'swiss', format: '1:1', seeds: { layout: 5, colour: 6, motif: 7 }, motif: 'topo', palette: 4, layout: 1, text: { title: { on: true, v: 'Hi' } } });
    expect(s.v).toBe(1);
    expect(s.seeds).toEqual({ layout: 5, colour: 6, graphic: 7, type: 4 });
    expect(s.pick).toEqual({ palette: '4', pairing: null, motif: 'topo', layout: '1', dialect: null });
    expect(s.text.title.v).toBe('Hi');
    expect(s.text.caption.on).toBe(true);
  });
  test('never throws, ignores unknown fields, takes defaults for bad values', () => {
    for (const raw of [null, 3, 'nope', '{bad json', [], { style: 'gothic', format: '2:3', seeds: 'x', text: 5, extra: { a: 1 } }]) {
      const s = migrate(raw);
      expect(s.v).toBe(1);
      expect(s.style).toBe('swiss');
      expect(s.format).toBe('3:4');
      expect((s as any).extra).toBeUndefined();
    }
    expect(migrate(JSON.stringify(defaultSpec())).seeds.type).toBe(4);
  });
  test('validate names what is wrong', () => {
    expect(validate(defaultSpec())).toEqual([]);
    expect(validate({ v: 0 }).length).toBeGreaterThan(2);
  });
});

describe('geometry', () => {
  const a = rectQuad({ x: 0, y: 0, w: 10, h: 10 });
  test('overlap and containment', () => {
    expect(overlaps(a, rectQuad({ x: 5, y: 5, w: 10, h: 10 }))).toBe(true);
    expect(overlaps(a, rectQuad({ x: 10, y: 0, w: 10, h: 10 }))).toBe(false);
    expect(contains(a, rectQuad({ x: 2, y: 2, w: 3, h: 3 }))).toBe(true);
    expect(contains(a, rectQuad({ x: 8, y: 2, w: 3, h: 3 }))).toBe(false);
  });
});

describe('text fitting', () => {
  const font = { family: 'Inter Tight', weight: 800 };
  test('largest size that fits, null under the minimum, shortened when forced', () => {
    const f = fit(stubMeasure, { text: 'Signal and noise', font, maxW: 500, maxH: 300, start: 200, min: 20, lh: 1, maxLines: 3 })!;
    expect(f.width).toBeLessThanOrEqual(500);
    expect(f.height).toBeLessThanOrEqual(300);
    expect(fit(stubMeasure, { text: 'Signal and noise', font, maxW: 500, maxH: 300, start: f.size + 2, min: 20, lh: 1, maxLines: 3 })!.size).toBe(f.size);
    const long = 'word '.repeat(80);
    expect(fit(stubMeasure, { text: long, font, maxW: 300, maxH: 60, start: 40, min: 30, lh: 1, maxLines: 1 })).toBeNull();
    const g = fit(stubMeasure, { text: long, font, maxW: 300, maxH: 60, start: 40, min: 30, lh: 1, maxLines: 1, force: true })!;
    expect(g.shortened).toBe(true);
    expect(g.lines[0].endsWith('…')).toBe(true);
    expect(g.width).toBeLessThanOrEqual(300);
  });
});

describe('the 9.2 checker catches each rule', () => {
  const m = stubMeasure, font = { family: 'Inter Tight', weight: 400 };
  const base = (items: Scene['items'], format = '3:4'): Scene => ({ w: 1080, h: format === '9:16' ? 1920 : 1440, style: 'swiss', format, palette: 'p', pairing: 't', layout: 'c0', frame: 'graphic-above', transform: 'none', graphics: [], ground: '#FFFFFF', items, fonts: [], faces: [] });
  const txt = (x: number, y: number, ink = '#000000', size = 40) => mkText(m, { slot: 'title', part: 'a' + x + y, font, size, runs: [{ s: 'Hello', x, y }], fill: ink, ink: [ink], min: 30 });
  test('a clean scene passes', () => expect(check(base([txt(100, 200)]))).toEqual([]));
  test('1: off the canvas, and into a story zone', () => {
    expect(check(base([txt(1050, 200)])).map((f) => f.rule)).toContain(1);
    expect(check(base([txt(100, 250)], '9:16')).map((f) => f.rule)).toContain(1);
  });
  test('2: overlapping text', () => expect(check(base([txt(100, 200), txt(120, 210)])).map((f) => f.rule)).toContain(2));
  test('3: a graphic or rect drawn over text', () => {
    const t = txt(100, 200);
    expect(check(base([t, mkGraphic('disc', { x: 0, y: 0, w: 400, h: 400 }, 1, 0, {}, ['#000000'])])).map((f) => f.rule)).toContain(3);
    expect(check(base([t, mkRect({ x: 90, y: 150, w: 50, h: 60 }, '#000000')])).map((f) => f.rule)).toContain(3);
  });
  test('4: contrast against the ground, a plate and a graphic', () => {
    expect(check(base([txt(100, 200, '#EEEEEE')])).map((f) => f.rule)).toContain(4);
    expect(check(base([mkRect({ x: 50, y: 100, w: 400, h: 200 }, '#111111', { plate: true }), txt(100, 200, '#FFFFFF')]))).toEqual([]);
    expect(check(base([mkGraphic('disc', { x: 0, y: 0, w: 400, h: 400 }, 1, 0, {}, ['#222222']), txt(100, 200)])).map((f) => f.rule)).toContain(4);
  });
  test('4: ink is derived from the paint, not from what the item claims', () => {
    // a fill that fails on white, claimed ink that passes: the checker reads the fill
    const lie = mkText(m, { slot: 'title', part: 'lie', font, size: 80, runs: [{ s: 'Hello', x: 100, y: 200 }], fill: '#F0F0F0', ink: ['#000000'], min: 30 });
    expect(check(base([lie])).map((f) => f.rule)).toContain(4);
    // a gradient fill with one failing stop fails
    const grad = mkText(m, { slot: 'title', part: 'grad', font, size: 80, runs: [{ s: 'Hello', x: 100, y: 200 }], fill: { kind: 'linear', em: true, x0: 0, y0: -0.75, x1: 0, y1: 0, stops: [[0, '#000000'], [1, '#F6EBFF']] }, ink: ['#000000'], min: 30 });
    expect(check(base([grad])).map((f) => f.rule)).toContain(4);
    // the same failing fill inside a dark outline of 4% of the size passes: the outline carries it
    const ok = mkText(m, { slot: 'title', part: 'ok', font, size: 100, runs: [{ s: 'Hello', x: 100, y: 200 }], fill: '#F6EBFF', stroke: { paint: '#000000', width: 100 * OUTLINE_MIN }, ink: ['#000000'], min: 30 });
    expect(check(base([ok]))).toEqual([]);
    // an outline thinner than OUTLINE_MIN does not: the fill is checked
    const thin = mkText(m, { slot: 'title', part: 'thin', font, size: 100, runs: [{ s: 'Hello', x: 100, y: 200 }], fill: '#F6EBFF', stroke: { paint: '#000000', width: 2.2 }, ink: ['#000000'], min: 30 });
    expect(check(base([thin])).map((f) => f.rule)).toContain(4);
  });
  test('5: under the minimum size', () => expect(check(base([txt(100, 200, '#000000', 20)])).map((f) => f.rule)).toContain(5));
});

describe('layout', () => {
  test('the same spec gives the same Scene', () => {
    for (const style of ['swiss', 'pomo', 'brutal', 'vapor'] as const) {
      const s = defaultSpec({ layout: 9, colour: 8, graphic: 7, type: 6 });
      s.style = style;
      expect(JSON.stringify(layout(s, stubMeasure))).toBe(JSON.stringify(layout(structuredClone(s), stubMeasure)));
    }
  });  test('the Scene names the layout it drew, and a picked layout is the one drawn (the Layout lock shows it)', async () => {
    const { STYLES } = await import('../src/engine/styles');
    for (const style of ['swiss', 'pomo', 'brutal', 'vapor'] as const) {
      const seen = new Set<string>();
      // 120 seeds: Postmodern's eleven layouts sit in two dialects (R6)
      for (let i = 0; i < 120; i++) {
        const s = defaultSpec({ layout: 1000 + i, colour: 8, graphic: 7, type: 6 });
        s.style = style;
        const sc = layout(s, stubMeasure);
        expect(STYLES[style].layouts).toContain(sc.frame);
        seen.add(sc.frame);
      }
      expect(seen.size, style).toBe(STYLES[style].layouts.length);
      for (const id of STYLES[style].layouts) {
        const s = defaultSpec({ layout: 5, colour: 8, graphic: 7, type: 6 });
        s.style = style; s.pick.layout = id;
        const sc = layout(s, stubMeasure);
        if (sc.layout !== 'fallback') expect(sc.frame).toBe(id);
      }
    }
  });
});

describe('fallback', () => {
  test('text far too long for any candidate still gives a legal design', async () => {
    const { solve } = await import('../src/engine/layout');
    const long = 'Antidisestablishmentarianism '.repeat(14).trim();
    let fallbacks = 0;
    for (const style of ['swiss', 'pomo', 'brutal', 'vapor'] as const)
      for (const format of ['1:1', '3:4', '9:16'] as const)
        for (let i = 0; i < 6; i++) {
          const s = defaultSpec({ layout: 100 + i, colour: 200 + i, graphic: 300 + i, type: 400 + i });
          s.style = style; s.format = format;
          s.text.title.v = long; s.text.subtitle.v = long; s.text.caption.v = long;
          s.text.info.v = [{ k: long, v: long }, { k: 'When', v: long }, { k: 'X', v: 'Y' }];
          const r = solve(s, stubMeasure);
          if (r.scene.layout === 'fallback') fallbacks++;
          expect(check(r.scene), JSON.stringify(s)).toEqual([]);
        }
    expect(fallbacks).toBeGreaterThan(0);
  });
});
