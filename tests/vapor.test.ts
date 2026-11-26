import { slotsOf } from '../src/engine/spec';
/** Vaporwave (row R9, spec 8.4) and the Carried R9 items, on the stub measure. */
import { describe, expect, test } from 'vitest';
import { bounds, overlaps, rectQuad } from '../src/engine/geom';
import { FORMATS } from '../src/engine/formats';
import { stars } from '../src/engine/graphics/stars';
import { choosePairing, choosePalette, partCtx, solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { specs, TITLES } from '../src/engine/proof';
import type { GraphicItem, Scene, TextItem } from '../src/engine/scene';
import { HORIZON, SKY_TEXT, VAPOR_LAYOUTS, vaporLayout } from '../src/engine/parts/layout/vapor';
import { VAPOR_GRAPHICS } from '../src/engine/parts/graphics/vapor';
import type { Spec } from '../src/engine/spec';

const texts = (sc: Scene) => sc.items.filter((i): i is TextItem => i.kind === 'text');
const sunOf = (sc: Scene) => sc.items.find((i): i is GraphicItem => i.kind === 'graphic' && i.name === 'sun');
const show = (s: Spec, why: string) => `${why}\n${JSON.stringify(s)}`;
const gs = (sc: Scene) => sc.items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.layer !== 'mark');
/** The cut-ins: discs cut into the focus, not a layout's own graphic (a sky object cut into its disc is the first). */
const cutIns = (sc: Scene) => gs(sc).filter((g) => g.cut === 'disc' && !g.lead);
const planOf = (s: Spec, sc: Scene) => vaporLayout.plan(partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), Number(sc.layout.slice(1))))!;
const vap = (o: { layouts?: string[]; params?: Spec['params']; n?: number; formats?: Spec['format'][] } = {}) =>
  (o.layouts ?? VAPOR_LAYOUTS).flatMap((layout) => [...specs({ styles: ['vapor'], formats: o.formats ?? ['3:4'], modes: ['light'], n: o.n ?? 40, variants: 'cycle', pick: { layout }, params: o.params })]);

describe('Vaporwave (spec 8.4)', () => {
  test('eight layouts, four of them without a horizon; twelve graphics or more from the shared library', () => {
    expect(VAPOR_LAYOUTS.length).toBeGreaterThanOrEqual(8);
    expect(VAPOR_LAYOUTS.filter((l) => !HORIZON.includes(l)).length).toBe(4);
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
      if (slotsOf(s.text).title.v !== TITLES.eight || !slotsOf(s.text).title.on) continue;
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

  test('the Advanced keys pin the graphics: vapor.first, vapor.second, vapor.extras (review R9 S4)', () => {
    for (const s of vap({ layouts: HORIZON, params: { 'vapor.first': 'sphere' } })) expect(solve(s, stubMeasure).scene.graphics[0], show(s, 'first')).toBe('sphere');
    for (const s of vap({ layouts: HORIZON, params: { 'vapor.second': 'checker' } })) expect(solve(s, stubMeasure).scene.graphics[1], show(s, 'second')).toBe('checker');
    let extras = 0;
    for (const s of vap({ layouts: HORIZON })) extras += gs(solve(s, stubMeasure).scene).filter((g) => g.name === 'mountains' || g.name === 'gradbars').length;
    expect(extras, 'unpinned, some designs carry mountains or bars').toBeGreaterThan(10);
    for (const s of vap({ layouts: HORIZON, params: { 'vapor.extras': 0, 'vapor.first': 'sun', 'graphics.cut': 0 } })) {
      const names = gs(solve(s, stubMeasure).scene).map((g) => g.name);
      expect(names, show(s, 'extras 0')).not.toContain('mountains');
      expect(names, show(s, 'extras 0')).not.toContain('gradbars');
    }
  });

  test('graphics.cut 0, 1 and 2 draw that many cut-ins in every layout; unpinned about six in ten cut one in, one in ten two (spec 8.0, review R9 S2, S4)', () => {
    for (const k of [0, 1, 2]) for (const s of vap({ params: { 'graphics.cut': k }, n: 20 })) expect(cutIns(solve(s, stubMeasure).scene).length, show(s, `graphics.cut ${k}`)).toBe(k);
    const all = vap({ n: 60 }), n = [0, 0, 0];
    for (const s of all) n[Math.min(2, cutIns(solve(s, stubMeasure).scene).length)]++;
    const one = (n[1] + n[2]) / all.length, two = n[2] / all.length;
    expect(one, `share with a cut-in ${n}`).toBeGreaterThan(0.5);
    expect(one, `share with a cut-in ${n}`).toBeLessThan(0.7);
    expect(two, `share with two ${n}`).toBeGreaterThan(0.04);
    expect(two, `share with two ${n}`).toBeLessThan(0.18);
  });

  test('gradient bars behind the sun run across, at most one set of bars; rings and dots floors lie flat; the orb\'s second keeps off its upper sphere (review R9 S3, M1, M3, M4)', () => {
    let behind = 0, floors = 0, orbs = 0;
    for (const s of vap({ n: 60 })) {
      const sc = solve(s, stubMeasure).scene, G = gs(sc);
      expect(G.filter((g) => g.name === 'gradbars').length, show(s, 'gradbars twice')).toBeLessThanOrEqual(1);
      if (HORIZON.includes(sc.frame)) {
        for (const g of G.filter((g) => g.name === 'gradbars' && !g.lead && !g.cut)) { behind++; expect(g.params.angle, show(s, 'bars down behind the sun')).toBe(0); }
        const fl = G.find((g) => g.lead && g.name === sc.graphics[1]);
        if (fl && (fl.name === 'rings' || fl.name === 'dots')) { floors++; expect(Number(fl.params.floor), show(s, 'flat floor')).toBeLessThan(1); }
      }
      if (sc.frame === 'orb') {
        const sph = G.find((g) => g.name === 'sphere' && g.lead)!, sec = G.find((g) => g.lead && g !== sph && g.name !== 'stars' && g.name !== 'rings' && g.name !== 'mountains');
        if (sec) { orbs++; expect(sec.box.y, show(s, 'orb second over the sphere')).toBeGreaterThanOrEqual(Number(sph.params.y) + Number(sph.params.r) * 0.8 - 1); }
      }
    }
    expect(behind).toBeGreaterThan(5);
    expect(floors).toBeGreaterThan(5);
    expect(orbs).toBeGreaterThan(5);
  });

  test('a star that meets a text hole is left out, not clipped (review R9 M2)', () => {
    const calls: number[] = [];
    const ctx = { fillStyle: '', globalAlpha: 1, fillRect: () => calls.push(1) } as unknown as Parameters<typeof stars.draw>[0];
    const g = { params: { W: 1080, hz: 1000, count: 60 }, colours: { ink: '#000', ground: '#fff' }, box: { x: 0, y: 0, w: 1080, h: 1000 } } as unknown as GraphicItem;
    const r = () => { let x = 1; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
    stars.draw(ctx, g, r(), { on: false, ph: 0, rev: () => 1 } as never);
    expect(calls.length).toBe(120);
    calls.length = 0;
    stars.draw(ctx, { ...g, avoid: [[[0, 0], [1080, 0], [1080, 1000], [0, 1000]]] } as GraphicItem, r(), { on: false, ph: 0, rev: () => 1 } as never);
    expect(calls.length).toBe(0);
  });

  test('the sun runs off a side by a third of itself at most; the huge sun gives way to the text (review R9 M8)', () => {
    let suns = 0, huge = 0;
    for (const s of vap({ n: 40, formats: ['1:1', '3:4', '9:16'] })) {
      const sc = solve(s, stubMeasure).scene, sun = sunOf(sc), W = FORMATS[s.format][0];
      if (sun && HORIZON.includes(sc.frame)) {
        suns++;
        const x = Number(sun.params.x), r = Number(sun.params.r);
        expect(x - r, show(s, 'sun off the left')).toBeGreaterThanOrEqual(-r / 3 - 0.5);
        expect(x + r, show(s, 'sun off the right')).toBeLessThanOrEqual(W + r / 3 + 0.5);
      }
      if (sc.frame === 'sun-huge' && sc.transform === 'none') {
        huge++;
        const T = planOf(s, sc).boxes.title!, x = Number(sun!.params.x), y = Number(sun!.params.y), r = Number(sun!.params.r);
        expect(T.h, show(s, 'huge sun title box')).toBeGreaterThanOrEqual(W * 0.2);
        const dx = Math.max(T.x - x, 0, x - T.x - T.w), dy = Math.max(T.y - y, 0, y - T.y - T.h);
        expect(Math.hypot(dx, dy), show(s, 'title box on the huge sun')).toBeGreaterThanOrEqual(r);
      }
    }
    expect(suns).toBeGreaterThan(50);
    expect(huge).toBeGreaterThan(10);
  });

  test('title size classes at title-floor: oversize over normal over small (review R9 M8)', () => {
    const med = (size: string) => {
      const px = vap({ layouts: ['title-floor'], params: { 'layout.size': size }, n: 30 }).map((s) => texts(solve(s, stubMeasure).scene).find((t) => t.slot === 'title')?.px ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
      return px[px.length >> 1];
    };
    const sm = med('small'), no = med('normal'), ov = med('oversize');
    expect(ov, `oversize ${ov}, normal ${no}`).toBeGreaterThan(no);
    expect(no, `normal ${no}, small ${sm}`).toBeGreaterThan(sm);
  });

  test('a sky title sits at the foot of its box, close over the sun, in every format (review R9 S5)', () => {
    for (const s of vap({ layouts: ['title-sky'], n: 30, formats: ['1:1', '3:4', '9:16'], params: { 'vapor.first': 'sun' } })) {
      const sc = solve(s, stubMeasure).scene, sun = sunOf(sc), W = FORMATS[s.format][0];
      const T = texts(sc).filter((t) => t.slot === 'title' || t.slot === 'subtitle');
      if (!sun || !T.length) continue;
      const foot = Math.max(...T.map((t) => bounds(t.quad).y + bounds(t.quad).h)), top = Number(sun.params.y) - Number(sun.params.r);
      expect(top - foot, show(s, 'dead sky between the text and the sun')).toBeLessThan(W * 0.12);
    }
  });
});
