/**
 * Rows R7 and R19: the finishes of spec 7.1. The kernels are pure on RGBA arrays, so they are checked here; the passes on
 * a canvas (two-pass rule, the 3:1 guard, same pixels) are checked in smoke, where there is a canvas.
 */
import { describe, expect, test } from 'vitest';
import { PAIRINGS } from '../src/data/pairings';
import { corruptionAvoid, dilate, finishSeed, FINISH_MIN_RATIO, grainKernel, grungeKernel, holdMask, keepOf, LOW_KEEP, strength, strengthKey, tooLow, valueNoise, vhsKernel, glitchKernel, type Reading, GRAIN_TERMS, GRUNGE_TERMS, VHS_TERMS, only, grungePlan, vhsPlan, grungeTerms, SECOND_GEN, RESTAMP, paperOf, Lattice, PAPER, QUIET_SMALL, QUIET_TYPE, grungeArgs, type Keep } from '../src/engine/finish';
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

// ---------------------------------------------------------------------------------------------------------------
// row R19: Grain, Grunge and VHS rebuilt (spec 7.1); the thresholds over 100 seeds per style are in tools/smoke.py

const W2 = 540, H2 = 400;
/** A picture with every tone and some colour: a grey ramp left to right, a colour ramp top to bottom, a dark bar. */
function picture(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W2 * H2 * 4);
  for (let y = 0, i = 0; y < H2; y++) for (let x = 0; x < W2; x++, i += 4) {
    const g = (x / (W2 - 1)) * 255, c = (y / (H2 - 1)) * 120;
    d[i] = Math.min(255, g + c * 0.5); d[i + 1] = g; d[i + 2] = Math.max(0, g - c * 0.5); d[i + 3] = 255;
    // and hard edges: a dark bar on the light half (the ghost and the colour shift show at edges)
    if (x >= 380 && x < 420) d[i] = d[i + 1] = d[i + 2] = 10;
  }
  return d;
}
const keep2 = { l: 80, r: 80, t: 80, b: 80, corners: [120, 120, 120, 120] as [number, number, number, number] };
const off = <T extends string>(all: readonly T[]) => Object.fromEntries(all.map((x) => [x, 0])) as Partial<Record<T, number>>;

describe('R19: each term of each kernel, alone (spec 7.1)', () => {
  const runs = [
    { name: 'grain', terms: GRAIN_TERMS, run: (d: Uint8ClampedArray, t: object) => grainKernel(d, W2, H2, 11, 1, 0, t) },
    { name: 'grunge', terms: GRUNGE_TERMS, run: (d: Uint8ClampedArray, t: object) => grungeKernel(d, W2, H2, 11, 1, keep2, 0, t) },
    { name: 'vhs', terms: VHS_TERMS, run: (d: Uint8ClampedArray, t: object) => vhsKernel(d, W2, H2, 11, 1, 0, t) },
  ];
  for (const { name, terms, run } of runs) {
    test(`${name}: every term off changes nothing; each term alone changes pixels`, () => {
      const a = picture();
      run(a, off(terms as readonly string[]));
      expect(diff(a, picture()), `${name} all off`).toBe(0);
      for (const t of terms as readonly string[]) {
        const b = picture();
        run(b, only(terms as readonly string[], t));
        expect(diff(b, picture()), `${name}.${t} alone`).toBeGreaterThan(50);
        for (let i = 3; i < b.length; i += 4) if (b[i] !== 255) throw new Error(`${name}.${t} touched alpha`);
      }
    });
  }
  test('grain: the tone weighting takes the noise down towards black and white, not at mid-grey', () => {
    const flat = (v: number) => { const d = new Uint8ClampedArray(W2 * H2 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return d; };
    const change = (v: number, tone: number) => { const d = flat(v); grainKernel(d, W2, H2, 5, 1, 0, { fine: 1, clump: 1, vignette: 0, tone }); let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - v); return s / (W2 * H2); };
    expect(change(128, 1) / change(128, 0)).toBeGreaterThan(0.98);
    const light = change(215, 1) / change(215, 0);
    expect(light).toBeLessThan(0.85);
    expect(light).toBeGreaterThan(0.6);
  });
  test('grain: the vignette darkens the corners by about 24% and leaves the centre', () => {
    const d = new Uint8ClampedArray(W2 * H2 * 4).fill(200);
    grainKernel(d, W2, H2, 5, 1, 0, only(GRAIN_TERMS, 'vignette'));
    expect(d[0]).toBeGreaterThanOrEqual(Math.floor(200 * 0.76) - 1);
    expect(d[0]).toBeLessThanOrEqual(Math.ceil(200 * 0.76) + 1);
    const c = ((H2 / 2) * W2 + W2 / 2) * 4;
    expect(d[c]).toBe(200);
  });
  test('grunge tone: paper and toner, not pure white and black; colour keeps its hue', () => {
    const d = picture();
    grungeKernel(d, W2, H2, 3, 1, keep2, 0, only(GRUNGE_TERMS, 'tone'));
    const at = (x: number, y: number) => Array.from(d.subarray((y * W2 + x) * 4, (y * W2 + x) * 4 + 3));
    expect(at(2, 0)).toEqual([22, 22, 22]);
    expect(at(W2 - 3, 0)).toEqual([PAPER, PAPER, PAPER]);
    const [r, , b] = at(Math.round(W2 / 2), H2 - 1);
    expect(r).toBeGreaterThan(b);
    // the paper leans to the ground's hue
    const p = paperOf({ ground: '#F2E6C8' } as never);
    expect(p[0]).toBeGreaterThan(p[2]);
    expect(Math.abs(0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] - PAPER)).toBeLessThan(1);
  });
  test('grunge, Grain and VHS: the same seed gives the same pixels in strips as whole (rows y0 on)', () => {
    for (const run of [
      (d: Uint8ClampedArray, y0: number) => grainKernel(d, W2, H2, 9, 1, y0),
      (d: Uint8ClampedArray, y0: number) => grungeKernel(d, W2, H2, 9, 1, keep2, y0),
      (d: Uint8ClampedArray, y0: number) => vhsKernel(d, W2, H2, 9, 1, y0),
    ]) {
      const whole = picture();
      run(whole, 0);
      const parts = picture();
      for (const [a, b] of [[0, 130], [130, 290], [290, H2]]) { const s = parts.slice(a * W2 * 4, b * W2 * 4); run(s, a); parts.set(s, a * W2 * 4); }
      expect(diff(whole, parts)).toBe(0);
    }
  });
  test('grunge holds back on type (quiet): no uneven toner on any, no speck, pinhole, dust or hair on small type', () => {
    const q = new Uint8Array(W2 * H2), small = new Uint8Array(W2 * H2).fill(QUIET_SMALL | QUIET_TYPE), type = new Uint8Array(W2 * H2).fill(QUIET_TYPE);
    for (const t of ['toner', 'dust'] as const) {
      const a = picture(); grungeKernel(a, W2, H2, 31, 1, keep2, 0, only(GRUNGE_TERMS, t), undefined, small);
      expect(diff(a, picture()), t).toBe(0);
      const b = picture(); grungeKernel(b, W2, H2, 31, 1, keep2, 0, only(GRUNGE_TERMS, t), undefined, q);
      expect(diff(b, picture()), t).toBeGreaterThan(0);
    }
    // on large type the blemishes land; the uneven toner does not
    const c = picture(); grungeKernel(c, W2, H2, 31, 1, keep2, 0, only(GRUNGE_TERMS, 'toner'), undefined, type);
    expect(diff(c, picture())).toBe(0);
    const d = picture(); grungeKernel(d, W2, H2, 31, 1, keep2, 0, only(GRUNGE_TERMS, 'dust'), undefined, type);
    expect(diff(d, picture())).toBeGreaterThan(0);
  });
  test('the restamp of the title is lighter under Grunge than under Grain (spec 7.1 step 7)', () => {
    expect(RESTAMP.grunge!).toBeLessThan(RESTAMP.grain!);
    expect(RESTAMP.grunge!).toBeGreaterThan(0);
  });
  test('Lattice: smooth value noise by position, in [0, 1], a row read alone as in the whole', () => {
    const L = new Lattice(4, 300, 18), a = new Float32Array(300), b = new Float32Array(300);
    L.row(77, a);
    new Lattice(4, 300, 18).row(77, b);
    expect(Array.from(a)).toEqual(Array.from(b));
    for (let x = 1; x < 300; x++) { expect(a[x]).toBeGreaterThanOrEqual(0); expect(a[x]).toBeLessThanOrEqual(1); expect(Math.abs(a[x] - a[x - 1])).toBeLessThan(0.15); }
  });
});

describe('R19: Grunge on the photocopy dialect is the second generation (spec 7.1)', () => {
  const sceneOf = (style: 'pomo' | 'swiss', dialect: 'photocopy' | 'icecream' | null, i: number) => {
    const s = defaultSpec(); s.style = style; s.finish = 'grunge'; s.pick.dialect = dialect; s.seeds = { layout: 900 + i, colour: 901 + i, graphic: 902 + i, type: 903 + i };
    return solve(s, stubMeasure).scene;
  };
  test('the kernel gets steps 2, 4 and 5 at half on a photocopy design, and every step whole on any other', () => {
    expect(SECOND_GEN).toEqual({ toner: 0.5, speckle: 0.5, dust: 0.5 });
    for (let i = 0; i < 6; i++) {
      expect(grungeTerms(sceneOf('pomo', 'photocopy', i)), `photocopy ${i}`).toEqual(SECOND_GEN);
      expect(grungeTerms(sceneOf('pomo', 'icecream', i)), `icecream ${i}`).toEqual({});
      expect(grungeTerms(sceneOf('swiss', null, i)), `swiss ${i}`).toEqual({});
    }
  });
  test('what finishBody hands the kernel (grungeArgs): the second generation on photocopy, whole steps elsewhere; keep and paper scaled by the view (review R19 M2)', () => {
    const v1 = { sx: 1, sy: 1, ox: 0, oy: 0, W: 1080, H: 1440, top: 0 }, v3 = { sx: 3, sy: 3, ox: 0, oy: 0, W: 3240, H: 4320, top: 0 };
    for (let i = 0; i < 6; i++) {
      const p = sceneOf('pomo', 'photocopy', i), c = sceneOf('pomo', 'icecream', i), w = sceneOf('swiss', null, i);
      expect(grungeArgs(p, v1).terms, `photocopy ${i}`).toEqual(SECOND_GEN);
      expect(grungeArgs(c, v1).terms, `icecream ${i}`).toEqual({});
      expect(grungeArgs(w, v1).terms, `swiss ${i}`).toEqual({});
      expect(grungeArgs(p, v1).keep).toEqual(keepOf(p));
      expect(grungeArgs(p, v3).keep.l).toBeCloseTo(keepOf(p).l * 3, 9);
      expect(grungeArgs(p, v1).paper).toEqual(paperOf(p));
    }
  });
  test('at half, steps 2, 4 and 5 change less than whole; steps 1, 3 and 6 the same', () => {
    const change = (t: object) => { const d = picture(); grungeKernel(d, W2, H2, 21, 1, keep2, 0, t); let s = 0; const p = picture(); for (let i = 0; i < d.length; i += 4) s += Math.abs(d[i] - p[i]); return s; };
    for (const t of ['toner', 'speckle', 'dust'] as const) expect(change({ ...off(GRUNGE_TERMS), [t]: SECOND_GEN[t] }), t).toBeLessThan(change(only(GRUNGE_TERMS, t)));
    const whole = picture(), second = picture();
    grungeKernel(whole, W2, H2, 21, 1, keep2, 0, { toner: 0, speckle: 0, dust: 0 });
    grungeKernel(second, W2, H2, 21, 1, keep2, 0, { ...SECOND_GEN, toner: 0, speckle: 0, dust: 0 });
    expect(diff(whole, second)).toBe(0);
  });
});

describe('R19: a finish at 3x differs from the stage only by scale (spec 7.1)', () => {
  // review R19 S4: what the kernels draw, not only their plans. A flat grey picture with one term on, at 1080 and at
  // 3240 wide: the runs of changed columns or rows must be as many at both sizes.
  const flat = (w: number, h: number) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 128; d[i + 3] = 255; } return d; };
  const runs = (on: boolean[]) => on.reduce((n, x, i) => n + (x && !on[i - 1] ? 1 : 0), 0);
  const mode = (vals: number[]) => { const m = new Map<number, number>(); for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0][0]; };
  /** Runs of columns (in one row) and of rows (in one column) whose value is not the row's or column's commonest. */
  const marks = (d: Uint8ClampedArray, w: number, h: number) => {
    const y = Math.floor(h * 0.37), x = Math.floor(w * 0.61);
    const row = Array.from({ length: w }, (_, i) => d[(y * w + i) * 4]), col = Array.from({ length: h }, (_, j) => d[(j * w + x) * 4]);
    const mr = mode(row), mc = mode(col);
    return { cols: runs(row.map((v) => v !== mr)), rows: runs(col.map((v) => v !== mc)) };
  };
  test('Grunge feed alone draws as many streaks and bands at 3x as at 1x', () => {
    for (const seed of [3, 8, 21]) {
      const k1 = { l: 0, r: 0, t: 0, b: 0, corners: [0, 0, 0, 0] as Keep['corners'] }, a = flat(1080, 1080), b = flat(3240, 3240);
      grungeKernel(a, 1080, 1080, seed, 1, k1, 0, only(GRUNGE_TERMS, 'feed'));
      grungeKernel(b, 3240, 3240, seed, 1, k1, 0, only(GRUNGE_TERMS, 'feed'));
      const m1 = marks(a, 1080, 1080), m3 = marks(b, 3240, 3240);
      expect(m1.cols + m1.rows, `seed ${seed}`).toBeGreaterThan(0);
      expect(m3, `seed ${seed}`).toEqual(m1);
    }
  });
  test('VHS tracking alone draws as many bands at 3x as at 1x', () => {
    for (const seed of [3, 8, 21]) {
      const a = flat(1080, 1920), b = flat(3240, 5760);
      vhsKernel(a, 1080, 1920, seed, 1, 0, only(VHS_TERMS, 'tracking'));
      vhsKernel(b, 3240, 5760, seed, 1, 0, only(VHS_TERMS, 'tracking'));
      const changed = (d: Uint8ClampedArray, w: number, h: number) => Array.from({ length: h }, (_, y) => { for (let x = 0; x < w; x++) if (d[(y * w + x) * 4] !== 128) return true; return false; });
      const n1 = runs(changed(a, 1080, 1920)), n3 = runs(changed(b, 3240, 5760));
      expect(n1, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(n3, `seed ${seed}`).toBe(n1);
    }
  });
  test('streaks, bands, dust, hairs and shadowed sides of Grunge, and tracking bands and dropouts of VHS: as many at 1x as at 3x', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const a = grungePlan(1080, 1440, seed), b = grungePlan(3240, 4320, seed);
      expect(b.across).toBe(a.across);
      for (const k of ['streaks', 'bands', 'dust', 'hairs', 'shadow'] as const) expect(b[k].length, `${k} seed ${seed}`).toBe(a[k].length);
      expect(b.streaks[0].at).toBeCloseTo(a.streaks[0].at * 3, 6);
      expect(b.hairs[0].p[16][0]).toBeCloseTo(a.hairs[0].p[16][0] * 3, 6);
      expect(b.shadow.map((s) => s.side)).toEqual(a.shadow.map((s) => s.side));
      const v = vhsPlan(1080, 1920, seed), w = vhsPlan(3240, 5760, seed);
      expect(w.tracking.length).toBe(v.tracking.length);
      expect(w.dropouts.length).toBe(v.dropouts.length);
      expect(w.tracking[0].h).toBeCloseTo(v.tracking[0].h * 3, 6);
      // the counts of spec 7.1
      expect(a.streaks.length).toBeGreaterThanOrEqual(5); expect(a.streaks.length).toBeLessThanOrEqual(9);
      expect(a.bands.length).toBeGreaterThanOrEqual(2); expect(a.bands.length).toBeLessThanOrEqual(4);
      expect(a.dust.length).toBeGreaterThanOrEqual(20); expect(a.dust.length).toBeLessThanOrEqual(40);
      expect(a.hairs.length).toBeGreaterThanOrEqual(1); expect(a.hairs.length).toBeLessThanOrEqual(3);
      expect(a.shadow.length).toBeGreaterThanOrEqual(1); expect(a.shadow.length).toBeLessThanOrEqual(3);
      expect(v.tracking.length).toBeGreaterThanOrEqual(2); expect(v.tracking.length).toBeLessThanOrEqual(3);
      expect(v.dropouts.length).toBeGreaterThanOrEqual(6); expect(v.dropouts.length).toBeLessThanOrEqual(14);
    }
  });
});
