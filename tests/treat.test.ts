/** Row R15: photo treatments (spec 8.9), their picks, their colours, their determinism and 9.2 with each. */
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { solve, choosePalette } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { contains } from '../src/engine/geom';
import { lowContrast } from '../src/engine/invariants';
import { registerPhoto, testPhoto, testPicture } from '../src/engine/photo';
import { runInvariants } from '../src/engine/proof';
import { defaultSpec, migrate, STYLE_IDS, type Spec } from '../src/engine/spec';
import { FORMAT_LIST } from '../src/engine/formats';
import { NO_LOCKS, shuffle, reroll, withStyle } from '../src/app/state';
import { advancedOf } from '../src/engine/advanced';
import { allControls } from '../src/engine/advanced';
import { apply, facetOfParam, setColour } from '../src/engine/controls';
import { STYLES } from '../src/engine/styles';
import { parseHex, toHex } from '../src/engine/colour';
import { duoPairs, FAV_WEIGHT, paletteColours, POSTERISE_MIN, TONE_SLACK, treatColours, treatedRange, treatOf, treatOffered, treatPairs, treatPixels, TREATMENTS, type Treatment } from '../src/engine/treat';
import { clearTreated, treatedBox, treatedKept, TREATED_KEEP } from '../src/engine/paint';
import { treatmentControl } from '../src/engine/controls';
import { COPY_LAYOUTS, ICE_LAYOUTS } from '../src/engine/parts/layout/pomo';
import { PALETTES } from '../src/data/palettes';
import { formOf } from '../src/data/palettes/types';
import type { GraphicItem, Scene } from '../src/engine/scene';

const PORTRAIT = 'test-portrait', LANDSCAPE = 'test-landscape';
beforeAll(() => {
  registerPhoto(testPhoto(PORTRAIT, 3000, 4000, 7));
  registerPhoto(testPhoto(LANDSCAPE, 4000, 2600, 11));
});
const photoOfScene = (sc: Scene) => sc.items.find((i): i is GraphicItem => i.kind === 'graphic' && i.name === 'photo');
const withTreat = (s: Spec, t: Treatment | null, id = PORTRAIT): Spec => ({ ...s, photo: { id, treatment: t, place: null } });
/** A picture to treat: the test photo's pixels, 96 x 128. */
const W0 = 96, H0 = 128;
const pic = () => testPicture(W0, H0, 7);
const rgb = (d: Uint8ClampedArray, i: number) => [d[i], d[i + 1], d[i + 2]];
const hexes = (cols: string[]) => cols.map(parseHex);

/** The item a treatment of spec s records, from a solve on the stub measure. */
function treated(s: Spec): GraphicItem {
  const g = photoOfScene(solve(s, stubMeasure).scene);
  expect(g).toBeDefined();
  return g!;
}

describe('every treatment is deterministic (spec 8.9, R15 Done when)', () => {
  for (const t of TREATMENTS) {
    test(t, () => {
      for (const style of STYLE_IDS) for (const mode of ['light', 'dark'] as const) {
        const s = withTreat({ ...defaultSpec({ graphic: 41, colour: 5 }), style, mode }, t);
        const g1 = treated(s), g2 = treated(structuredClone(s));
        expect(g1.params).toEqual(g2.params);
        expect(g1.colours).toEqual(g2.colours);
        expect(g1.params.treat).toBe(t);
        const a = pic(), b = pic();
        treatPixels(a, W0, H0, g1.params, treatColours(g1), 1);
        treatPixels(b, W0, H0, g2.params, treatColours(g2), 1);
        expect(Buffer.from(a).equals(Buffer.from(b)), `${t} ${style} ${mode}`).toBe(true);
        // the treatment does something, except colour
        if (t !== 'colour') expect(Buffer.from(a).equals(Buffer.from(pic())), `${t} changes the pixels`).toBe(false);
      }
    });
  }
  test('the same spec draws the same treatment and values; the stream is the graphic seed\'s alone', () => {
    for (let i = 0; i < 40; i++) {
      const s = withTreat({ ...defaultSpec({ graphic: 1000 + i }), style: STYLE_IDS[i % 4] }, null);
      const P = choosePalette(s), L = STYLES[s.style].parts.graphics.treatments;
      const a = treatOf(s, P, L);
      expect(treatOf(structuredClone(s), P, L)).toEqual(a);
      // another layout, colour or type seed: the same treatment and values
      const o = { ...s, seeds: { ...s.seeds, layout: 7, type: 9 } };
      expect(treatOf(o, P, L)).toEqual(a);
    }
  });
});

describe('duotone and posterise use only palette colours (spec 8.9, R15 Done when)', () => {
  test('duotone: its two colours are palette colours, and every pixel lies between them', () => {
    let n = 0;
    for (const style of STYLE_IDS) for (const p of PALETTES[style]) for (const mode of ['light', 'dark'] as const) {
      const P = formOf(p, mode), pal = paletteColours(P).map((c) => c.hex.toLowerCase());
      for (let g = 0; g < 3; g++) {
        const s = withTreat({ ...defaultSpec({ graphic: 500 + g }), style, mode, pick: { ...defaultSpec().pick, palette: p.id } }, 'duotone');
        const it = treated(s), cols = treatColours(it);
        expect(cols.length).toBe(2);
        for (const c of cols) expect(pal, `${style} ${p.id} ${mode}`).toContain(c.toLowerCase());
        const d = pic();
        treatPixels(d, W0, H0, it.params, cols, 1);
        const [A, B] = hexes(cols);
        for (let i = 0; i < d.length; i += 4) {
          // on the segment A..B: one t fits every channel within rounding
          // t read off the channel A and B differ most in; every channel then sits at A + (B - A) t within rounding
          const q = rgb(d, i), m = [0, 1, 2].reduce((x, c) => (Math.abs(B[c] - A[c]) > Math.abs(B[x] - A[x]) ? c : x), 0);
          const t = B[m] === A[m] ? 0 : (q[m] - A[m]) / (B[m] - A[m]);
          for (let c = 0; c < 3; c++) expect(Math.abs(q[c] - (A[c] + (B[c] - A[c]) * t))).toBeLessThanOrEqual(1.5);
          expect(t >= -0.01 && t <= 1.01).toBe(true);
        }
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });
  test('posterise: three to five palette colours (as many as the palette has), and every pixel is one of them', () => {
    let n = 0;
    for (const style of STYLE_IDS) for (const p of PALETTES[style]) for (const mode of ['light', 'dark'] as const) {
      const P = formOf(p, mode), pal = paletteColours(P).map((c) => c.hex.toLowerCase());
      for (const levels of [undefined, 3, 4, 5]) {
        const s0 = withTreat({ ...defaultSpec({ graphic: 77 }), style, mode, pick: { ...defaultSpec().pick, palette: p.id } }, 'posterise');
        const s = levels ? { ...s0, params: { 'photo.levels': levels } } : s0;
        const it = treated(s), cols = treatColours(it);
        // a palette of fewer than three colours does not posterise (review R15 S1): checked below
        if (pal.length < POSTERISE_MIN) { expect(it.params.treat).not.toBe('posterise'); continue; }
        expect(it.params.treat).toBe('posterise');
        expect(cols.length).toBe(Math.min(levels ?? cols.length, pal.length));
        expect(cols.length).toBeGreaterThanOrEqual(3);
        expect(cols.length).toBeLessThanOrEqual(5);
        for (const c of cols) expect(pal).toContain(c.toLowerCase());
        const allowed = new Set(cols.map((c) => parseHex(c).join()));
        const d = pic();
        treatPixels(d, W0, H0, it.params, cols, 1);
        for (let i = 0; i < d.length; i += 4) expect(allowed.has(rgb(d, i).join())).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(100);
  });
  test('posterise is not offered where the palette has fewer than three colours (Swiss yellow light); the stream and a pick by hand draw another', () => {
    const P = formOf(PALETTES.swiss.find((p) => p.id === 'yellow')!, 'light');
    expect(paletteColours(P).length).toBeLessThan(POSTERISE_MIN);
    expect(treatOffered('posterise', P)).toBe(false);
    expect(TREATMENTS.filter((t) => !treatOffered(t, P))).toEqual(['posterise']);
    expect(treatmentControl(undefined, P).options.map((o) => o.v)).not.toContain('posterise');
    expect(treatmentControl().options.map((o) => o.v)).toContain('posterise');
    const L = STYLES.swiss.parts.graphics.treatments;
    for (let g = 0; g < 20; g++) {
      const s = withTreat({ ...defaultSpec({ graphic: 300 + g }), style: 'swiss', mode: 'light', pick: { ...defaultSpec().pick, palette: 'yellow' } }, 'posterise');
      const t = treatOf(s, P, L);
      expect(t.name).toBe(L.favourite);
      expect(treated(s).params.treat).toBe(L.favourite);
    }
    // a list whose favourite is posterise falls back to threshold
    expect(treatOf(withTreat(defaultSpec(), 'posterise'), P, { allow: ['posterise'], favourite: 'posterise' }).name).toBe('threshold');
  });
  test('threshold, halftone and dither draw only their two palette colours (and, for the halftone, the edge between)', () => {
    for (const style of STYLE_IDS) for (const t of ['threshold', 'dither', 'halftone'] as const) {
      const it = treated(withTreat({ ...defaultSpec({ graphic: 3 }), style }, t)), cols = treatColours(it);
      const P = choosePalette(withTreat({ ...defaultSpec({ graphic: 3 }), style }, t));
      expect(treatPairs(P)).toContain(it.params.duo);
      const d = pic();
      treatPixels(d, W0, H0, it.params, cols, 1);
      const [A, B] = hexes(cols), seen = new Set<string>();
      for (let i = 0; i < d.length; i += 4) {
        const q = rgb(d, i);
        if (t !== 'halftone') expect([A.join(), B.join()]).toContain(q.join());
        seen.add(q.join());
      }
      expect(seen.has(A.join()) && seen.has(B.join()), `${style} ${t} draws both colours`).toBe(true);
    }
  });
});

describe('duotone takes an accent where one pairs at 3:1 (review R15 M1)', () => {
  test('the stream\'s duotone pair has an accent in it wherever the palette has such a pair; by hand any pair', () => {
    const NEUTRAL = ['ground', 'ink', 'paper', 'toner', 'window', 'windowInk'];
    let withAccent = 0;
    for (const style of STYLE_IDS) for (const p of PALETTES[style]) for (const mode of ['light', 'dark'] as const) {
      const P = formOf(p, mode), all = treatPairs(P), acc = duoPairs(P);
      const hasAcc = all.some((id) => id.split('+').some((r) => !NEUTRAL.includes(r)));
      for (const id of acc) expect(all).toContain(id);
      for (let g = 0; g < 6; g++) {
        const s = withTreat({ ...defaultSpec({ graphic: 700 + g }), style, mode, pick: { ...defaultSpec().pick, palette: p.id } }, 'duotone');
        const duo = String(treated(s).params.duo);
        expect(acc).toContain(duo);
        if (hasAcc) { expect(duo.split('+').some((r) => !NEUTRAL.includes(r)), `${style} ${p.id} ${mode}: ${duo}`).toBe(true); withAccent++; }
      }
      // a pair picked by hand is drawn even where it is ground + ink
      if (all.includes('ground+ink')) {
        const s = { ...withTreat({ ...defaultSpec({ graphic: 700 }), style, mode, pick: { ...defaultSpec().pick, palette: p.id } }, 'duotone'), params: { 'photo.duo': 'ground+ink' } };
        expect(treated(s).params.duo).toBe('ground+ink');
      }
    }
    expect(withAccent).toBeGreaterThan(50);
  });
});

describe('picked by the graphic stream from the style\'s list, or by hand (spec 8.9)', () => {
  test('300 shuffles draw every treatment the style allows and nothing else, the favourite most', () => {
    for (const style of STYLE_IDS) {
      const L = STYLES[style].parts.graphics.treatments, count = new Map<string, number>();
      for (let i = 0; i < 300; i++) {
        const s = withTreat({ ...defaultSpec({ graphic: i * 7919 + 13 }), style }, null);
        const t = treatOf(s, choosePalette(s), L).name;
        count.set(t, (count.get(t) ?? 0) + 1);
      }
      expect([...count.keys()].sort()).toEqual([...L.allow].sort());
      const fav = count.get(L.favourite)!;
      for (const [t, k] of count) if (t !== L.favourite) expect(fav, `${style}: ${L.favourite} against ${t}`).toBeGreaterThan(k);
      expect(FAV_WEIGHT).toBeGreaterThan(1);
    }
  });
  test('Postmodern draws from its dialect\'s list', () => {
    const G = STYLES.pomo.parts.graphics;
    for (const d of ['icecream', 'photocopy'] as const) for (let i = 0; i < 40; i++) {
      const s: Spec = { ...withTreat({ ...defaultSpec({ graphic: 900 + i, layout: 50 + i }), style: 'pomo' }, null), pick: { ...defaultSpec().pick, dialect: d } };
      expect(G.treatmentsOf![d]!.allow).toContain(treated(s).params.treat);
    }
  });
  test('Postmodern unpinned: every scene\'s treatment is in the list of the dialect it drew (review R15 M4)', () => {
    const G = STYLES.pomo.parts.graphics, seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const s = withTreat({ ...defaultSpec({ graphic: 1900 + i * 31, layout: 2900 + i * 17 }), style: 'pomo' }, null);
      const sc = solve(s, stubMeasure).scene, d = COPY_LAYOUTS.includes(sc.frame) ? 'photocopy' : 'icecream';
      if (d === 'icecream') expect(ICE_LAYOUTS).toContain(sc.frame);
      seen.add(d);
      expect(G.treatmentsOf![d]!.allow, `${d} ${i}`).toContain(photoOfScene(sc)!.params.treat);
    }
    expect(seen.size).toBe(2);
  });
  test('a treatment picked by hand is drawn in every style, allowed or not; an unknown one is dropped on load', () => {
    for (const style of STYLE_IDS) for (const t of TREATMENTS) {
      const s = withTreat({ ...defaultSpec(), style }, t);
      if (treatOffered(t, choosePalette(s))) expect(treated(s).params.treat).toBe(t);
    }
    expect(migrate({ ...defaultSpec(), photo: { id: 'x', treatment: 'sepia', place: null } }).photo!.treatment).toBeNull();
    expect(migrate({ ...defaultSpec(), photo: { id: 'x', treatment: 'dither', place: null } }).photo!.treatment).toBe('dither');
  });
  test('Shuffle and New graphic clear the treatment and its parameters unless Graphic is locked; a style change clears them', () => {
    const s: Spec = { ...withTreat(defaultSpec(), 'halftone'), params: { 'photo.screen': 30, 'layout.size': 'small' } };
    expect(facetOfParam('photo.screen')).toBe('graphic');
    const a = shuffle(s, NO_LOCKS, () => 5);
    expect(a.photo!.treatment).toBeNull();
    expect(a.params['photo.screen']).toBeUndefined();
    const b = shuffle(s, { ...NO_LOCKS, graphic: true }, () => 5);
    expect(b.photo!.treatment).toBe('halftone');
    expect(b.params['photo.screen']).toBe(30);
    const c = reroll(s, 'graphic', () => 5);
    expect(c.photo!.treatment).toBeNull();
    expect(reroll(s, 'layout', () => 5).photo!.treatment).toBe('halftone');
    expect(withStyle(s, 'brutal').photo!.treatment).toBeNull();
  });
});

describe('Advanced: the treatment and its parameters (spec 10.3 Photo)', () => {
  test('the drawn treatment\'s parameters are offered, each changes what is drawn, and they are Graphic\'s', () => {
    const want: Record<Treatment, string[]> = { colour: [], mono: ['photo.contrast'], duotone: ['photo.duo'], halftone: ['photo.duo', 'photo.screen', 'photo.angle'], threshold: ['photo.duo', 'photo.level'], posterise: ['photo.levels'], dither: ['photo.duo', 'photo.dot'] };
    const seen = new Set<string>();
    for (const style of STYLE_IDS) for (const t of TREATMENTS) {
      const s = withTreat({ ...defaultSpec({ colour: 11 }), style, mode: 'light' }, t), sc = solve(s, stubMeasure).scene;
      const cs = advancedOf(s, sc).tabs.photo, ids = cs.map((c) => c.id);
      expect(ids).toContain('photo.treatment');
      // the roles only where the palette has more than one pair, the colour count only where it has more than three colours
      const P = choosePalette(s), skip = [...(treatPairs(P).length > 1 ? [] : ['photo.duo']), ...(paletteColours(P).length > 3 ? [] : ['photo.levels'])];
      for (const k of want[t]) if (!skip.includes(k)) expect(ids, t).toContain(k);
      ids.forEach((k) => seen.add(k));
      for (const c of cs.filter((c) => c.id.startsWith('photo.') && !['photo.role', 'photo.scale', 'photo.x', 'photo.y'].includes(c.id))) {
        expect(c.facet).toBe('graphic');
        if (c.id === 'photo.treatment') continue;
        const vals = c.kind === 'choice' ? c.options.map((o) => o.v).filter((v) => v !== null) : c.kind === 'range' ? [c.min, c.max] : [];
        const sigs = new Set(vals.map((v) => JSON.stringify(photoOfScene(solve(apply(s, c, v), stubMeasure).scene)!.params) + JSON.stringify(photoOfScene(solve(apply(s, c, v), stubMeasure).scene)!.colours)));
        expect(sigs.size, `${t} ${c.id}`).toBeGreaterThan(1);
      }
    }
    // every parameter is offered somewhere
    for (const k of Object.values(want).flat()) expect([...seen]).toContain(k);
  });
  test('the treatment control writes photo.treatment', () => {
    const s = withTreat(defaultSpec(), null), sc = solve(s, stubMeasure).scene;
    const c = allControls(advancedOf(s, sc)).find((x) => x.id === 'photo.treatment')!;
    expect(apply(s, c, 'threshold').photo!.treatment).toBe('threshold');
    expect(apply(apply(s, c, 'threshold'), c, null).photo!.treatment).toBeNull();
  });
});

describe('text over a treated photo (spec 8.9, 9.4)', () => {
  test('what is measured under text is what the treatment draws there', () => {
    // threshold and posterise widened by the slack; screens show both colours; duotone maps the ends
    const g = (treat: string, colours: string[], extra: Record<string, number> = {}) => ({ params: { treat, ...extra }, colours: Object.fromEntries(colours.map((c, i) => ['t' + i, c])) });
    expect(treatedRange(g('threshold', ['#000000', '#FFFFFF'], { level: 0.5 }), '#202020', '#404040')).toEqual({ lo: '#000000', hi: '#000000' });
    expect(treatedRange(g('threshold', ['#000000', '#FFFFFF'], { level: 0.5 }), '#202020', '#7A7A7A')).toEqual({ lo: '#000000', hi: '#FFFFFF' });
    expect(treatedRange(g('halftone', ['#111111', '#EEEEEE']), '#FFFFFF', '#FFFFFF')).toEqual({ lo: '#111111', hi: '#EEEEEE' });
    expect(treatedRange(g('duotone', ['#000000', '#FF0000']), '#000000', '#FFFFFF')).toEqual({ lo: '#000000', hi: '#FF0000' });
    expect(treatedRange(g('posterise', ['#000000', '#555555', '#AAAAAA', '#FFFFFF']), '#F0F0F0', '#FFFFFF')).toEqual({ lo: '#FFFFFF', hi: '#FFFFFF' });
    // every pixel the kernel draws from a pixel in [lo, hi] lies in what is measured
    for (const treat of ['duotone', 'threshold', 'posterise', 'mono'] as const) {
      const cols = ['#102030', '#806040', '#F0E0C0'], it = g(treat, treat === 'posterise' ? cols : [cols[0], cols[2]], { level: 0.45, contrast: 1.3 });
      for (const [lo, hi] of [['#000000', '#303030'], ['#606060', '#909090'], ['#C0C0C0', '#FFFFFF'], ['#000000', '#FFFFFF']]) {
        const m = treatedRange(it, lo, hi);
        const L = (h: string) => { const [r, gg, b] = parseHex(h); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
        for (let v = parseHex(lo)[0]; v <= parseHex(hi)[0]; v += 3) {
          const d = new Uint8ClampedArray([v, v, v, 255]);
          treatPixels(d, 1, 1, it.params, treatColours(it), 1);
          const y = 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
          expect(y, `${treat} ${lo}..${hi} at ${v}`).toBeGreaterThanOrEqual(L(m.lo) - 1.5);
          expect(y, `${treat} ${lo}..${hi} at ${v}`).toBeLessThanOrEqual(L(m.hi) + 1.5);
        }
      }
    }
  });
  test('mono at contrast 1.8 and duotone: a pixel off the grid\'s read by the slack still lies in what is measured (review R15 M6)', () => {
    const g = (treat: string, colours: string[], extra: Record<string, number> = {}) => ({ params: { treat, ...extra }, colours: Object.fromEntries(colours.map((c, i) => ['t' + i, c])) });
    const L = (h: string) => { const [r, gg, b] = parseHex(h); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
    const S = Math.floor(TONE_SLACK * 255);
    for (const it of [g('mono', [], { contrast: 1.8 }), g('mono', [], { contrast: 0.6 }), g('duotone', ['#102030', '#F0E0C0'])]) {
      for (const [lo, hi] of [[40, 60], [100, 140], [180, 200], [0, 30], [230, 255]]) {
        const m = treatedRange(it, toHex([lo, lo, lo]), toHex([hi, hi, hi]));
        for (let v = Math.max(0, lo - S); v <= Math.min(255, hi + S); v++) {
          const d = new Uint8ClampedArray([v, v, v, 255]);
          treatPixels(d, 1, 1, it.params, treatColours(it), 1);
          const y = 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
          expect(y, `${JSON.stringify(it.params)} ${lo}..${hi} at ${v}`).toBeGreaterThanOrEqual(L(m.lo) - 1.5);
          expect(y, `${JSON.stringify(it.params)} ${lo}..${hi} at ${v}`).toBeLessThanOrEqual(L(m.hi) + 1.5);
        }
      }
    }
  });
  test('9.2 with the test photo in every treatment, every style (stub measure)', () => {
    for (const style of STYLE_IDS) for (const t of TREATMENTS) {
      const r = runInvariants(stubMeasure, { styles: [style], n: 7, variants: 'cycle', photo: { id: t.length % 2 ? PORTRAIT : LANDSCAPE, treatment: t, place: null } });
      expect(r.failures.map((f) => [style, t, f.failures[0], JSON.stringify(f.spec)])).toEqual([]);
      expect(r.fallbacks, `${style} ${t}: fallbacks`).toBe(0);
    }
  }, 600000);
  test('every text item over a treated photo passes rule 4, on a plate or measured; both happen', () => {
    let measured = 0, over = 0;
    for (const style of STYLE_IDS) for (const t of TREATMENTS) for (let i = 0; i < 4; i++) {
      const s: Spec = { ...defaultSpec({ layout: 60 + i, colour: 70 + i, graphic: 80 + i, type: 90 + i }), style, format: FORMAT_LIST[i % FORMAT_LIST.length], mode: i % 2 ? 'dark' : 'light', photo: { id: PORTRAIT, treatment: t, place: { role: 'ground', scale: 2.5, x: 0.5, y: i / 2 } } };
      const sc = solve(s, stubMeasure).scene, at = sc.items.findIndex((x) => x.kind === 'graphic' && x.name === 'photo'), g = sc.items[at] as GraphicItem;
      sc.items.forEach((x, k) => {
        if (k <= at || x.kind !== 'text') return;
        over++;
        expect(lowContrast(sc, k), `${style} ${t} ${x.slot}`).toBeNull();
        if (g.regions?.some((r) => contains(r.quad, x.quad))) measured++;
      });
    }
    expect(over).toBeGreaterThan(0);
    expect(measured).toBeGreaterThan(0);
  }, 240000);
  test('a colour edit moves a palette treatment\'s colours with it, and text over it still passes or is warned of', () => {
    for (const style of STYLE_IDS) for (const t of ['duotone', 'posterise', 'threshold'] as const) {
      const s = withTreat({ ...defaultSpec({ graphic: 4 }), style }, t), g0 = treated(s);
      const P = choosePalette(s), ink = (P.ink as string).toLowerCase();
      const e = setColour(s, ['ink'], '#7f00ff'), sc = solve(e, stubMeasure).scene, g1 = photoOfScene(sc)!;
      const before = treatColours(g0).map((c) => c.toLowerCase()), after = treatColours(g1).map((c) => c.toLowerCase());
      expect(after).toEqual(before.map((c) => (c === ink ? '#7f00ff' : c)));
      sc.items.forEach((x, k) => { if (x.kind === 'text' && !x.waive?.includes(4) && lowContrast(sc, k)) expect(sc.colourWarn ?? []).toContain(`${x.slot}.${x.part}`); });
    }
  });
});

describe('the treated box is kept between paints (review R15 M2)', () => {
  const G = globalThis as unknown as { OffscreenCanvas?: unknown };
  const had = G.OffscreenCanvas;
  afterEach(() => { G.OffscreenCanvas = had; clearTreated(); });
  test('a second paint of the same box does not treat again; the stage and four style tiles all stay kept', () => {
    let made = 0, treatedN = 0;
    G.OffscreenCanvas = class {
      constructor(public width: number, public height: number) { made++; }
      getContext() {
        const w = this.width, h = this.height, canvas = this;
        return { canvas, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4).fill(128) }), putImageData() { treatedN++; }, set imageSmoothingEnabled(_: boolean) {}, set imageSmoothingQuality(_: string) {} };
      }
    };
    clearTreated();
    expect(TREATED_KEEP).toBeGreaterThanOrEqual(6);
    // a photo with a picture (the stub draws nothing from it)
    registerPhoto({ ...testPhoto('test-img', 400, 300, 3), img: {} as CanvasImageSource });
    const g0 = treated(withTreat({ ...defaultSpec({ graphic: 5 }), style: 'swiss' }, 'threshold'));
    // five boxes, as the stage and the Style tab's four tiles make per Shuffle
    const boxes = [0, 1, 2, 3, 4].map((k): GraphicItem => ({ ...g0, params: { ...g0.params, id: 'test-img' }, box: { x: 0, y: 0, w: 12 + k, h: 10 } }));
    const first = boxes.map((b) => treatedBox(b, 1));
    expect(treatedN).toBe(5);
    expect(treatedKept()).toBe(5);
    const again = boxes.map((b) => treatedBox(b, 1));
    expect(treatedN, 'the second paint treated again').toBe(5);
    again.forEach((c, k) => expect(c).toBe(first[k]));
    // fresh (the timing) treats again and keeps nothing new
    treatedBox(boxes[0], 1, true);
    expect(treatedN).toBe(6);
    clearTreated();
    expect(treatedKept()).toBe(0);
    treatedBox(boxes[0], 1);
    expect(treatedN).toBe(7);
    expect(made).toBe(7);
  });
});
