/**
 * Row R7: the finishes of spec 7.1. The kernels are pure on RGBA arrays, so they are checked here; the passes on
 * a canvas (two-pass rule, the 3:1 guard, same pixels) are checked in smoke, where there is a canvas.
 */
import { describe, expect, test } from 'vitest';
import { PAIRINGS } from '../src/data/pairings';
import { corruptionAvoid, dilate, finishSeed, FINISH_MIN_RATIO, grainKernel, grungeKernel, holdMask, keepOf, LOW_KEEP, strength, strengthKey, tooLow, valueNoise, vhsKernel, glitchKernel, type Reading } from '../src/engine/finish';
import { solve, stepLight, weightsOf } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { rng } from '../src/engine/rng';
import { bounds, overlaps } from '../src/engine/geom';
import { defaultSpec, type Finish } from '../src/engine/spec';

const W = 120, H = 90;
function image(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = (i / 4) % 251; d[i + 1] = 128; d[i + 2] = 255 - ((i / 4) % 199); d[i + 3] = 255; }
  return d;
}
const keep = { l: 40, r: 40, t: 40, b: 40, corners: [60, 60, 60, 60] as [number, number, number, number] };
const KERNELS: Record<string, (d: Uint8ClampedArray, seed: number, k: number) => void> = {
  grain: (d, s, k) => grainKernel(d, W, H, s, k),
  grunge: (d, s, k) => grungeKernel(d, W, H, s, k, keep),
  vhs: (d, s, k) => vhsKernel(d, W, H, s, k),
  glitch: (d, s, k) => glitchKernel(d, W, H, s, k, { x0: 60, y0: 20, h: 20, len: 50, dir: 1 }),
};
const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };

describe('finish kernels (spec 7.1)', () => {
  for (const [name, f] of Object.entries(KERNELS)) {
    test(`${name}: the same seed gives the same pixels; another seed others; it changes the image`, () => {
      const a = image(), b = image(), c = image();
      f(a, 7, 1); f(b, 7, 1); f(c, 8, 1);
      expect(diff(a, b)).toBe(0);
      expect(diff(a, c)).toBeGreaterThan(0);
      expect(diff(a, image())).toBeGreaterThan(W * H * 0.05);
      // alpha is never touched
      for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
    });
  }
  test('grunge edges stop at keep: with keep 0 everywhere, no pixel is darkened more than grain and streaks do', () => {
    const none = { l: 0, r: 0, t: 0, b: 0, corners: [0, 0, 0, 0] as [number, number, number, number] };
    const flat = () => new Uint8ClampedArray(W * H * 4).fill(200);
    const a = flat(), b = flat();
    grungeKernel(a, W, H, 3, 1, none);
    grungeKernel(b, W, H, 3, 1, keep);
    // the corner pixel is eaten only when keep allows it
    const corner = (d: Uint8ClampedArray) => d[0];
    expect(corner(b)).toBeLessThan(80);
    expect(corner(a)).toBeGreaterThan(100);
  });
  test('glitch shifts slices, it does not wrap them: the left column only ever shows itself or its right', () => {
    // a picture whose right half is white and left half black: a wrapped slice would bring white to x = 0
    const d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < d.length; i += 4) { const v = (i / 4) % W >= W / 2 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    for (let seed = 1; seed < 30; seed++) {
      const a = d.slice();
      glitchKernel(a, W, H, seed, 1, null);
      for (let y = 0; y < H; y++) expect(a[y * W * 4 + 1], `seed ${seed} row ${y}`).toBe(0);
    }
  });
  test('the hold (review R7 E1): under a full mask nothing an effect does is left; partial blends; none untouched', () => {
    for (const [name, f] of Object.entries(KERNELS)) {
      const keep = image(), d = keep.slice(), m = new Uint8Array(W * H);
      for (let y = 20; y < 40; y++) for (let x = 30; x < 70; x++) m[y * W + x] = 255;
      m[10 * W + 10] = 128;
      f(d, 7, 1);
      const moved = d.slice();
      holdMask(d, keep, m);
      for (let y = 20; y < 40; y++) for (let x = 30; x < 70; x++) for (let c = 0; c < 4; c++) expect(d[(y * W + x) * 4 + c], name).toBe(keep[(y * W + x) * 4 + c]);
      const i = (10 * W + 10) * 4;
      expect(Math.abs(d[i] - (keep[i] * 128 / 255 + moved[i] * 127 / 255)), name).toBeLessThanOrEqual(1);
      expect(d[(5 * W + 100) * 4], name).toBe(moved[(5 * W + 100) * 4]);
    }
  });
  test('dilate grows a mask by r px in every direction and no further', () => {
    const a = new Uint8Array(W * H);
    a[40 * W + 60] = 255;
    const b = dilate(a, W, H, 2);
    for (let y = 30; y < 50; y++) for (let x = 50; x < 70; x++) expect(b[y * W + x], `${x},${y}`).toBe(Math.abs(x - 60) <= 2 && Math.abs(y - 40) <= 2 ? 255 : 0);
  });
  test('valueNoise stays in [0, 1] and is smooth', () => {
    const v = valueNoise(rng(5), 500, 20);
    for (let i = 0; i < v.length; i++) { expect(v[i]).toBeGreaterThanOrEqual(0); expect(v[i]).toBeLessThanOrEqual(1); }
    for (let i = 1; i < v.length; i++) expect(Math.abs(v[i] - v[i - 1])).toBeLessThan(0.2);
  });
});

describe('finish settings', () => {
  test('the strength dial: finish.<name>.strength, clamped to 0..1.5, 1 when unset', () => {
    const s = { ...defaultSpec(), finish: 'grunge' as Finish };
    expect(strength(s)).toBe(1);
    expect(strength({ ...s, params: { [strengthKey('grunge')]: 9 } })).toBe(1.5);
    expect(strength({ ...s, params: { [strengthKey('grunge')]: 0.4 } })).toBe(0.4);
    expect(strength({ ...s, params: { [strengthKey('grain')]: 0.4 } })).toBe(1);
  });
  test('each finish has its own stream off the graphic seed', () => {
    const s = defaultSpec();
    const seeds = (['grain', 'grunge', 'vhs', 'glitch'] as Finish[]).map((f) => finishSeed({ ...s, finish: f }));
    expect(new Set(seeds).size).toBe(4);
    expect(finishSeed({ ...s, finish: 'vhs' })).not.toBe(finishSeed({ ...s, finish: 'vhs', seeds: { ...s.seeds, graphic: 99 } }));
    expect(finishSeed({ ...s, finish: 'vhs' })).toBe(finishSeed({ ...s, finish: 'vhs', seeds: { ...s.seeds, layout: 99, colour: 98, type: 97 } }));
  });
  test('a finish does not move the Scene: the same boxes under every finish', () => {
    for (const style of ['swiss', 'pomo', 'brutal', 'vapor'] as const) {
      const base = { ...defaultSpec(), style };
      const a = JSON.stringify(solve(base, stubMeasure).scene);
      for (const f of ['grain', 'grunge', 'vhs', 'glitch'] as Finish[]) expect(JSON.stringify(solve({ ...base, finish: f }, stubMeasure).scene), `${style} ${f}`).toBe(a);
    }
  });
  test('keepOf: the free distance from each side and corner to the nearest text', () => {
    const sc = solve(defaultSpec(), stubMeasure).scene;
    const k = keepOf(sc), bs = sc.items.filter((i) => i.kind === 'text').map((t) => bounds(t.quad));
    expect(k.l).toBeLessThanOrEqual(Math.min(...bs.map((b) => b.x)));
    expect(k.t).toBeLessThanOrEqual(Math.min(...bs.map((b) => b.y)));
    for (const c of k.corners) expect(c).toBeGreaterThanOrEqual(0);
  });
  test('the guard reads in cells (review R7 E1, E2): one lost cell fails; a low item may not lose more than 5%', () => {
    const R = (ratio: number, cells: (number | null)[]): Reading => ({ ratio, ink: 100, ringPx: 100, cells });
    // the whole item still reads 8:1, but one cell (a letter slid off its plate) is at 1.1: too low
    expect(tooLow(R(9, [12, 12, 12, null]), R(8, [12, 1.1, 12, null]))).toEqual({ cell: 1, clean: 12, fin: 1.1 });
    // a cell Clean already had under 3:1 is not the finish's doing; a dip that stays at 3:1 or more is allowed
    expect(tooLow(R(9, [2, 12]), R(9, [1.5, 3.2]))).toBeNull();
    // an item Clean reads under 3:1 (a colliding photocopy word) may not be taken lower by more than 5%
    expect(tooLow(R(1.46, [2, 2]), R(1.14, [2, 2]))?.cell).toBe(-1);
    expect(tooLow(R(1.46, [2, 2]), R(1.46 * LOW_KEEP + 0.001, [2, 2]))).toBeNull();
    expect(FINISH_MIN_RATIO).toBe(3);
  });
  test('corruption bars keep off text (padded), graphics, plates and rects (review R7 M4)', () => {
    for (const style of ['swiss', 'pomo', 'brutal', 'vapor'] as const) {
      const sc = solve({ ...defaultSpec(), style, finish: 'glitch' }, stubMeasure).scene, av = corruptionAvoid(sc);
      for (const it of sc.items) {
        if (it.kind === 'text' || it.kind === 'rect' || (it.kind === 'graphic' && it.layer !== 'ground' && !it.pass)) expect(av.some((q) => overlaps(q, it.quad)), `${style} ${it.kind}`).toBe(true);
      }
    }
  });
  test('a light weight steps up to the next weight its family lists under a finish (spec 7.1, review R7 M7); Clean leaves it', () => {
    const p = PAIRINGS.swiss[0], light = { ...p, text: { ...p.text, weight: 300 } };
    expect(stepLight(light, 'clean').text.weight).toBe(300);
    const next = weightsOf(p.text.family).find((w) => w > 300)!;
    expect(stepLight(light, 'grain').text.weight).toBe(next);
    expect(weightsOf(p.text.family)).toContain(stepLight(light, 'grain').text.weight);
    expect(stepLight(light, 'grain').display).toEqual(p.display);
    // the family's own list decides: a family that has 300 and 600 steps to 600; one with nothing above stays
    expect(stepLight(light, 'vhs', () => [300, 600]).text.weight).toBe(600);
    expect(stepLight(light, 'vhs', () => [300])).toBe(light);
    // every pairing of the list sets its text at 400 or more: nothing steps today
    for (const list of Object.values(PAIRINGS)) for (const q of list) expect(stepLight(q, 'vhs')).toBe(q);
  });
});
