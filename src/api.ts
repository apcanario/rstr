/** window.__rstr: the hook the tools use (spec 4). */
import { PALETTES } from './data/palettes';
import { GRAPHICS } from './engine/graphics';
import { FORMATS } from './engine/formats';
import { choosePairing, render, resolvePairing, scene } from './engine';
import { PAIRINGS } from './data/pairings';
import { available, coreFailures, ensure, isKeyLoaded, loadedFamilies, pairingById } from './fonts';
import type { Drawn } from './app/App';
import type { Scene } from './engine/scene';
import { check } from './engine/invariants';
import { solve, unloadedFaces } from './engine/layout';
import { browserMeasure } from './engine';
import { clumsyOf, pickForGraphic, picksOf, runIndependence, runInvariants, runTune, runVariety, specs, type Opts } from './engine/proof';
import { STYLES } from './engine/styles';
import type { Format } from './engine/formats';
import { bench, copierProof, finishProof, ghostShows, graphicLeak, knockLeak, pixelHash } from './engine/pixels';
import { labelsOf, markOverlaps } from './engine/marks';
import { thumb } from './engine';
import { withStyle } from './app/state';
import { migrate, type Spec, type StyleId } from './engine/spec';

/** Every tool call lays out the way the app does: with the wanted pairing only if its fonts are loaded (spec 6). */
const useOf = (spec: Spec) => resolvePairing(spec, available);
const resolve = (spec: Spec) => useOf(spec);

/** What the app gives the tools beyond the engine: set the design as a tap would, read its saved state, hash the stage. */
export interface AppHooks {
  load: (raw: unknown) => void;
  state: () => { spec: Spec; back: Spec[]; kept: Spec[]; locks: Record<string, boolean> };
  stage: () => string;
  fileName: (raw: unknown, f: '1:1' | '3:4' | '9:16', k: 'jpeg' | 'png') => string;
}

export function installApi(ready: Promise<void>, current: () => Spec, view: { idle: () => Promise<void>; drawn: () => Drawn | null; current: () => boolean; app: AppHooks }) {
  const api = {
    ready,
    spec: () => structuredClone(current()),
    /** Resolves when the stage has drawn the current spec (after any wait for fonts). */
    async idle(ms = 15000) {
      const t0 = performance.now();
      for (;;) {
        await view.idle();
        if (view.current() || performance.now() - t0 > ms) return view.current();
        await new Promise((r) => setTimeout(r, 20));
      }
    },
    drawn: () => view.drawn(),
    app: view.app,
    migrate: (raw: unknown) => migrate(raw),
    scene: (raw: unknown) => { const s = migrate(raw); return scene(s, browserMeasure(), useOf(s)); },
    solve: (raw: unknown) => { const s = migrate(raw); const r = solve(s, browserMeasure(), useOf(s)); return { layout: r.scene.layout, pairing: r.scene.pairing, tried: r.tried, failures: r.failures }; },
    check: (raw: unknown) => { const s = migrate(raw); return check(scene(s, browserMeasure(), useOf(s))); },
    render: (canvas: HTMLCanvasElement, raw: unknown) => { const s = migrate(raw); return render(canvas, s, null, useOf(s)); },
    /** Full-size export as a data URL. */
    exportImage(raw: unknown, type: 'image/jpeg' | 'image/png' = 'image/jpeg') {
      const spec = migrate(raw), c = document.createElement('canvas');
      render(c, spec, null, useOf(spec));
      const [w, h] = FORMATS[spec.format];
      return { url: c.toDataURL(type, 0.92), w, h };
    },
    /** Raw pixels of a render, for the determinism check. */
    pixels(raw: unknown): string {
      const c = document.createElement('canvas'), s = migrate(raw);
      render(c, s, null, useOf(s));
      return pixelHash(c);
    },
    /** Marker-colour pixels of knocked-out graphics found inside text masks, with and without the offscreen layer. */
    knock: (raw: unknown) => { const s = migrate(raw); return { layer: knockLeak(s, false, useOf(s)), noLayer: knockLeak(s, true, useOf(s)) }; },
    /** Graphic pixels inside text masks where the Scene says none, or of a colour it did not declare (9.2 at the pixel level). */
    graphicLeak: (raw: unknown) => { const s = migrate(raw); return graphicLeak(s, useOf(s)); },
    ghostShows: (raw: unknown) => { const s = migrate(raw); return ghostShows(s, useOf(s)); },
    /** Row R7: a finish against Clean, text ink and contrast (spec 7.1). */
    finishProof: (raw: unknown) => { const s = migrate(raw); return finishProof(s, useOf(s)); },
    /** Review bundle 3 M5: photocopy title words read in cells on the Clean render, copier pass included. */
    copierProof: (raw: unknown, wash = 0) => { const s = migrate(raw); return copierProof(s, useOf(s), wash); },
    /** The specs a proof run walks, for the pixel checks the tools run spec by spec. */
    specs: (o: Opts) => [...specs(o)],
    /** Row R7: marks on text, and micro labels that say more than the spec holds (spec 7.2). Both must be empty. */
    marks: (raw: unknown) => { const s = migrate(raw); const sc = scene(s, browserMeasure(), useOf(s)); return { overlaps: markOverlaps(sc), badLabels: labelsOf(sc, s).filter((l) => !l.ok), labels: labelsOf(sc, s).length, marks: sc.items.filter((i) => i.kind === 'graphic' && i.layer === 'mark').length }; },
    /** Row R7: one render timed by stage, plus its JPEG encode (ms). */
    bench: (raw: unknown) => { const s = migrate(raw); return bench(s, useOf(s)); },
    /** Row R7: the Style tab's four tile renders for a spec, timed (ms each), drawn as the app draws them. */
    tiles(raw: unknown, w = 160): number[] {
      const s = migrate(raw), out: number[] = [];
      for (const id of ['swiss', 'pomo', 'brutal', 'vapor'] as StyleId[]) {
        // as the app draws them: Clean, whatever the finish (review R7 S3)
        const x = { ...withStyle(s, id), finish: 'clean' as const }, c = document.createElement('canvas'), t0 = performance.now();
        thumb(c, x, w, useOf(x));
        out.push(performance.now() - t0);
      }
      return out;
    },
    /** Palette ids of a style, in list order. */
    palettes: (style: StyleId) => PALETTES[style].map((p) => p.id),
    /** Ids and names of a style's palettes and pairings, for the longest-name checks on the controls. */
    names: (style: StyleId) => ({ palettes: PALETTES[style].map((p) => ({ id: p.id, name: p.name })), pairings: PAIRINGS[style].map((p) => ({ id: p.id, name: p.name })) }),
    proof: {
      invariants: (o: Opts) => runInvariants(browserMeasure(), o, resolve),
      picks: (style: StyleId) => picksOf(style),
      independence: (o: Opts) => runIndependence(browserMeasure(), o, resolve),
      /** The three variety tests of spec 8.0 for one style in one format. */
      variety: (style: StyleId, format: Format, n?: number, pick?: Partial<Spec['pick']>) => runVariety(browserMeasure(), style, format, n, resolve, pick),
      /** The dialects a style has (Postmodern: ice cream, photocopy), for the per-dialect variety runs. */
      dialects: (style: StyleId) => STYLES[style].parts.layout.dialects ?? [],
      /** The tuning pass (row R5): n shuffles across the formats and the ones flagged as likely clumsy. */
      tune: (style: StyleId, n?: number) => runTune(browserMeasure(), style, n, resolve),
      /** The tuning rules on one spec: what clumsyOf flags in it (empty if nothing). */
      clumsy: (raw: unknown) => { const s = migrate(raw); return clumsyOf(solve(s, browserMeasure(), resolve(s)).scene, s); },
      /** Library graphics a style draws, with their parameter ranges: what the range-end checks walk. */
      graphics: (style: StyleId) => {
        const st = STYLES[style];
        return [...st.parts.ground.uses, ...st.parts.graphics.uses].map((name) => ({ name, motif: st.motifs.includes(name), pick: pickForGraphic(style, name), params: GRAPHICS[name].params }));
      },
    },
    fonts: {
      pairings: (style: StyleId) => PAIRINGS[style].map((p) => p.id),
      /** Wait for a pairing's fonts (at most ms): true if they all loaded. */
      ensure: (id: string, ms?: number) => ensure(pairingById(id)!, ms),
      available: (id: string) => available(pairingById(id)!),
      wanted: (raw: unknown) => choosePairing(migrate(raw)).id,
      loaded: () => loadedFamilies(),
      coreFailures: () => coreFailures(),
      /** Faces a Scene used or measured that are not loaded: must always be empty (spec 6). */
      unloaded: (sc: Scene): string[] => unloadedFaces(sc, isKeyLoaded),
    },
  };
  (window as unknown as { __rstr: typeof api }).__rstr = api;
  return api;
}
