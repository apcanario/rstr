/** The new rules of row R13 pinned on the stub measure (review R13 S4): the transforms' geometry and Swiss's draws. */
import { describe, expect, test } from 'vitest';
import { apply, compose, rectQuad, unapply, type Pt, type Rect, type Xf } from '../src/engine/geom';
import { FORMATS, FORMAT_LIST } from '../src/engine/formats';
import { choosePairing, choosePalette, partCtx, solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { bleed, frameFor } from '../src/engine/parts/frame';
import { discGeom } from '../src/engine/graphics/disc';
import { numeralGeom } from '../src/engine/graphics/numeral';
import { crossGeom } from '../src/engine/graphics/crosshairs';
import { GRAPHICS } from '../src/engine/graphics';
import { CUTS, SWISS_GRAPHICS, swissDraw } from '../src/engine/parts/graphics/swiss';
import { SWISS_LAYOUTS, SWISS_POS, swissLayout } from '../src/engine/parts/layout/swiss';
import { overlaps } from '../src/engine/geom';
import { SLOTS } from '../src/engine/spec';
import { shuffleSeeds } from '../src/engine/proof';
import { rng } from '../src/engine/rng';
import type { RectItem, TextItem } from '../src/engine/scene';
import { contrast, needRatio } from '../src/engine/colour';
import { defaultSpec, type Spec } from '../src/engine/spec';

const close = (a: Pt, b: Pt) => { expect(a[0]).toBeCloseTo(b[0], 6); expect(a[1]).toBeCloseTo(b[1], 6); };
const inQuad = (q: Pt[], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) if (q[i][1] > y !== q[j][1] > y && x < ((q[j][0] - q[i][0]) * (y - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
  return c;
};
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
    let drawn = 0;
    for (const { c, plan } of plans) {
      const d = swissDraw(c, plan);
      if (!d) { expect(plan.frame).toBe('type-only'); continue; }
      drawn++;
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
    [0.38, 0.52, 0.1].forEach((want, i) => expect(Math.abs(counts[i] / drawn - want), `cut-ins ${i}: ${counts[i]}`).toBeLessThan(0.05));
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
      // fit steps by 2 px from each class's own start, so where room binds the two may land a step apart
      expect(b, `seed ${i}: normal ${b} <= oversize ${c}`).toBeLessThanOrEqual(c + 2);
      if (c > b) grew++;
    }
    expect(grew, 'oversize larger than normal').toBeGreaterThan(n / 2);
  });
});

describe('R5: Swiss finished (spec 8.1, 8.5)', () => {
  const N = 600;
  const plans = Array.from({ length: N }, (_, i) => {
    const s = defaultSpec(shuffleSeeds(i));
    const c = partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), 0);
    return { s, c, plan: swissLayout.plan(c)! };
  });
  test('eight layouts, each well under 25% of the rolls (graphic-above was 37% at R13)', () => {
    expect(SWISS_LAYOUTS).toHaveLength(8);
    const n = new Map<string, number>();
    for (const p of plans) n.set(p.plan.frame, (n.get(p.plan.frame) ?? 0) + 1);
    expect([...n.keys()].sort()).toEqual([...SWISS_LAYOUTS].sort());
    for (const [k, v] of n) expect(v / N, k).toBeLessThan(0.2);
  });
  test('twelve graphics, every one in the shared library', () => {
    expect(SWISS_GRAPHICS).toHaveLength(12);
    for (const g of SWISS_GRAPHICS) expect(GRAPHICS[g], g).toBeDefined();
  });
  test('no small title on a tilted or turned page or in type only; no quarter turn with the vertical title (review R13 item 2)', () => {
    for (const { plan } of plans) {
      if (plan.transform !== 'none' || plan.frame === 'type-only') expect(plan.size, plan.frame + ' ' + plan.transform).not.toBe('small');
      if (plan.frame === 'vertical') expect(plan.transform).not.toBe('quarter');
    }
    expect(plans.some((p) => p.plan.size === 'small')).toBe(true);
  });
  test('every position of every slot is rolled, and text.<slot>.pos overrides the roll', () => {
    for (const slot of SLOTS) {
      const seen = new Set(plans.map((p) => p.plan.pos![slot]));
      expect([...seen].sort(), slot).toEqual([...SWISS_POS[slot]].sort());
      expect(SWISS_POS[slot].length).toBeGreaterThanOrEqual(2);
      for (const want of SWISS_POS[slot]) for (let i = 0; i < 20; i++) {
        const s = defaultSpec(shuffleSeeds(i));
        s.text[slot].pos = want;
        expect(swissLayout.plan(partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), 0))!.pos![slot]).toBe(want);
      }
    }
  });
  test('a cut-in never sits under the text panel (review R13 item 3)', () => {
    let n = 0;
    for (const { c, plan } of plans) {
      const P = plan.boxes.panel, d = swissDraw(c, plan);
      if (!P || !d) continue;
      for (const cut of d.cuts) { n++; expect(overlaps(rectQuad(cut.box), rectQuad(P)), JSON.stringify(c.spec.seeds)).toBe(false); }
    }
    expect(n).toBeGreaterThan(20);
    // the R13 seed: a disc hidden under the panel
    const s = defaultSpec({ layout: 24938, colour: 218658, graphic: 2608718, type: 9462 });
    const c = partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), 0), plan = swissLayout.plan(c)!;
    for (const cut of swissDraw(c, plan)?.cuts ?? []) if (plan.boxes.panel) expect(overlaps(rectQuad(cut.box), rectQuad(plan.boxes.panel))).toBe(false);
  });
  test('the disc and its satellite stay inside their box at every end of every parameter (review bundle 1 S2)', () => {
    const R = GRAPHICS.disc.params, boxes = [{ x: 10, y: 20, w: 900, h: 400 }, { x: 0, y: 0, w: 300, h: 1200 }, { x: 5, y: 5, w: 500, h: 500 }];
    const ends = (k: keyof typeof R) => [R[k].min, (R[k].min + R[k].max) / 2, R[k].max];
    let n = 0;
    for (const B of boxes) for (const radius of ends('radius')) for (const cx of ends('cx')) for (const cy of ends('cy')) for (const sat of ends('sat')) for (let a = 0; a < 1; a += 0.125) {
      const g = discGeom(B, { radius, cx, cy, sat, satAngle: a });
      const inBox = (x: number, y: number, r: number) => x - r >= B.x - 1e-6 && x + r <= B.x + B.w + 1e-6 && y - r >= B.y - 1e-6 && y + r <= B.y + B.h + 1e-6;
      expect(inBox(g.cx, g.cy, g.rad)).toBe(true);
      expect(g.rad).toBeLessThanOrEqual(Math.min(B.w, B.h) / 2 + 1e-6);
      if (g.sr > 0) expect(inBox(g.sx, g.sy, g.sr)).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(500);
  });
  test('the numeral and its stroke stay inside their box at every end of every parameter (review R5 S3)', () => {
    const R = GRAPHICS.numeral.params, boxes = [{ x: 10, y: 20, w: 900, h: 400 }, { x: 0, y: 0, w: 300, h: 1200 }, { x: 5, y: 5, w: 500, h: 500 }, { x: 0, y: 0, w: 120, h: 900 }];
    const ends = (k: string) => [R[k].min, (R[k].min + R[k].max) / 2, R[k].max];
    let n = 0;
    for (const B of boxes) for (const weight of ends('weight')) for (const scale of ends('scale')) for (const x of ends('x')) {
      const { ink } = numeralGeom(B, { weight, scale, x });
      expect(ink.x).toBeGreaterThanOrEqual(B.x - 1e-6);
      expect(ink.y).toBeGreaterThanOrEqual(B.y - 1e-6);
      expect(ink.x + ink.w).toBeLessThanOrEqual(B.x + B.w + 1e-6);
      expect(ink.y + ink.h).toBeLessThanOrEqual(B.y + B.h + 1e-6);
      n++;
    }
    expect(R.scale.max).toBeLessThanOrEqual(1);
    expect(n).toBe(108);
  });
  test('crosshairs are never specks: the arm is at least half a module or half the box (review R5 S7)', () => {
    const R = GRAPHICS.crosshairs.params;
    for (const B of [{ w: 1080, h: 540 }, { w: 936, h: 300 }, { w: 156, h: 900 }, { w: 80, h: 80 }]) for (const mod of [100, 156]) for (let count = R.count.min; count <= R.count.max; count++) for (const size of [R.size.min, R.size.max]) {
      const g = crossGeom(B, mod, count, size);
      expect(g.L).toBeGreaterThanOrEqual(Math.min(mod, B.w, B.h) * 0.5 - 1e-9);
      expect(g.n).toBeLessThanOrEqual(Math.max(1, g.cols - 1) * Math.max(1, g.rows - 1));
      expect(g.n).toBeGreaterThanOrEqual(1);
    }
  });
  test('a tilted or turned layout keeps its title readable: within 25% of the upright size on the same seeds, in every layout and format (review R5 S1)', () => {
    const px = (s: Spec) => (solve(s, stubMeasure).scene.items.find((i) => i.kind === 'text' && i.slot === 'title') as TextItem | undefined)?.px ?? 0;
    let n = 0;
    for (const f of FORMAT_LIST) for (const layout of SWISS_LAYOUTS) for (const tr of ['tilt', 'quarter']) {
      // the vertical title never takes a quarter turn (it would read upside down)
      if (layout === 'vertical' && tr === 'quarter') continue;
      for (let i = 0; i < 40; i++) {
        const at = (t: string) => { const s = defaultSpec(shuffleSeeds(i)); s.format = f; s.pick.layout = layout; s.params = { 'layout.transform': t, 'layout.size': 'normal' }; return px(s); };
        const up = at('none'), turned = at(tr);
        expect(turned, `${f} ${layout} seed ${i} ${tr}: ${turned} against ${up}`).toBeGreaterThanOrEqual(up * 0.75);
        n++;
      }
    }
    expect(n).toBe(3 * 15 * 40);
  });
  test('the vertical title reads up the page', () => {
    let n = 0;
    for (let i = 0; i < 30; i++) {
      const s = defaultSpec(shuffleSeeds(i));
      s.pick.layout = 'vertical';
      const sc = solve(s, stubMeasure).scene, t = sc.items.find((x) => x.kind === 'text' && x.slot === 'title') as TextItem;
      if (sc.transform !== 'none') continue;
      n++;
      expect(t.xf!.rot).toBeCloseTo(-Math.PI / 2, 9);
    }
    expect(n).toBeGreaterThan(10);
  });
  test('text on a field of colour takes an ink that passes 4.5:1 there (3:1 when large), in every palette form (review R5 M3)', () => {
    let n = 0, onField = 0;
    for (let i = 0; i < 24; i++) for (const layout of ['centred-low', 'split']) for (const mode of ['light', 'dark'] as const) {
      const s = defaultSpec(shuffleSeeds(i));
      s.pick.layout = layout; s.mode = mode;
      const sc = solve(s, stubMeasure).scene;
      expect(sc.layout, JSON.stringify(s.seeds)).not.toBe('fallback');
      expect(sc.frame, JSON.stringify(s.seeds)).toBe(layout);
      // the field is the first rect of the Scene that is not a plate under text
      const F = sc.items.find((x) => x.kind === 'rect' && !x.plate) as RectItem;
      expect(F, JSON.stringify(s.seeds)).toBeDefined();
      for (const t of sc.items) {
        if (t.kind !== 'text') continue;
        const xs = t.quad.map((p) => p[0]), ys = t.quad.map((p) => p[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        if (!inQuad(F.quad, cx, cy)) continue;
        onField++;
        for (const ink of t.ink) expect(contrast(ink, F.fill as string), `${t.slot} ${t.part} ${JSON.stringify(s.seeds)} ${mode}`).toBeGreaterThanOrEqual(needRatio(t.px) - 1e-9);
      }
      n++;
    }
    expect(onField).toBeGreaterThan(200);
    expect(n).toBe(96);
  });
});
