import { describe, expect, test } from 'vitest';
import { PAIRINGS, type Pairing } from '../src/data/pairings';
import { PALETTES } from '../src/data/palettes';
import { stubMeasure } from '../src/engine/measure';
import { picksOf, runIndependence, runInvariants, specs, textVariants } from '../src/engine/proof';
import { solve } from '../src/engine/layout';
import { mix } from '../src/engine/rng';
import { STYLE_IDS, type StyleId } from '../src/engine/spec';

const show = (fs: { spec: unknown }[]) => fs.slice(0, 3).map((f) => JSON.stringify(f)).join('\n');

describe('9.2 on the stub measure, every style x format x mode, every text variant on every seed set', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 10 });
      expect(r.count).toBe(10 * textVariants().length * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
    });
  }
});

describe('9.2 with every value of pick.layout and pick.motif', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 9, picks: 'each', variants: 'cycle' });
      expect(r.count).toBe(picksOf(style).length * 9 * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
    });
  }
  test('the specs carry the picks', () => {
    const got = [...specs({ styles: ['swiss'], formats: ['1:1'], modes: ['light'], n: 1, picks: 'each', variants: 'cycle' })].map((s) => s.pick);
    expect(got.map((p) => p.layout ?? p.motif)).toEqual(picksOf('swiss').map((p) => p.layout ?? p.motif));
  });
  test('a picked Vaporwave sky title at 1:1 falls back to a frame that passes', () => {
    const r = runInvariants(stubMeasure, { styles: ['vapor'], formats: ['1:1'], n: 40, picks: 'each', variants: 'cycle' });
    expect(r.failures, show(r.failures)).toEqual([]);
  });
});

describe('9.2 with every palette picked, in both modes', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 9, palettes: true, variants: 'cycle' });
      expect(r.count).toBe(PALETTES[style].length * 9 * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
    });
  }
  test('the specs carry the palettes and both modes', () => {
    const got = [...specs({ styles: ['pomo'], formats: ['1:1'], n: 1, palettes: true, variants: 'cycle' })];
    expect(new Set(got.map((s) => s.pick.palette))).toEqual(new Set(PALETTES.pomo.map((p) => p.id)));
    expect(new Set(got.map((s) => s.mode))).toEqual(new Set(['light', 'dark']));
  });
});

describe('9.3 stream independence on the stub measure, light and dark', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runIndependence(stubMeasure, { styles: [style], n: 30, variants: 'cycle' });
      expect(r.count).toBe(30 * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
      const p = runIndependence(stubMeasure, { styles: [style], n: 6, picks: 'each', variants: 'cycle' });
      expect(p.failures, show(p.failures)).toEqual([]);
    });
  }
});

/** A copy of the style's default pairing in a face the stub measures at a different width. */
function stubPairing(style: StyleId): Pairing {
  const base = PAIRINGS[style][0];
  const fam = base.display.family.includes('Unbounded') ? 'Anton' : 'Unbounded';
  const out: Record<string, unknown> = { ...base, id: 'stub-' + style, name: 'Stub' };
  for (const [k, v] of Object.entries(base)) if (v && typeof v === 'object' && 'family' in v) out[k] = { ...v, family: fam };
  return out as unknown as Pairing;
}

describe('9.3 type seed with a second pairing of different widths', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const extra = stubPairing(style);
      PAIRINGS[style].push(extra);
      try {
        const r = runIndependence(stubMeasure, { styles: [style], n: 20, variants: 'cycle' });
        expect(r.failures, show(r.failures)).toEqual([]);
        // the test means something only if the type seed did change the pairing and the text for some specs
        let moved = 0;
        for (const s of specs({ styles: [style], n: 20, variants: 'cycle' })) {
          const t = structuredClone(s);
          t.seeds.type = mix(t.seeds.type, 77);
          const a = solve(s, stubMeasure).scene, b = solve(t, stubMeasure).scene;
          if (a.pairing !== b.pairing) moved++;
        }
        expect(moved).toBeGreaterThan(0);
      } finally {
        PAIRINGS[style].splice(PAIRINGS[style].indexOf(extra), 1);
      }
    });
  }
});
