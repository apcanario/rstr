/**
 * Swiss as finished at R5 (review R5 S4), and Postmodern, Brutalist and Vaporwave until their own rows (review
 * R13 S5), stay as they are. For each style, a
 * hash of every Scene item (kind, quad, fills, name, params, runs: the whole item, numbers rounded to 1e-3) over
 * 40 seed sets x 3 formats x 2 modes on the stub measure. A row that changes one of these styles on purpose
 * updates its hash here and says so in the changelog. Bundle 3 touches shared code: a Swiss change shows here. Swiss hash updated for the bundle 2 viewer fixes (S2, M1-M4).
 */
import { describe, expect, test } from 'vitest';
import { solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { specs } from '../src/engine/proof';
import type { StyleId } from '../src/engine/spec';

const SNAPSHOT: Partial<Record<StyleId, string>> = {
  swiss: '3d2d70e8',
  pomo: '8627a7e7',
  brutal: '8480f767',
  vapor: '839d6639',
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
    }, 60000);
  }
  test.skipIf(!process.env.RSTR_SNAPSHOT_ALL)('print every style\'s hash', () => {
    for (const s of ['swiss', 'pomo', 'brutal', 'vapor'] as StyleId[]) console.log('snapshot', s, sceneHash(s));
  }, 120000);
});
