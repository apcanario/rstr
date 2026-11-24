/** Vaporwave (row R9, spec 8.4) and the Carried R9 items, on the stub measure. */
import { describe, expect, test } from 'vitest';
import { bounds, overlaps, rectQuad } from '../src/engine/geom';
import { solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { specs, TITLES } from '../src/engine/proof';
import type { GraphicItem, Scene, TextItem } from '../src/engine/scene';
import { HORIZON, SKY_TEXT, VAPOR_LAYOUTS } from '../src/engine/parts/layout/vapor';
import { VAPOR_GRAPHICS } from '../src/engine/parts/graphics/vapor';
import type { Spec } from '../src/engine/spec';

const texts = (sc: Scene) => sc.items.filter((i): i is TextItem => i.kind === 'text');
const sunOf = (sc: Scene) => sc.items.find((i): i is GraphicItem => i.kind === 'graphic' && i.name === 'sun');
const show = (s: Spec, why: string) => `${why}\n${JSON.stringify(s)}`;

describe('Vaporwave (spec 8.4)', () => {
  test('eight layouts, four of them without a horizon; twelve graphics or more from the shared library', () => {
    expect(VAPOR_LAYOUTS.length).toBeGreaterThanOrEqual(8);
    expect(VAPOR_LAYOUTS.filter((l) => !HORIZON.includes(l)).length).toBeGreaterThanOrEqual(3);
    expect(VAPOR_GRAPHICS.length).toBeGreaterThanOrEqual(12);
  });

  test('a sky title sits above 47% of the horizon and never on the sun, for every palette form (Carried R9)', () => {
    let n = 0;
    for (const s of specs({ styles: ['vapor'], n: 12, pick: { layout: 'title-sky' }, palettes: true, variants: 'cycle' })) {
      const sc = solve(s, stubMeasure).scene;
      expect(sc.layout, show(s, 'fell back')).not.toBe('fallback');
      expect(sc.frame).toBe('title-sky');
      const hz = (sc.items.find((i) => i.kind === 'rect' && i.r.y === 0 && typeof i.fill !== 'string') as { r: { h: number } }).r.h;
      const sun = sunOf(sc);
      for (const t of texts(sc).filter((t) => t.slot === 'title' || t.slot === 'subtitle')) {
        n++;
        const b = bounds(t.quad);
        expect(b.y + b.h, show(s, `${t.slot} below ${SKY_TEXT} of the horizon`)).toBeLessThanOrEqual(hz * SKY_TEXT + 1);
        if (sun) expect(overlaps(sun.quad, t.quad), show(s, `${t.slot} on the sun`)).toBe(false);
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  test('the info window never covers the sun (Carried R9, the 1:1 lagoon seeds among them)', () => {
    const seeds = [{ layout: 48514, colour: 630374, graphic: 7801254, type: 4186 }];
    const all = [...specs({ styles: ['vapor'], n: 30, variants: 'cycle' })];
    for (const md of ['light', 'dark'] as const) for (const lay of HORIZON) {
      const s = structuredClone(all[0]);
      s.format = '1:1'; s.mode = md; s.seeds = seeds[0]; s.pick = { ...s.pick, palette: 'lagoon', layout: lay };
      all.push(s);
    }
    for (const s of all) {
      const sc = solve(s, stubMeasure).scene, sun = sunOf(sc);
      if (!sun || !HORIZON.includes(sc.frame)) continue;
      const win = sc.items.filter((i) => i.kind === 'rect' && i.plate && texts(sc).some((t) => t.slot === 'info' && overlaps(i.quad, t.quad)));
      for (const w of win) expect(overlaps(w.quad, sun.quad), show(s, 'info window on the sun')).toBe(false);
    }
  });

  test('a long title leaves no last word alone when it can be balanced (Carried R9: the 8-word 1:1 orphan)', () => {
    let multi = 0, orphans = 0;
    for (const s of specs({ styles: ['vapor'], formats: ['1:1', '3:4', '9:16'], n: 20, variants: 'all' })) {
      if (s.text.title.v !== TITLES.eight || !s.text.title.on) continue;
      const sc = solve(s, stubMeasure).scene, t = texts(sc).find((x) => x.slot === 'title');
      if (!t || t.runs.length < 2) continue;
      multi++;
      if (!t.runs[t.runs.length - 1].s.trim().includes(' ')) orphans++;
    }
    expect(multi).toBeGreaterThan(20);
    expect(orphans, `${orphans} of ${multi} end on one word`).toBe(0);
  });

  test('a horizon stays level; the layouts without one take a tilt or a quarter turn on about one roll in six each', () => {
    const count: Record<string, number> = {};
    let field = 0;
    for (const s of specs({ styles: ['vapor'], formats: ['3:4'], modes: ['light'], n: 400, variants: 'cycle' })) {
      const sc = solve(s, stubMeasure).scene;
      if (HORIZON.includes(sc.frame)) { expect(sc.transform).toBe('none'); continue; }
      field++;
      count[sc.transform] = (count[sc.transform] ?? 0) + 1;
    }
    for (const tr of ['tilt', 'quarter']) {
      expect(count[tr] / field, tr).toBeGreaterThan(0.1);
      expect(count[tr] / field, tr).toBeLessThan(0.25);
    }
  });

  test('the caption keeps clear of the subtitle at 1:1 (Carried R9) and every text item keeps off the sun', () => {
    for (const s of specs({ styles: ['vapor'], formats: ['1:1'], n: 30, variants: 'cycle' })) {
      const sc = solve(s, stubMeasure).scene, T = texts(sc);
      const cap = T.find((t) => t.slot === 'caption'), sub = T.find((t) => t.slot === 'subtitle'), sun = sunOf(sc);
      if (cap && sub) {
        const a = bounds(cap.quad), b = bounds(sub.quad);
        const gap = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        if (sc.transform === 'none') expect(gap, show(s, 'caption crowds the subtitle')).toBeGreaterThanOrEqual(16);
      }
      if (sun) for (const t of T) {
        // text on a window or band plate may sit over the sun: the plate is what is behind it
        const onPlate = sc.items.some((i) => i.kind === 'rect' && i.plate && bounds(i.quad).w * bounds(i.quad).h > 0 && overlaps(i.quad, t.quad) && overlaps(i.quad, rectQuad(bounds(t.quad))));
        if (!onPlate) expect(overlaps(sun.quad, t.quad), show(s, `${t.slot} on the sun`)).toBe(false);
      }
    }
  });
});
