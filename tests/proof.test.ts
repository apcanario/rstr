import { describe, expect, test } from 'vitest';
import { stubMeasure } from '../src/engine/measure';
import { runIndependence, runInvariants } from '../src/engine/proof';
import { STYLE_IDS } from '../src/engine/spec';

const show = (fs: { spec: unknown }[]) => fs.slice(0, 3).map((f) => JSON.stringify(f)).join('\n');

describe('9.2 on the stub measure, every style x format x mode', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runInvariants(stubMeasure, { styles: [style], n: 70 });
      expect(r.count).toBe(70 * 3 * 2);
      expect(r.failures, show(r.failures)).toEqual([]);
    });
  }
});

describe('9.3 stream independence on the stub measure', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runIndependence(stubMeasure, { styles: [style], n: 30, modes: ['light'] });
      expect(r.failures, show(r.failures)).toEqual([]);
    });
  }
});
