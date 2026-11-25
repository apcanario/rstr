/**
 * Swiss as finished at R5 (review R5 S4), and Postmodern, Brutalist and Vaporwave until their own rows (review
 * R13 S5), stay as they are. For each style, a
 * hash of every Scene item (kind, quad, fills, name, params, runs: the whole item, numbers rounded to 1e-3) over
 * 40 seed sets x 3 formats x 2 modes on the stub measure. A row that changes one of these styles on purpose
 * updates its hash here and says so in the changelog. Bundle 3 touches shared code: a Swiss change shows here. Swiss hash updated for the bundle 2 viewer fixes (S2, M1-M4). Postmodern hash updated for R6 (both dialects built), then for the bundle 3 viewer fixes (S1, M3, M4). Brutalist hash updated for R8 (Brutalist finished). Vaporwave hash updated for R9 (Vaporwave finished), then for the R9 review fixes (S2 to S5, M1 to M4). Postmodern hash updated for the R10 review fixes (S2: a photocopy caption that does not fit beside the label on a narrow page goes under it, where the design fell back before). Brutalist hash updated for the bundle 4 viewer fixes (S2: a numeral only where it is drawn huge; S4: no cut-in in a band taller than the title). Vaporwave hash updated for the bundle 4 viewer fixes (M4: no mountains on the huge sun or the orb).
 */
import { describe, expect, test } from 'vitest';
import { solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { specs } from '../src/engine/proof';
import type { StyleId } from '../src/engine/spec';

const SNAPSHOT: Partial<Record<StyleId, string>> = {
  swiss: '3d2d70e8',
  pomo: '1370597a',
  brutal: 'f6e39d09',
  vapor: 'cabbe2a2',
};

const round = (_k: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
export function sceneHash(style: StyleId): string {
  let h = 2166136261;
  for (const s of specs({ styles: [style], n: 40, variants: 'cycle' })) {
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
