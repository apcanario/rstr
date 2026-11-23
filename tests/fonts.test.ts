import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { CORE_FAMILIES, defaultPairing, facesOf, isCoreFace, PAIRINGS, SOURCES } from '../src/data/pairings';
import { cssUrl, parseCss, rulesFor, covers } from '../src/fontcss';
import { STYLE_IDS } from '../src/engine/spec';

describe('pairings data (spec 6, docs/design/pairings.md)', () => {
  const all = Object.values(PAIRINGS).flat();
  test('42 pairings, unique ids, every id in docs/design/pairings.md', () => {
    expect(all.length).toBe(42);
    expect(new Set(all.map((p) => p.id)).size).toBe(42);
    const md = readFileSync(join(__dirname, '..', 'docs', 'design', 'pairings.md'), 'utf8');
    for (const p of all) expect(md, p.id).toContain('| ' + p.id + ' |');
  });
  test('each style has its own prefix, and its default uses core fonts only', () => {
    const prefix = { swiss: 'sw-', pomo: 'pm-', brutal: 'br-', vapor: 'vp-' } as const;
    for (const s of STYLE_IDS) {
      for (const p of PAIRINGS[s]) expect(p.id.startsWith(prefix[s])).toBe(true);
      expect(facesOf(defaultPairing(s)).every(isCoreFace), s).toBe(true);
    }
    expect(CORE_FAMILIES.length).toBe(8);
  });
  test('every face names a family and a weight; alias families have a source', () => {
    for (const p of all) for (const f of facesOf(p)) {
      expect(f.family.length).toBeGreaterThan(1);
      expect(f.weight % 100).toBe(0);
    }
    expect(SOURCES['Archivo Expanded']).toEqual({ family: 'Archivo', wdth: 125 });
  });
  test('Brutalist has at least two pairings with bundled display faces (the band reference)', () => {
    expect(PAIRINGS.brutal.filter((p) => isCoreFace(p.display)).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Google Fonts css2 requests', () => {
  test('one family, only the faces asked for, tuples sorted', () => {
    expect(cssUrl('Inter Tight', [{ family: 'Inter Tight', weight: 800 }, { family: 'Inter Tight', weight: 400 }]))
      .toBe('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;800&display=block');
    expect(cssUrl('Alegreya', [{ family: 'Alegreya', weight: 400, italic: true }, { family: 'Alegreya', weight: 400 }]))
      .toBe('https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;1,400&display=block');
  });
  test('an alias family maps to its real family at a fixed width', () => {
    expect(cssUrl('Archivo Expanded', [{ family: 'Archivo Expanded', weight: 900 }]))
      .toBe('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,900&display=block');
  });
  // The shape of a css2 response, written by hand for this test (the workspace could not reach Google Fonts).
  const css = `/* cyrillic */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(https://fonts.gstatic.com/s/inter/v1/cyr.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(https://fonts.gstatic.com/s/inter/v1/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(https://fonts.gstatic.com/s/inter/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 800;
  font-display: block;
  src: url(https://fonts.gstatic.com/s/inter/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}`;
  test('the response becomes latin and latin-ext faces of the weights asked for', () => {
    const rules = parseCss(css);
    expect(rules.length).toBe(4);
    const got = rulesFor(rules, [{ family: 'Inter', weight: 400 }, { family: 'Inter', weight: 800 }]);
    expect(got.map((g) => [g.face.weight, g.rule.subset, g.rule.url.split('/').pop()])).toEqual([
      [400, 'latin-ext', 'ext.woff2'], [400, 'latin', 'latin.woff2'], [800, 'latin', 'latin.woff2'],
    ]);
    expect(got[1].rule.unicodeRange).toBe('U+0000-00FF, U+0131');
  });
  test('a face missing from the response gives no rule, so the loader fails it', () => {
    expect(rulesFor(parseCss(css), [{ family: 'Inter', weight: 400, italic: true }])).toEqual([]);
  });
  // a CJK family served as numbered slices, without a latin block (review R3 M3)
  const slice = (n: number, range: string) => `/* [${n}] */
@font-face { font-family: 'Dela Gothic One'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/dela/v1/${n}.woff2) format('woff2'); unicode-range: ${range}; }`;
  test('without latin or latin-ext, only the slices that cover A-Z load, never every slice', () => {
    const cjk = [slice(1, 'U+4E00-4FFF'), slice(2, 'U+0020-007E, U+00A0-00FF'), slice(3, 'U+30??'), slice(4, 'U+5000-5FFF')].join('\n');
    const got = rulesFor(parseCss(cjk), [{ family: 'Dela Gothic One', weight: 400 }]);
    expect(got.map((g) => g.rule.url.split('/').pop())).toEqual(['2.woff2']);
    const none = [slice(1, 'U+4E00-4FFF'), slice(3, 'U+0041-004F')].join('\n');
    expect(rulesFor(parseCss(none), [{ family: 'Dela Gothic One', weight: 400 }])).toEqual([]);
  });
  test('covers reads ranges, single points and wildcards', () => {
    expect(covers(undefined)).toBe(true);
    expect(covers('U+0000-00FF')).toBe(true);
    expect(covers('U+00??')).toBe(true);
    expect(covers('U+0041-004D, U+004E-005A')).toBe(true);
    expect(covers('U+0041-0059')).toBe(false);
    expect(covers('U+4E00-9FFF')).toBe(false);
  });
});
