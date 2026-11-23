import { describe, expect, test } from 'vitest';
import { formOf, PALETTES, type Form } from '../src/data/palettes';
import { contrast, luminance } from '../src/engine/colour';
import { STYLE_IDS, type StyleId } from '../src/engine/spec';

/** The better of ink and ground against a fill: what a style can set on a plate of that colour. */
const onPlate = (P: Form, fill: string) => Math.max(contrast(P.ink, fill), contrast(P.ground, fill));

/**
 * What each style asks of a form so that its fallback always passes 9.2 rule 4 (spec 5): small text is 4.5:1.
 * Swiss sets everything in ink on ground; Postmodern sets type on plates of each accent; Brutalist on the
 * accent bar and the ink bar; Vaporwave in the window, on its title bar and on the floor.
 */
const NEEDS: Record<StyleId, (P: Form) => [string, number][]> = {
  swiss: (P) => [['ink on ground', contrast(P.ink, P.ground)]],
  pomo: (P) => [['ink on ground', contrast(P.ink, P.ground)], ['type on accent', onPlate(P, P.accent)], ['type on accent2', onPlate(P, P.accent2!)], ['type on accent3', onPlate(P, P.accent3!)]],
  brutal: (P) => [['ink on ground', contrast(P.ink, P.ground)], ['type on accent', onPlate(P, P.accent)]],
  vapor: (P) => [
    ['window ink', contrast(P.windowInk!, P.window!)],
    ['title bar', Math.max(contrast(P.chrome!, P.gradient![1]), contrast(P.windowInk!, P.gradient![1]))],
    ['type on floor', Math.max(contrast(P.ink, P.ground), contrast(P.windowInk!, P.ground))],
  ],
};

describe('palettes (spec 5)', () => {
  for (const style of STYLE_IDS) {
    test(style + ': at least 8, ids unique, every one with a light and a dark form written out', () => {
      const list = PALETTES[style];
      expect(list.length).toBeGreaterThanOrEqual(8);
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
      for (const p of list) {
        expect(p.light, p.id).toBeTruthy();
        expect(p.dark, p.id).toBeTruthy();
        expect(JSON.stringify(p.light), p.id).not.toBe(JSON.stringify(p.dark));
        // dark is darker: its ground is darker than the light form's
        expect(luminance(p.dark.ground), p.id).toBeLessThan(luminance(p.light.ground));
      }
    });
    test(style + ': every form meets what the style asks of it, in both modes', () => {
      const bad: string[] = [];
      for (const p of PALETTES[style]) for (const mode of ['light', 'dark'] as const) {
        const P = formOf(p, mode);
        for (const [what, r] of NEEDS[style](P)) if (!(r >= 4.5)) bad.push(`${p.id} ${mode}: ${what} ${r.toFixed(2)}`);
      }
      expect(bad).toEqual([]);
    });
  }
  test('Swiss has one accent: ground, ink and accent only (spec 8.1)', () => {
    for (const p of PALETTES.swiss) for (const mode of ['light', 'dark'] as const)
      expect(Object.keys(p[mode]).sort(), p.id + ' ' + mode).toEqual(['accent', 'ground', 'ink']);
  });
  test('Vaporwave forms carry a sky, window and chrome; Postmodern forms three accents', () => {
    for (const p of PALETTES.vapor) for (const mode of ['light', 'dark'] as const) {
      const P = p[mode];
      expect(P.gradient?.length, p.id).toBeGreaterThanOrEqual(2);
      expect(P.window && P.windowInk && P.chrome && P.accent2 && P.accent3, p.id).toBeTruthy();
    }
    for (const p of PALETTES.pomo) for (const mode of ['light', 'dark'] as const) expect(p[mode].accent2 && p[mode].accent3, p.id).toBeTruthy();
  });
  test('Vaporwave light mode is a pastel sky with dark ink (spec 8.4)', () => {
    for (const p of PALETTES.vapor) {
      const L = p.light;
      expect(Math.min(...L.gradient!.map(luminance)), p.id).toBeGreaterThan(0.6);
      expect(luminance(L.ink), p.id).toBeLessThan(0.05);
    }
  });
});
