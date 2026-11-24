import { describe, expect, test } from 'vitest';
import { GRAPHICS } from '../src/engine/graphics';
import { chooseParams, lerpRange, paramKey } from '../src/engine/graphics/params';
import { check } from '../src/engine/invariants';
import { solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { pickForGraphic, runVariety, specs, textVariants, varietyOf, type VarietyRow } from '../src/engine/proof';
import { rng } from '../src/engine/rng';
import type { GraphicItem } from '../src/engine/scene';
import { STYLES } from '../src/engine/styles';
import { STYLE_IDS, type StyleId } from '../src/engine/spec';

const show = (fs: unknown[]) => fs.slice(0, 3).map((f) => JSON.stringify(f)).join('\n');
const usesOf = (s: StyleId) => [...STYLES[s].parts.ground.uses, ...STYLES[s].parts.graphics.uses];

describe('the shared graphics library (spec 8.0)', () => {
  test('every graphic has at least three ranged parameters, default inside the range', () => {
    for (const G of Object.values(GRAPHICS)) {
      const ps = Object.entries(G.params);
      expect(ps.length, G.name).toBeGreaterThanOrEqual(3);
      for (const [k, R] of ps) {
        expect(R.min, `${G.name}.${k}`).toBeLessThan(R.max);
        expect(R.def, `${G.name}.${k}`).toBeGreaterThanOrEqual(R.min);
        expect(R.def, `${G.name}.${k}`).toBeLessThanOrEqual(R.max);
      }
      expect(G.draw.length, G.name + ' takes (ctx, g, r, t)').toBe(4);
    }
  });
  test('every graphic is used by a style, and every style uses only library graphics', () => {
    const used = new Set(STYLE_IDS.flatMap(usesOf));
    expect([...used].sort()).toEqual(Object.keys(GRAPHICS).sort());
    expect(GRAPHICS.lines).toBeDefined();
  });
  test('drawn values cover each range end to end; an Advanced value wins and is clamped', () => {
    for (const G of Object.values(GRAPHICS)) for (const [k, R] of Object.entries(G.params)) {
      expect(lerpRange(R, 0)).toBeCloseTo(R.min, 9);
      expect(lerpRange(R, 0.999999)).toBeCloseTo(R.max, 3);
      const r = rng(7), xs = Array.from({ length: 400 }, () => chooseParams(G, {}, r)[k]);
      expect(Math.min(...xs) - R.min, `${G.name}.${k} low end`).toBeLessThan((R.max - R.min) * 0.1 + (R.int ? 1 : 0));
      expect(R.max - Math.max(...xs), `${G.name}.${k} high end`).toBeLessThan((R.max - R.min) * 0.1 + (R.int ? 1 : 0));
      expect(chooseParams(G, { [paramKey(G.name, k)]: R.max + 1000 }, rng(1))[k]).toBe(R.max);
      expect(chooseParams(G, { [paramKey(G.name, k)]: R.min }).hasOwnProperty(k)).toBe(true);
    }
  });
});

describe('9.2 with every graphic parameter at both ends of its range, per style', () => {
  // On the Scene this can only fail through placement: boxes and fills are set before parameters matter and
  // every draw is clipped to its box. What an extreme can break in pixels is checked in smoke (graphicLeak).
  // Here: every text variant at each end, no fallback, and the value reaches every Scene that has the graphic.
  for (const style of STYLE_IDS) {
    test(style, () => {
      let ends = 0;
      const missing: string[] = [];
      for (const name of usesOf(style)) for (const [k, R] of Object.entries(GRAPHICS[name].params)) for (const v of [R.min, R.max]) {
        ends++;
        const pick = pickForGraphic(style, name);
        let reached = 0, absent = 0, n = 0, fallbacks = 0;
        const fails: unknown[] = [];
        for (const s of specs({ styles: [style], n: 2, start: 40, params: { [paramKey(name, k)]: v, 'graphics.cut': 2 }, pick })) {
          n++;
          const sc = solve(s, stubMeasure).scene;
          if (sc.layout === 'fallback') fallbacks++;
          const f = check(sc);
          if (f.length) fails.push({ spec: s, f });
          const gs = sc.items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.name === name);
          if (!gs.length) absent++;
          else if (gs.every((g) => g.params[k] === v)) reached++;
        }
        const label = `${style} ${name}.${k} = ${v}`;
        expect(fails, label + '\n' + show(fails)).toEqual([]);
        expect(fallbacks, label + ': fallbacks').toBe(0);
        // the value reaches every Scene the graphic is in; a Scene without it is one the style could not place it in
        expect(reached, label + ': Scenes with the graphic but not the value').toBe(n - absent);
        expect(absent, label + ': never placed').toBeLessThan(n);
        if (absent) missing.push(`${name}.${k}=${v}: ${absent}/${n}`);
        expect(n).toBe(2 * 3 * 2 * textVariants().length);
      }
      // only Brutalist may fail to place its graphic: its band needs room the title can take (for R8)
      if (style !== 'brutal') expect(missing, style).toEqual([]);
      else console.log(`range ends, ${style}: Scenes where the band graphic could not be placed: ${missing.length ? missing.slice(0, 4).join('; ') + (missing.length > 4 ? ' ...' : '') : 'none'}`);
      expect(ends).toBeGreaterThanOrEqual(usesOf(style).length * 6);
    }, 120000);
  }
});

describe('the variety tests of spec 8.0', () => {
  const lists = { layouts: ['a', 'b', 'c', 'd', 'e'], graphics: ['g1', 'g2'], palettes: ['p1', 'p2'], pairings: ['t1'] };
  const row = (frame: string, g: string[], palette = 'p1', transform = 'none'): VarietyRow => ({ frame, transform, graphics: g, palette, pairing: 't1' });
  test('catch a repeat in 60, something missing in 300, a layout over 25%', () => {
    const ok = Array.from({ length: 60 }, (_, i) => row('abcde'[i % 5], ['g1', 'g2'], 'p' + (i % 2 + 1), String(i)));
    expect(varietyOf(ok, lists).pass).toEqual({ sixty: true, coverage: true, share: true });
    const rep = [...ok.slice(0, 59), { ...ok[3] }];
    expect(varietyOf(rep, lists).repeats60).toBe(1);
    expect(varietyOf(rep, lists).pass.sixty).toBe(false);
    const miss = ok.map((r) => ({ ...r, graphics: ['g1'] }));
    expect(varietyOf(miss, lists).missing.graphics).toEqual(['g2']);
    const heavy = ok.map((r, i) => ({ ...r, frame: i < 16 ? 'a' : r.frame }));
    expect(varietyOf(heavy, lists).pass.share).toBe(false);
    // a repeat after the first 60 does not count against the 60-shuffle test
    expect(varietyOf([...ok, { ...ok[0] }], lists).repeats60).toBe(0);
  });
  test('Swiss passes all three in every format on the stub measure (row R5, Carried R13 item 4)', () => {
    for (const f of ['1:1', '3:4', '9:16'] as const) {
      const v = runVariety(stubMeasure, 'swiss', f, 300);
      console.log(`variety swiss ${f} (stub): repeats in 60 ${v.repeats60}; missing ${JSON.stringify(v.missing)}; top layout ${v.top.layout} ${(v.top.share * 100).toFixed(0)}%`);
      expect(v.count).toBe(300);
      expect(v.pass, `swiss ${f}: ${JSON.stringify(v)}`).toEqual({ sixty: true, coverage: true, share: true });
    }
  }, 120000);
  test('Postmodern passes all three in every format counting both dialects, and each dialect alone meets the 60-shuffle test (row R6)', () => {
    for (const f of ['1:1', '3:4', '9:16'] as const) {
      const v = runVariety(stubMeasure, 'pomo', f, 300);
      console.log(`variety pomo ${f} (stub): repeats in 60 ${v.repeats60}; missing ${JSON.stringify(v.missing)}; top layout ${v.top.layout} ${(v.top.share * 100).toFixed(0)}%`);
      expect(v.pass, `pomo ${f}: ${JSON.stringify(v)}`).toEqual({ sixty: true, coverage: true, share: true });
      for (const dialect of ['icecream', 'photocopy'] as const) {
        const d = runVariety(stubMeasure, 'pomo', f, 300, undefined, { dialect });
        console.log(`variety pomo ${f} ${dialect} (stub): repeats in 60 ${d.repeats60}; missing ${JSON.stringify(d.missing)}; top layout ${d.top.layout} ${(d.top.share * 100).toFixed(0)}%`);
        expect(d.pass.sixty, `pomo ${f} ${dialect}: ${d.repeats60} repeats`).toBe(true);
        expect(d.missing, `pomo ${f} ${dialect}`).toEqual({ layouts: [], graphics: [], palettes: [], pairings: [] });
      }
    }
  }, 240000);
  test('run for every other style on the stub measure and report (enforced from each style\'s own row)', () => {
    for (const style of STYLE_IDS.filter((s) => s !== 'swiss' && s !== 'pomo')) {
      const v = runVariety(stubMeasure, style, '3:4', 300);
      expect(v.count).toBe(300);
      // reported only until each style's own row enforces it (review R13 M4: R5 asserts v.pass for Swiss here)
      console.log(`variety ${style} 3:4 (stub): repeats in 60 ${v.repeats60}; missing ${JSON.stringify(v.missing)}; top layout ${v.top.layout} ${(v.top.share * 100).toFixed(0)}%`);
    }
  }, 240000);
});
