import { describe, expect, test } from 'vitest';
import { CORE_FAMILIES, CORE_FONTS, defaultPairing, faceKey, facesOf, isCoreFace, PAIRINGS, type Pairing } from '../src/data/pairings';
import { PALETTES } from '../src/data/palettes';
import { stubMeasure } from '../src/engine/measure';
import { picksOf, runIndependence, runInvariants, seedSet, specs, textVariants } from '../src/engine/proof';
import { resolvePairing, solve, unloadedFaces } from '../src/engine/layout';
import { defaultSpec, STYLE_IDS, type Spec, type StyleId } from '../src/engine/spec';

const show = (fs: { spec: unknown }[]) => fs.slice(0, 3).map((f) => JSON.stringify(f)).join('\n');
/** The specs that fell back, for the message when a fallback was not expected. */
const showFb = (r: { fallbackSpecs: unknown[] }) => r.fallbackSpecs.slice(0, 3).map((s) => JSON.stringify(s)).join('\n');
/**
 * Fallbacks allowed when a layout or motif is picked (review R2 S1): a picked Vaporwave sky title cannot
 * always fit. Counts as of R2; a rise means a change cut candidates. Unpicked and per-palette runs allow none.
 */
// vapor 10 -> 12 in R3: the type seed now reaches wider display faces. The 12 is stub-only: it rests on the stub's
// name-hash widths (src/engine/measure.ts), not real metrics. Re-derive it from the online smoke run when possible.
const PICKED_FALLBACKS: Record<StyleId, number> = { swiss: 0, pomo: 0, brutal: 0, vapor: 12 };

describe('9.2 on the stub measure, every style x format x mode, every text variant on every seed set', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 10 });
      expect(r.count).toBe(10 * textVariants().length * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
      expect(r.fallbacks, showFb(r)).toBe(0);
    });
  }
});

describe('9.2 with every value of pick.layout and pick.motif', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 9, picks: 'each', variants: 'cycle' });
      expect(r.count).toBe(picksOf(style).length * 9 * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
      expect(r.fallbacks, showFb(r)).toBeLessThanOrEqual(PICKED_FALLBACKS[style]);
    });
  }
  test('the specs carry the picks', () => {
    const got = [...specs({ styles: ['swiss'], formats: ['1:1'], modes: ['light'], n: 1, picks: 'each', variants: 'cycle' })].map((s) => s.pick);
    expect(got.map((p) => p.layout ?? p.motif)).toEqual(picksOf('swiss').map((p) => p.layout ?? p.motif));
  });
  test('a picked Vaporwave sky title at 1:1 falls back to a frame that passes', () => {
    const r = runInvariants(stubMeasure, { styles: ['vapor'], formats: ['1:1'], n: 40, picks: 'each', variants: 'cycle' });
    expect(r.failures, show(r.failures)).toEqual([]);
    expect(r.fallbacks).toBeGreaterThan(0);
    expect(r.fallbacks, showFb(r)).toBeLessThanOrEqual(44); // 44 of 160 as of R2
  });
});

describe('9.2 with every palette picked, in both modes', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 9, palettes: true, variants: 'cycle' });
      expect(r.count).toBe(PALETTES[style].length * 9 * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
      expect(r.fallbacks, showFb(r)).toBe(0);
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
    }, 60000);
  }
});

describe('9.3 type seed over the real pairings (review R1 M2): the type seed moves text, never a graphic', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      expect(PAIRINGS[style].length).toBeGreaterThan(1);
      const r = runIndependence(stubMeasure, { styles: [style], n: 20, variants: 'cycle' });
      expect(r.failures, show(r.failures)).toEqual([]);
      // the test means something only if the type seed did change the pairing and moved text for some specs
      expect(r.typeMoved).toBeGreaterThan(10);
    });
  }
});

describe('9.2 with every pairing picked (stub measure; the smoke run does it with the real fonts)', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 3, pairings: true, variants: 'all' });
      expect(r.count).toBe(PAIRINGS[style].length * 3 * textVariants().length * 3 * 2);
      expect(r.pairings).toEqual(PAIRINGS[style].map((p) => p.id).sort());
      expect(r.failures, show(r.failures)).toEqual([]);
      expect(r.fallbacks, showFb(r)).toBe(0);
    });
  }
});

describe('layout never measures with a face that is not loaded', () => {
  const core = (p: Pairing) => facesOf(p).every(isCoreFace);
  const resolve = (s: Spec) => resolvePairing(s, core);
  test('with only the core faces loaded, every Scene is drawn and measured with core families', () => {
    for (const style of STYLE_IDS) {
      const r = runInvariants(stubMeasure, { styles: [style], n: 12, variants: 'cycle' }, resolve);
      expect(r.failures, show(r.failures)).toEqual([]);
      expect(r.fonts.filter((f) => !CORE_FAMILIES.includes(f))).toEqual([]);
      expect(r.faces.filter((k) => !CORE_FONTS.some((c) => faceKey(c) === k))).toEqual([]);
      expect(r.pairings.every((id) => core(PAIRINGS[style].find((p) => p.id === id)!))).toBe(true);
    }
  });
  test('an unavailable pairing draws with the default and the spec keeps its pick', () => {
    const s = defaultSpec();
    s.style = 'swiss';
    s.pick.pairing = 'sw-hanken';
    const use = resolve(s);
    expect(use.pairing).toBe(defaultPairing('swiss').id);
    const sc = solve(s, stubMeasure, use).scene;
    expect(sc.pairing).toBe('sw-inter-tight');
    expect(s.pick.pairing).toBe('sw-hanken');
    expect(resolvePairing(s, () => true).pairing).toBe('sw-hanken');
  });
  test('the Scene records every family layout measured, the Brutalist band faces included', () => {
    const s = defaultSpec();
    s.style = 'brutal';
    s.pick.pairing = 'br-bebas';
    const sc = solve(s, stubMeasure).scene;
    expect(sc.pairing).toBe('br-bebas');
    expect(sc.fonts).toEqual(expect.arrayContaining(['Bebas Neue', 'IBM Plex Mono', 'Anton', 'Archivo Black']));
    expect(sc.faces).toEqual(expect.arrayContaining(['Anton|400|n', 'Archivo Black|400|n']));
  });
  test('the font check is by face: a weight the registry lacks is reported though its family is loaded (review R3 S3)', () => {
    // Inter Tight is core at 400, 500, 700 and 800; ask for 300 as well
    const T = defaultPairing('swiss');
    const light: Pairing = { ...T, id: 'sw-test-300', text: { ...T.text, weight: 300 } };
    PAIRINGS.swiss.push(light);
    try {
      const s = defaultSpec();
      s.style = 'swiss';
      s.pick.pairing = light.id;
      const sc = solve(s, stubMeasure).scene;
      const loaded = (k: string) => CORE_FONTS.some((c) => faceKey(c) === k);
      expect(sc.fonts.every((f) => CORE_FAMILIES.includes(f))).toBe(true);   // family-level would pass
      expect(unloadedFaces(sc, loaded)).toEqual(['Inter Tight|300|n']);
      expect(unloadedFaces(solve({ ...s, pick: { ...s.pick, pairing: T.id } }, stubMeasure).scene, loaded)).toEqual([]);
    } finally {
      PAIRINGS.swiss.pop();
    }
  });
  test('the Brutalist band is measured with bundled faces only', () => {
    for (let i = 0; i < 20; i++) {
      for (const p of PAIRINGS.brutal) {
        const s = defaultSpec(seedSet(i));
        s.style = 'brutal';
        s.pick.pairing = p.id;
        const fams = solve(s, stubMeasure).scene.fonts.filter((f) => f !== p.display.family && f !== p.mono.family && f !== p.text.family);
        expect(fams.every((f) => CORE_FAMILIES.includes(f)), fams.join()).toBe(true);
      }
    }
  });
});
