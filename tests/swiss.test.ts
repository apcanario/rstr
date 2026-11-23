/** The new rules of row R13 pinned on the stub measure (review R13 S4): the transforms' geometry and Swiss's draws. */
import { describe, expect, test } from 'vitest';
import { apply, compose, rectQuad, unapply, type Pt, type Rect, type Xf } from '../src/engine/geom';
import { FORMATS, FORMAT_LIST } from '../src/engine/formats';
import { choosePairing, choosePalette, partCtx, solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { bleed, frameFor } from '../src/engine/parts/frame';
import { CUTS, SWISS_GRAPHICS, swissDraw } from '../src/engine/parts/graphics/swiss';
import { swissLayout } from '../src/engine/parts/layout/swiss';
import { shuffleSeeds } from '../src/engine/proof';
import { rng } from '../src/engine/rng';
import type { TextItem } from '../src/engine/scene';
import { defaultSpec, type Spec } from '../src/engine/spec';

const close = (a: Pt, b: Pt) => { expect(a[0]).toBeCloseTo(b[0], 6); expect(a[1]).toBeCloseTo(b[1], 6); };
const inside = (p: Pt, r: Rect, tol = 0.5) => p[0] >= r.x - tol && p[0] <= r.x + r.w + tol && p[1] >= r.y - tol && p[1] <= r.y + r.h + tol;

describe('rigid transforms (geom)', () => {
  test('unapply undoes apply; compose equals two applies', () => {
    const r = rng(9);
    for (let i = 0; i < 200; i++) {
      const a: Xf = { x: (r() - 0.5) * 2000, y: (r() - 0.5) * 2000, rot: (r() - 0.5) * 7 };
      const b: Xf = { x: (r() - 0.5) * 2000, y: (r() - 0.5) * 2000, rot: (r() - 0.5) * 7 };
      const p: Pt = [(r() - 0.5) * 3000, (r() - 0.5) * 3000];
      close(unapply(a, apply(a, p)), p);
      close(apply(compose(a, b), p), apply(a, apply(b, p)));
    }
    expect(compose(undefined, { x: 1, y: 2, rot: 3 })).toEqual({ x: 1, y: 2, rot: 3 });
  });
});

describe('composition frames (spec 8.0)', () => {
  const degs = [-14, -11.5, -9, 9, 12, 14];
  test('a tilted or turned page lies inside the canvas, and in 9:16 inside the band between the story zones', () => {
    for (const f of FORMAT_LIST) {
      const [W, H] = FORMATS[f], story = f === '9:16';
      const safe = { x: 0, y: story ? 260 : 0, w: W, h: story ? 1340 : H };
      for (const t of ['tilt', 'quarter'] as const) for (const deg of t === 'tilt' ? degs : [0]) {
        const fr = frameFor(t, deg, W, H, story);
        for (const p of rectQuad(fr.page)) expect(inside(apply(fr.xf, p), safe), `${f} ${t} ${deg}: ${apply(fr.xf, p)}`).toBe(true);
      }
      expect(frameFor('none', 0, W, H, story)).toEqual({ page: { x: 0, y: 0, w: W, h: H }, canvas: { x: 0, y: 0, w: W, h: H } });
    }
  });
  test('bleed grows only the sides that touch the page edge, and a full bleed covers the canvas', () => {
    for (const f of FORMAT_LIST) {
      const [W, H] = FORMATS[f], story = f === '9:16';
      for (const [t, deg] of [['tilt', -12], ['tilt', 10], ['quarter', 0]] as const) {
        const fr = frameFor(t, deg, W, H, story), pg = fr.page;
        // touching left and top only: right and bottom stay where they were
        const b = { x: 0, y: 0, w: pg.w / 2, h: pg.h / 3 }, o = bleed(b, pg, fr.canvas);
        expect(o.x).toBeLessThan(b.x);
        expect(o.y).toBeLessThan(b.y);
        expect(o.x + o.w).toBeCloseTo(b.x + b.w, 9);
        expect(o.y + o.h).toBeCloseTo(b.y + b.h, 9);
        // touching nothing: unchanged
        const mid = { x: pg.w / 4, y: pg.h / 4, w: pg.w / 4, h: pg.h / 4 };
        expect(bleed(mid, pg, fr.canvas)).toEqual(mid);
        // touching every side: the canvas's corners, in the page's frame, lie inside
        const all = bleed({ ...pg }, pg, fr.canvas);
        for (const p of rectQuad({ x: 0, y: 0, w: W, h: H })) expect(inside(unapply(fr.xf!, p), all, 0), `${f} ${t}`).toBe(true);
      }
    }
  });
});

describe('Swiss draws over 600 shuffles (spec 8.0, 8.1)', () => {
  const N = 600;
  const plans = Array.from({ length: N }, (_, i) => {
    const s = defaultSpec(shuffleSeeds(i));
    const c = partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), 0);
    const plan = swissLayout.plan(c)!;
    return { s, c, plan };
  });
  const share = (n: number) => n / N;
  test('tilt and quarter each about one in six; the tilt is 9 to 14 degrees either way', () => {
    const tilt = plans.filter((p) => p.plan.transform === 'tilt'), quarter = plans.filter((p) => p.plan.transform === 'quarter');
    expect(Math.abs(share(tilt.length) - 1 / 6)).toBeLessThan(0.05);
    expect(Math.abs(share(quarter.length) - 1 / 6)).toBeLessThan(0.05);
    let neg = 0;
    for (const p of tilt) {
      const deg = (p.plan.xf!.rot * 180) / Math.PI;
      expect(Math.abs(deg)).toBeGreaterThanOrEqual(9);
      expect(Math.abs(deg)).toBeLessThanOrEqual(14);
      if (deg < 0) neg++;
    }
    expect(neg).toBeGreaterThan(0);
    expect(neg).toBeLessThan(tilt.length);
    for (const p of quarter) expect(p.plan.xf!.rot).toBeCloseTo(-Math.PI / 2, 9);
  });
  test('cut-ins 0, 1, 2 near 0.38, 0.52, 0.10; every shape and plate role appears; block only inside blocks', () => {
    const counts = [0, 0, 0], shapes = new Set<string>(), roles = new Set<string>(), firsts = new Set<string>();
    for (const { c, plan } of plans) {
      const d = swissDraw(c, plan)!;
      counts[d.drawn]++;
      firsts.add(d.first);
      d.cuts.forEach((cut, k) => {
        shapes.add(cut.shape);
        roles.add(cut.role);
        expect(cut.name).not.toBe(d.first);
        if (cut.shape === 'block') { expect(d.first).toBe('blocks'); expect(k).toBe(0); }
      });
      expect(new Set(d.cuts.map((x) => x.name)).size).toBe(d.cuts.length);
    }
    [0.38, 0.52, 0.1].forEach((want, i) => expect(Math.abs(share(counts[i]) - want), `cut-ins ${i}: ${counts[i]}`).toBeLessThan(0.05));
    expect([...shapes].sort()).toEqual([...CUTS].sort());
    expect([...roles].sort()).toEqual(['accent', 'ground', 'ink']);
    expect([...firsts].sort()).toEqual([...SWISS_GRAPHICS].sort());
  });
  test('small, normal and oversize titles differ in size on the same seeds', () => {
    const px = (s: Spec) => (solve(s, stubMeasure).scene.items.find((i) => i.kind === 'text' && i.slot === 'title') as TextItem).px;
    let grew = 0, n = 0;
    for (let i = 0; i < 40; i++) {
      const at = (size: string) => { const s = defaultSpec(shuffleSeeds(i)); s.text.title.v = 'Signal'; s.params = { 'layout.size': size, 'layout.transform': 'none' }; return px(s); };
      const [a, b, c] = [at('small'), at('normal'), at('oversize')];
      n++;
      expect(a, `seed ${i}: small ${a} < normal ${b}`).toBeLessThan(b);
      expect(b, `seed ${i}: normal ${b} <= oversize ${c}`).toBeLessThanOrEqual(c);
      if (c > b) grew++;
    }
    expect(grew, 'oversize larger than normal').toBeGreaterThan(n / 2);
  });
});
