/**
 * Swiss as finished at R5 (review R5 S4), and Postmodern, Brutalist and Vaporwave until their own rows (review
 * R13 S5), stay as they are. For each style, a
 * hash of every Scene item (kind, quad, fills, name, params, runs: the whole item, numbers rounded to 1e-3) over
 * 40 seed sets x 3 formats (1:1, 3:4, 9:16: the A format of R16 is new and is held by 9.2, not by this hash) x 2 modes on the stub measure. A row that changes one of these styles on purpose
 * updates its hash here and says so in the changelog. Bundle 3 touches shared code: a Swiss change shows here. Swiss hash updated for the bundle 2 viewer fixes (S2, M1-M4). Postmodern hash updated for R6 (both dialects built), then for the bundle 3 viewer fixes (S1, M3, M4). Brutalist hash updated for R8 (Brutalist finished). Vaporwave hash updated for R9 (Vaporwave finished), then for the R9 review fixes (S2 to S5, M1 to M4). Postmodern hash updated for the R10 review fixes (S2: a photocopy caption that does not fit beside the label on a narrow page goes under it, where the design fell back before). Brutalist hash updated for the bundle 4 viewer fixes (S2: a numeral only where it is drawn huge; S4: no cut-in in a band taller than the title). Vaporwave hash updated for the bundle 4 viewer fixes (M4: no mountains on the huge sun or the orb). Postmodern hash updated for R15 (the photocopy caption's faintest copy fades to 5.4:1, not 4.6:1, so the copier pass cannot take it under 4.5:1), then for the R15 review fixes (S3: faintest copy at 7:1 and the middle at 9:1, as every text item read with the pass showed 5.4 taken to 3.52 on paper). Postmodern hash updated for R12 (Carried R12 from bundle 3: a photocopy boxed word is pushed clear of earlier words' paper halos; Carried R10 from R10: tape and faint contours record the two colours they are mixed from, `mixed`). Postmodern hash updated for the R12 review fixes (S1: the photocopy info label's plate and the caption's faded copies record their recipe, `mixed`; M5: the boxed word is marked `boxed`; with both fields stripped the hash is the old `5d12939c`).
 */
import { describe, expect, test } from 'vitest';
import { solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { specs } from '../src/engine/proof';
import type { StyleId } from '../src/engine/spec';

const SNAPSHOT: Partial<Record<StyleId, string>> = {
  swiss: '3d2d70e8',
  pomo: '4016c947',
  brutal: 'f6e39d09',
  vapor: 'cabbe2a2',
};

// `lid` (the layer an item draws, R17) is new data on the same items: a v1 design must draw as it did (spec 8.6)
const round = (k: string, v: unknown) => (k === 'lid' ? undefined : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
export function sceneHash(style: StyleId): string {
  let h = 2166136261;
  for (const s of specs({ styles: [style], formats: ['1:1', '3:4', '9:16'], n: 40, variants: 'cycle' })) {
    const sc = solve(s, stubMeasure).scene;
    const str = JSON.stringify([sc.layout, sc.frame, sc.transform, sc.palette, sc.pairing, sc.items], round);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  return (h >>> 0).toString(16);
}

describe('unchanged styles (snapshot on the stub measure)', () => {
  for (const style of Object.keys(SNAPSHOT) as StyleId[]) {
    test(style, () => {
      expect(sceneHash(style), `${style} Scenes changed: if on purpose, update the hash and say so in the changelog`).toBe(SNAPSHOT[style]);
    }, 240000);
  }
  test.skipIf(!process.env.RSTR_SNAPSHOT_ALL)('print every style\'s hash', () => {
    for (const s of ['swiss', 'pomo', 'brutal', 'vapor'] as StyleId[]) console.log('snapshot', s, sceneHash(s));
  }, 120000);
});
