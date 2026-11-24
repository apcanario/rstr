/** Row R7: the marks layer of spec 7.2 on the Scene (stub measure). Pixels are checked in smoke. */
import { describe, expect, test } from 'vitest';
import { check } from '../src/engine/invariants';
import { solve } from '../src/engine/layout';
import { behindMark, labelFloor, labelOf, labelsOf, LABEL_SOURCES, markOverlaps, MARKS_OF, marksOnShapes, platesOf, sourceValues } from '../src/engine/marks';
import { paint } from '../src/engine/paint';
import type { Ctx } from '../src/engine/graphics/types';
import { stubMeasure } from '../src/engine/measure';
import { runIndependence, specs } from '../src/engine/proof';
import type { GraphicItem, Scene } from '../src/engine/scene';
import { bounds, overlaps, type Quad } from '../src/engine/geom';
import { defaultSpec, seedCode, STYLE_IDS, type Spec } from '../src/engine/spec';

const marksOf = (sc: Scene) => sc.items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.layer === 'mark');
const show = (s: Spec, why: unknown) => JSON.stringify({ why, spec: s });
/** The free marks of a Scene (not the containers), by kind: a bracket is four items of one mark. */
const freeKinds = (sc: Scene) => marksOf(sc).map((g) => g.params.mark).filter((k): k is string => typeof k === 'string');

/** A context that draws nothing and records every string written with fillText or strokeText (review R7 M2). */
function recorder(w: number, h: number): { ctx: Ctx; texts: string[] } {
  const texts: string[] = [], store: Record<string | symbol, unknown> = { canvas: { width: w, height: h } };
  const noop = () => undefined;
  const ctx = new Proxy(store, {
    get(o, k) {
      if (k === 'fillText' || k === 'strokeText') return (s: string) => { texts.push(String(s)); };
      if (k === 'measureText') return () => ({ width: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k in o) return o[k];
      return noop;
    },
    set(o, k, v) { o[k] = v; return true; },
  }) as unknown as Ctx;
  return { ctx, texts };
}

describe('marks (spec 7.2)', () => {
  test('off adds nothing: the Scene is the one drawn before marks existed', () => {
    for (const s of specs({ n: 6, variants: 'cycle' })) expect(marksOf(solve(s, stubMeasure).scene)).toHaveLength(0);
  });

  for (const level of ['light', 'full'] as const) {
    for (const style of STYLE_IDS) {
      test(`${level}, ${style}: no mark on a text item over 200 seeds; 9.2 still passes; only the style's marks`, () => {
        let n = 0, total = 0, few = 0, onShape = 0;
        // 200 seed sets in each format, light and dark alternating with the seed (every text variant in turn)
        for (const s of specs({ styles: [style], n: 200, variants: 'cycle', marks: level, modes: ['light'] })) {
          if (n % 2) s.mode = 'dark';
          n++;
          const sc = solve(s, stubMeasure).scene, ms = marksOf(sc);
          total += ms.length;
          const over = markOverlaps(sc);
          expect(over, show(s, over)).toEqual([]);
          // every micro label reads at 3:1 on everything behind it (review bundle 3 M2)
          const lowLabels = labelFloor(sc);
          expect(lowLabels, show(s, lowLabels)).toEqual([]);
          // a free mark sits on shape ink only where the bare spots gave fewer than three (review bundle 3 M1)
          const sh = marksOnShapes(sc);
          expect(sh.onShape, show(s, sh)).toBeLessThanOrEqual(Math.max(0, 3 - sh.bare));
          onShape += sh.onShape;
          const f = check(sc);
          expect(f, show(s, f)).toEqual([]);
          for (const g of ms) {
            const k = String(g.params.kind);
            if (!['bar', 'card', 'label'].includes(k)) expect(MARKS_OF[style], show(s, k)).toContain(k);
            // inside the canvas, never on text: the box is the mark's whole extent
            expect(g.box.x >= 0 && g.box.y >= 0 && g.box.x + g.box.w <= sc.w && g.box.y + g.box.h <= sc.h, show(s, g.box)).toBe(true);
          }
          // three or four free marks (spec 7.2), each kind at most once (review R7 S2)
          const kinds = freeKinds(sc), distinct = new Set(kinds);
          expect(distinct.size, show(s, 'no mark at all')).toBeGreaterThan(0);
          for (const k of distinct) expect(marksOf(sc).filter((g) => g.params.mark === k && g.params.kind !== 'bar').length, show(s, `${k} twice`)).toBeLessThanOrEqual(1);
          expect(distinct.size).toBeLessThanOrEqual(4);
          if (distinct.size < 3) few++;
        }
        expect(n).toBe(600);
        // light is three or four marks (spec 7.2): fewer only where the page has no room, in at most 5% of designs
        // per style (review R7 S1; Brutalist's ruled page is the tight one)
        expect(few / n, `${few} of ${n} designs got fewer than three marks`).toBeLessThanOrEqual(0.05);
        expect(total).toBeGreaterThan(n * 2.5);
        console.log(`marks ${level} ${style}: ${total} mark items in ${n} designs, ${few} with fewer than three free marks, ${onShape} free marks on shape ink`);
      }, 240000);
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

  test('what the marks draw as text is only labels of allowed sources (a recording context, review R7 M2)', () => {
    let strings = 0;
    for (const level of ['light', 'full'] as const) for (const s of specs({ n: 30, variants: 'cycle', marks: level })) {
      const sc = solve(s, stubMeasure).scene, rec = recorder(sc.w, sc.h);
      paint(rec.ctx, sc, null, { only: (i) => i.kind === 'graphic' && i.layer === 'mark', noGround: true });
      const parts = new Set(LABEL_SOURCES.map((src) => labelOf([src], s, sc.palette)));
      for (const t of rec.texts) {
        strings++;
        for (const p of t.split(' · ')) expect(parts.has(p), show(s, { drawn: t, part: p })).toBe(true);
      }
    }
    expect(strings).toBeGreaterThan(100);
  }, 120000);

  test('the recording check finds a mark that draws its own words', () => {
    const s = { ...defaultSpec(), marks: 'full' as const }, sc = solve(s, stubMeasure).scene, rec = recorder(sc.w, sc.h);
    const g = marksOf(sc).find((x) => typeof x.params.label === 'string')!;
    const forged: Scene = { ...sc, items: sc.items.map((i) => (i === g ? { ...g, params: { ...g.params, label: 'LISBOA 38.7N' } } : i)) };
    paint(rec.ctx, forged, null, { only: (i) => i.kind === 'graphic' && i.layer === 'mark', noGround: true });
    const parts = new Set(LABEL_SOURCES.map((src) => labelOf([src], s, sc.palette)));
    expect(rec.texts.some((t) => t.split(' · ').some((p) => !parts.has(p)))).toBe(true);
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

  test('the overlap check finds a mark on the plate a text item is set on, clear of the text (review bundle 3 S2)', () => {
    let tried = 0;
    for (const s of specs({ styles: ['brutal', 'pomo', 'vapor'], n: 6, variants: 'cycle', marks: 'light', modes: ['light'] })) {
      const sc = solve(s, stubMeasure).scene, g = marksOf(sc).find((x) => x.params.kind !== 'card');
      if (!g) continue;
      const texts = sc.items.filter((i) => i.kind === 'text');
      for (const p of platesOf(sc.items, sc)) {
        // a 4 x 4 mark on a corner of the plate that no text item touches
        const B = bounds(p.quad), q: Quad = [[B.x, B.y], [B.x + 4, B.y], [B.x + 4, B.y + 4], [B.x, B.y + 4]];
        if (!overlaps(p.quad, q) || texts.some((t) => overlaps(t.quad, q))) continue;
        tried++;
        const moved: Scene = { ...sc, items: [...sc.items, { ...g, box: { x: B.x, y: B.y, w: 4, h: 4 }, quad: q }] };
        expect(markOverlaps(moved).some((x) => x.includes('plate')), show(s, p.quad)).toBe(true);
      }
    }
    expect(tried).toBeGreaterThan(10);
  });

  test('the label floor finds a micro label in a colour that does not read on what is behind it (review bundle 3 M2)', () => {
    let tried = 0;
    for (const s of specs({ n: 8, variants: 'cycle', marks: 'full', modes: ['light'] })) {
      const sc = solve(s, stubMeasure).scene, g = marksOf(sc).find((x) => x.params.kind === 'label');
      if (!g) continue;
      tried++;
      const forged: Scene = { ...sc, items: sc.items.map((i) => (i === g ? { ...g, colours: { ...g.colours, c: behindMark(sc, g)[0] } } : i)) };
      expect(labelFloor(forged).length, show(s, g.box)).toBeGreaterThan(0);
    }
    expect(tried).toBeGreaterThan(3);
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
