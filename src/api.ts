/** window.__rstr: the hook the tools use (spec 4). */
import { FORMATS } from './engine/formats';
import { render, scene } from './engine';
import { check } from './engine/invariants';
import { solve } from './engine/layout';
import { browserMeasure } from './engine';
import { runIndependence, runInvariants, type Opts } from './engine/proof';
import { migrate, type Spec } from './engine/spec';

export function installApi(ready: Promise<void>, current: () => Spec) {
  const api = {
    ready,
    spec: () => structuredClone(current()),
    migrate: (raw: unknown) => migrate(raw),
    scene: (raw: unknown) => scene(migrate(raw)),
    solve: (raw: unknown) => { const r = solve(migrate(raw), browserMeasure()); return { layout: r.scene.layout, tried: r.tried, failures: r.failures }; },
    check: (raw: unknown) => check(scene(migrate(raw))),
    render: (canvas: HTMLCanvasElement, raw: unknown) => render(canvas, migrate(raw)),
    /** Full-size export as a data URL. */
    exportImage(raw: unknown, type: 'image/jpeg' | 'image/png' = 'image/jpeg') {
      const spec = migrate(raw), c = document.createElement('canvas');
      render(c, spec);
      const [w, h] = FORMATS[spec.format];
      return { url: c.toDataURL(type, 0.92), w, h };
    },
    /** Raw pixels of a render, for the determinism check. */
    pixels(raw: unknown): string {
      const c = document.createElement('canvas');
      render(c, migrate(raw));
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261;
      for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16) + ':' + d.length;
    },
    proof: {
      invariants: (o: Opts) => runInvariants(browserMeasure(), o),
      independence: (o: Opts) => runIndependence(browserMeasure(), o),
    },
  };
  (window as unknown as { __rstr: typeof api }).__rstr = api;
  return api;
}
