/** Row R7: the marks layer of spec 7.2 on the Scene (stub measure). Pixels are checked in smoke. */
import { describe, expect, test } from 'vitest';
import { check } from '../src/engine/invariants';
import { solve } from '../src/engine/layout';
import { labelOf, labelsOf, LABEL_SOURCES, markOverlaps, MARKS_OF, sourceValues } from '../src/engine/marks';
import { stubMeasure } from '../src/engine/measure';
import { runIndependence, specs } from '../src/engine/proof';
import type { GraphicItem, Scene } from '../src/engine/scene';
import { defaultSpec, seedCode, STYLE_IDS, type Spec } from '../src/engine/spec';

const marksOf = (sc: Scene) => sc.items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.layer === 'mark');
const show = (s: Spec, why: unknown) => JSON.stringify({ why, spec: s });

describe('marks (spec 7.2)', () => {
  test('off adds nothing: the Scene is the one drawn before marks existed', () => {
    for (const s of specs({ n: 6, variants: 'cycle' })) expect(marksOf(solve(s, stubMeasure).scene)).toHaveLength(0);
  });

  for (const level of ['light', 'full'] as const) {
    for (const style of STYLE_IDS) {
      test(`${level}, ${style}: no mark on a text item over 200 seeds; 9.2 still passes; only the style's marks`, () => {
        let n = 0, total = 0, few = 0;
        // 200 seed sets in each format, light and dark alternating with the seed (every text variant in turn)
        for (const s of specs({ styles: [style], n: 200, variants: 'cycle', marks: level, modes: ['light'] })) {
          if (n % 2) s.mode = 'dark';
          n++;
          const sc = solve(s, stubMeasure).scene, ms = marksOf(sc);
          total += ms.length;
          const over = markOverlaps(sc);
          expect(over, show(s, over)).toEqual([]);
          const f = check(sc);
          expect(f, show(s, f)).toEqual([]);
          for (const g of ms) {
            const k = String(g.params.kind);
            if (!['bar', 'card', 'label'].includes(k)) expect(MARKS_OF[style], show(s, k)).toContain(k);
            // inside the canvas, never on text: the box is the mark's whole extent
            expect(g.box.x >= 0 && g.box.y >= 0 && g.box.x + g.box.w <= sc.w && g.box.y + g.box.h <= sc.h, show(s, g.box)).toBe(true);
          }
          if (ms.length < 3) few++;
        }
        expect(n).toBe(600);
        // three or four marks where there is room: most designs find room for three
        expect(few / n, `${few} of ${n} designs got fewer than three marks`).toBeLessThan(0.35);
        expect(total).toBeGreaterThan(n * 2.5);
      }, 120000);
    }
  }

  test('full adds the containers: info in a chamfered card under the info text, an underline bar under the title', () => {
    let cards = 0, bars = 0, n = 0;
    for (const s of specs({ n: 40, variants: 'cycle', marks: 'full', modes: ['light'] })) {
      n++;
      const sc = solve(s, stubMeasure).scene;
      const card = marksOf(sc).find((g) => g.params.kind === 'card');
      if (card) {
        cards++;
        const i = sc.items.indexOf(card), info = sc.items.findIndex((x) => x.kind === 'text' && x.slot === 'info');
        // under the info text, keeping off its ink
        expect(i).toBeLessThan(info);
        expect(card.avoid?.length).toBe(sc.items.filter((x) => x.kind === 'text' && x.slot === 'info').length);
      }
      if (marksOf(sc).some((g) => g.params.kind === 'bar' && g.box.h === 4)) bars++;
    }
    expect(cards, `cards in ${cards} of ${n}`).toBeGreaterThan(n * 0.2);
    expect(bars, `underline bars in ${bars} of ${n}`).toBeGreaterThan(n * 0.3);
  });

  test('micro labels say only what the spec holds (a list of allowed sources)', () => {
    let labels = 0;
    for (const level of ['light', 'full'] as const) for (const s of specs({ n: 30, variants: 'cycle', marks: level })) {
      const sc = solve(s, stubMeasure).scene;
      for (const l of labelsOf(sc, s)) {
        labels++;
        expect(l.ok, show(s, l)).toBe(true);
        // and every word of it is a word of an allowed source's value, or a source's name
        const v = sourceValues(s, sc.palette), words = new Set([...Object.values(v).flatMap((x) => x.split(/\s+/)), 'SEED', '·']);
        for (const w of l.label.split(/\s+/)) expect(words.has(w), show(s, { w, label: l.label })).toBe(true);
      }
    }
    expect(labels).toBeGreaterThan(100);
  });

  test('the label check rejects what the spec does not hold', () => {
    const s = defaultSpec();
    expect(LABEL_SOURCES).toEqual(['app', 'seed', 'format', 'style', 'palette', 'counter']);
    expect(labelOf(['seed'], s, 'x')).toBe('SEED ' + seedCode(s.seeds));
    const sc = solve({ ...s, marks: 'light' }, stubMeasure).scene;
    const g = marksOf(sc).find((x) => typeof x.params.label === 'string');
    if (g) {
      const forged: Scene = { ...sc, items: sc.items.map((i) => (i === g ? { ...g, params: { ...g.params, label: 'LISBOA 38.7N' } } : i)) };
      expect(labelsOf(forged, s).some((l) => !l.ok)).toBe(true);
      const bad: Scene = { ...sc, items: sc.items.map((i) => (i === g ? { ...g, params: { ...g.params, src: 'date' } } : i)) };
      expect(labelsOf(bad, s).some((l) => !l.ok)).toBe(true);
    }
  });

  test('the overlap check finds a mark on text', () => {
    const s = { ...defaultSpec(), marks: 'light' as const };
    const sc = solve(s, stubMeasure).scene, t = sc.items.find((i) => i.kind === 'text')!;
    const g = marksOf(sc)[0];
    const moved: Scene = { ...sc, items: [...sc.items, { ...g, quad: t.quad }] };
    expect(markOverlaps(moved).length).toBeGreaterThan(0);
  });

  test('9.3 with marks: the colour seed and the mode move no mark; the graphic seed no text box', () => {
    for (const level of ['light', 'full'] as const) {
      const r = runIndependence(stubMeasure, { n: 6, variants: 'cycle', marks: level });
      expect(r.failures.map((f) => show(f.spec, f.facet))).toEqual([]);
    }
  }, 120000);

  test('the same spec gives the same marks', () => {
    for (const s of specs({ n: 4, variants: 'cycle', marks: 'full' })) {
      expect(JSON.stringify(solve(s, stubMeasure).scene)).toBe(JSON.stringify(solve(structuredClone(s), stubMeasure).scene));
    }
  });
});
