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
import { clumsyOf, pickForGraphic, picksOf, runAdvanced, runBrutalWidth, runIndependence, runInvariants, runTune, runVariety, specs, type Opts } from './engine/proof';
import { STYLES } from './engine/styles';
import type { Format } from './engine/formats';
import { bench, copierProof, photoCopier, photoPixels, photoShows, treatBench, finishProof, ghostShows, graphicLeak, knockLeak, pixelHash } from './engine/pixels';
import { labelsOf, markOverlaps } from './engine/marks';
import { clearTreated } from './engine/paint';
import { thumb } from './engine';
import { withStyle } from './app/state';
import { migrate, type Spec, type StyleId } from './engine/spec';
import { advancedOf } from './engine/advanced';
import type { Control } from './engine/controls';
import { photoOf, registerPhoto, registeredIds, testPicture, gridSize } from './engine/photo';
import { decodePhoto, testBlob } from './engine/photoload';
import { storedIds } from './photos';
import { exportDims, type Size } from './engine/formats';
import { exportName, forgetFailures, makeExport, photoNeed, workingSizes, type FileKind, type Limits } from './engine/export';
import { exportBench, exportPaths, scaleProof, stripsSame } from './engine/pixels';
import { seedCode } from './engine/spec';

/** Every tool call lays out the way the app does: with the wanted pairing only if its fonts are loaded (spec 6). */
const useOf = (spec: Spec) => resolvePairing(spec, available);
const resolve = (spec: Spec) => useOf(spec);

/** What the app gives the tools beyond the engine: set the design as a tap would, read its saved state, hash the stage. */
export interface AppHooks {
  load: (raw: unknown) => void;
  state: () => { spec: Spec; back: Spec[]; kept: Spec[]; locks: Record<string, boolean> };
  stage: () => string;
  fileName: (raw: unknown, f: Format, size: Size, bleed: boolean, k: FileKind) => string;
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
    /** Raw pixels of a render, for the determinism check. `fresh`: forget the kept treated photos first, so the photo is treated again (review R15 S2). */
    pixels(raw: unknown, fresh = false): string {
      if (fresh) clearTreated();
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
    /** Row R10: the Advanced controls of a design, by tab, as the app draws them (spec 10.3), its colours and its warning. */
    advanced: (raw: unknown) => {
      const s = migrate(raw), sc = scene(s, browserMeasure(), useOf(s)), a = advancedOf(s, sc, (t) => scene(t, browserMeasure(), { pairing: sc.pairing }));
      const plain = (c: Control) => ({ id: c.id, kind: c.kind, label: c.label, facet: c.facet, where: c.where, options: c.kind === 'choice' ? c.options : undefined, min: c.kind === 'range' ? c.min : undefined, max: c.kind === 'range' ? c.max : undefined });
      return { tabs: Object.fromEntries(Object.entries(a.tabs).map(([t, l]) => [t, l.map(plain)])), colours: a.colours, warn: sc.colourWarn ?? [] };
    },
    /** Row R14 (spec 8.9, 9.4): test photos and the photo's proofs. */
    photo: {
      /** Register a test photo with its picture (testPicture, drawn at a grid size, decoded as the app decodes a kept photo). */
      async test(id: string, w: number, h: number, seed = 1) {
        const [gw, gh] = gridSize(w, h);
        const blob = await testBlob(gw, gh, testPicture(gw, gh, seed));
        const p = await decodePhoto(id, blob);
        // the picture is drawn at its grid size; layout reads it as the size asked for
        registerPhoto({ ...p, w, h, held: true });
        return { id, w, h };
      },
      /** Whether a photo is ready to draw, and its pixel size. */
      info: (id: string) => { const p = photoOf(id); return p ? { w: p.w, h: p.h, img: !!p.img } : null; },
      /** Ids of the photos decoded in memory now (review R14 S4: only the current design's and the shown Kept page's). */
      registered: () => registeredIds(),
      /** Ids of the photos kept on this phone (IndexedDB). */
      stored: () => storedIds(),
      /** How much of the photo's box shows, read on pixels (review R14 S1). */
      shows: (raw: unknown) => { const s = migrate(raw); return photoShows(s, useOf(s)); },
      /** Text over the photo read on pixels (spec 9.4), at an export size (R16: 3x over a full-size photo). */
      pixels: (raw: unknown, size: Size = '1x') => { const s = migrate(raw); return photoPixels(s, useOf(s), size); },
      /** Register a test photo decoded from its full-size picture (R16, Carried R16 from R14: not the grid-sized decode). */
      async full(id: string, w: number, h: number, seed = 1) {
        const blob = await testBlob(w, h, testPicture(w, h, seed));
        const p = await decodePhoto(id, blob);
        registerPhoto({ ...p, held: true });
        return { id, w: p.w, h: p.h };
      },
      /** Text over the photo read in cells with the photocopy copier pass on (R15, Carried R15 from R14). */
      copier: (raw: unknown) => { const s = migrate(raw); return photoCopier(s, useOf(s)); },
      /** The treatment's time on the photo's box, and the whole render (R15). */
      treatTime: (raw: unknown) => { const s = migrate(raw); return treatBench(s, useOf(s)); },
    },
    /** Row R16 (spec 10.1): export sizes, files, strips, the bleed and the honest failure. */
    export: {
      dims: (f: Format, size: Size, bleed = false) => exportDims(f, size, bleed),
      name: (raw: unknown, size: Size, bleed: boolean, k: FileKind) => { const s = migrate(raw); return exportName(seedCode(s.seeds), s.format, exportDims(s.format, size, bleed).w, k); },
      /** One file made as the app makes it: its type, pixels as the browser decodes it, and its first bytes (base64). */
      async make(raw: unknown, size: Size, bleed: boolean, k: FileKind, lim: Limits = {}, force?: 'strips' | 'strips-png') {
        const s = migrate(raw);
        try {
          const m = await makeExport(s, useOf(s), size, bleed, k, lim, force);
          const im = await createImageBitmap(m.blob), dec = [im.width, im.height];
          im.close();
          const head = new Uint8Array(await m.blob.slice(0, 4096).arrayBuffer());
          let bin = '';
          for (const b of head) bin += String.fromCharCode(b);
          return { ok: true, w: m.w, h: m.h, type: m.blob.type, bytes: m.blob.size, how: m.how, ms: m.ms, strips: m.strips, decoded: dec, head: btoa(bin) };
        } catch (e) { return { ok: false, error: String((e as Error).message ?? e), largest: (e as { largest?: Size | null }).largest ?? null }; }
      },
      /** The whole file as a data URL (the sheets). */
      async url(raw: unknown, size: Size, bleed: boolean, k: FileKind) {
        const s = migrate(raw), m = await makeExport(s, useOf(s), size, bleed, k);
        return await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(m.blob); });
      },
      working: (raw: unknown, k: FileKind, sizes: Size[], bleed: boolean, lim: Limits = {}) => workingSizes(migrate(raw).format, k, sizes, bleed, lim),
      stripsSame: (raw: unknown, size: Size, rows = 512, only?: number[]) => { const s = migrate(raw); return stripsSame(s, useOf(s), size, rows, only); },
      paths: (raw: unknown, size: Size, bleed = false) => { const s = migrate(raw); return exportPaths(s, useOf(s), size, bleed); },
      scale: (raw: unknown, size: Size, wrong = false) => { const s = migrate(raw); return scaleProof(s, useOf(s), size, wrong); },
      bench: (raw: unknown, size: Size, bleed: boolean, k: FileKind, force?: 'strips' | 'strips-png') => { const s = migrate(raw); return exportBench(s, useOf(s), size, bleed, k, force); },
      photoNeed: (raw: unknown, size: Size) => { const s = migrate(raw); return photoNeed(s, useOf(s), size); },
      /** The pixel hash of a file as made and decoded (review R16 M3: the 1x PNG against the stage's own hash). */
      async hash(raw: unknown, size: Size, k: FileKind = 'png') {
        const s = migrate(raw), m = await makeExport(s, useOf(s), size, false, k);
        const im = await createImageBitmap(m.blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        (c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D).drawImage(im, 0, 0);
        im.close();
        return pixelHash(c);
      },
      /** Forget the sizes that failed this session (review R16 S2). */
      forget: () => forgetFailures(),
    },
    /** Palette ids of a style, in list order. */
    palettes: (style: StyleId) => PALETTES[style].map((p) => p.id),
    /** Ids and names of a style's palettes and pairings, for the longest-name checks on the controls. */
    names: (style: StyleId) => ({ palettes: PALETTES[style].map((p) => ({ id: p.id, name: p.name })), pairings: PAIRINGS[style].map((p) => ({ id: p.id, name: p.name })) }),
    proof: {
      invariants: (o: Opts) => runInvariants(browserMeasure(), o, resolve),
      /** Row R10 (review R10 S3): every Advanced value and colour edit of each design through 9.2, real fonts. */
      advanced: (o: Opts) => runAdvanced(browserMeasure(), o, resolve),
      /** Review bundle 4 M5: Brutalist title lines at the full width with the real faces. */
      brutalWidth: (o: Opts) => runBrutalWidth(browserMeasure(), o, resolve),
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
