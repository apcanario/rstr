/** window.__rstr: the hook the tools use (spec 4). */
import { FORMATS } from './engine/formats';
import { render, scene } from './engine';
import { check } from './engine/invariants';
import { solve } from './engine/layout';
import { browserMeasure } from './engine';
import { picksOf, runIndependence, runInvariants, type Opts } from './engine/proof';
import { knockLeak, pixelHash } from './engine/pixels';
import { migrate, type Spec, type StyleId } from './engine/spec';

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
      return pixelHash(c);
    },
    /** Marker-colour pixels of knocked-out graphics found inside text masks, with and without the offscreen layer. */
    knock: (raw: unknown) => ({ layer: knockLeak(migrate(raw)), noLayer: knockLeak(migrate(raw), true) }),
    proof: {
      invariants: (o: Opts) => runInvariants(browserMeasure(), o),
      picks: (style: StyleId) => picksOf(style),
      independence: (o: Opts) => runIndependence(browserMeasure(), o),
    },
  };
  (window as unknown as { __rstr: typeof api }).__rstr = api;
  return api;
}
