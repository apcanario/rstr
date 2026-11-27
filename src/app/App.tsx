/**
 * The frame of spec 10.1 and Simple mode of 10.2: header, stage, format, locks, panel, action row, tab bar,
 * the Kept and Export sheets. State logic is pure and lives in ./state; drawing lives in the engine.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { installApi } from '../api';
import { choosePairing, render, scene as sceneOf, thumb, type Use } from '../engine';
import { varietyKey } from '../engine/proof';
import { choosePalette, resolvePairing } from '../engine/layout';
import { pixelHash } from '../engine/pixels';
import { defaultPairing } from '../data/pairings';
import { PALETTES } from '../data/palettes';
import { available, coreFailures, ensure, onFontsChange } from '../fonts';
import { exportDims, FORMAT_LIST, FORMATS, SIZE_LABEL, type Format, type Size } from '../engine/formats';
import { exportName, ExportError, KIND_LABEL, makeExport, photoNeed, photoShort, probeQueued, workingSizes, type FileKind, type Limits } from '../engine/export';
import { STYLES } from '../engine/styles';
import type { Scene } from '../engine/scene';
import { defaultSpec, FACETS, migrate, newSeed, newSeeds, seedCode, STYLE_IDS, type Facet, type Finish, type Level, type Marks, type Spec, type StyleId, type TextLayer, LEVELS, MAX_LAYERS, leadsOf, LEVEL_SLOT } from '../engine/spec';
import { fitAll } from './fit';
import { Icon } from './icons';
import { addKept, addLayer, holdPhoto, infoText, layerText, moveLayer, removeLayer, setLayerText, setLevel, toggleLayer, newCrop, openLink, parseInfo, pushBack, reroll, restore, serialize, shuffleFresh, STORE_KEY, withPhoto, withStyle, type Locks, type Saved } from './state';
import { addPhoto, ensurePhoto, prune } from '../photos';
import { photoOf, releasePhotos } from '../engine/photo';
import { advancedOf, type Advanced } from '../engine/advanced';
import { apply, human, read, setColour, treatmentControl, type Control, type DesignColour, type Value } from '../engine/controls';
import { TREATMENT_LABEL, TREATMENTS, treatOffered, type Treatment } from '../engine/treat';

/** What the stage drew: the pairing asked for, the one used, and the note (spec 6). */
export interface Drawn { wanted: string; pairing: string; note: string; }

type Tab = 'style' | 'text' | 'look' | 'layout' | 'graphic' | 'type' | 'colour' | 'photo';
/** Simple's four tabs and Advanced's seven (spec 10.2, 10.3). */
const SIMPLE_TABS: Tab[] = ['style', 'text', 'look', 'photo'];
const ADV_TABS: Tab[] = ['style', 'layout', 'graphic', 'type', 'colour', 'text', 'photo'];
type Sheet = null | 'kept' | 'export';
type Kind = FileKind;

const FACET_LABEL: Record<Facet, string> = { layout: 'Layout', colour: 'Colour', graphic: 'Graphic', type: 'Type' };
const REROLL_LABEL: Record<Facet, string> = { layout: 'New layout', colour: 'New colours', graphic: 'New graphic', type: 'New type' };
const FINISHES: [Finish, string][] = [['clean', 'Clean'], ['grain', 'Grain'], ['grunge', 'Grunge'], ['vhs', 'VHS'], ['glitch', 'Glitch']];
const MARKS: [Marks, string][] = [['off', 'Off'], ['light', 'Light'], ['full', 'Full']];
/** Postmodern's Dialect control (spec 8.2, 10.2): Either lets the layout stream pick. */
const DIALECT: [string, string][] = [['either', 'Either'], ['icecream', 'Ice cream'], ['photocopy', 'Photocopy']];
/** The six levels of spec 8.6: the row's level button (short) and the field's name. */
const LEVEL_SHORT: Record<Level, string> = { headline: 'Head', subhead: 'Sub', body: 'Body', label: 'Label', caption: 'Cap', data: 'Data' };
const LEVEL_NAME: Record<Level, string> = { headline: 'Headline', subhead: 'Subhead', body: 'Body', label: 'Label', caption: 'Caption', data: 'Data (Label: value · …)' };
const KEPT_PAGE = 6;
/** Screens this tall hold four 48 px rows in the panel; the same query sets the panel's height in app.css. */
const TALL = '(min-height: 760px)';

/** A choice with this many options or fewer is a row of segments; more is a stepper (spec 10.1: 48 px each). */
const SEG_MAX = 4;
/** At most this many switches share a row: three, so none is shortened at 360 wide and nine fill three rows (review R10 M8). */
const PER_ROW = 3;
/** At most this many swatches share a row: five, so a design's colours stay on one page (5 x 48 + 4 x 6 px fits at 360 wide; review R10 M7). */
const SWATCH_ROW = 5;
const chunk = <T,>(l: T[], n: number): T[][] => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));
/** A range value as the row shows it: a whole number, or three significant figures (review R10 M2: 0.025 read 0.03). */
const num = (v: number, step: number) => (step >= 1 ? String(Math.round(v)) : String(Number(v.toPrecision(3))));
/** A log range's slider runs over these many steps in log space (review R10 M2). */
const LOG_STEPS = 1000;
const same = (a: Spec, b: Spec) => JSON.stringify(a) === JSON.stringify(b);
/** Names of spec 10.1: rstr-<seed>-<format>-<width>.<ext>, the width the file's own (bleed included). */
export const fileName = (s: Spec, f: Format, size: Size, bleed: boolean, k: Kind) => exportName(seedCode(s.seeds), f, exportDims(f, size, bleed && size === 'print').w, k);
const KINDS: [Kind, string][] = (['jpeg', 'png', 'webp'] as Kind[]).map((k) => [k, KIND_LABEL[k]]);
/**
 * The tools act as a phone with a canvas limit (spec 10.1, the honest failure): ?maxpx=<pixels>; or one whose
 * encoder fails over a size it can draw (review R16 S2): ?failenc=<pixels>.
 */
const LIMITS: Limits = (() => {
  try {
    const q = new URLSearchParams(location.search), v = Number(q.get('maxpx')), e = Number(q.get('failenc'));
    return { ...(v > 0 ? { maxArea: v } : {}), ...(e > 0 ? { failEncodeAbove: e } : {}) };
  } catch { return {}; }
})();
const px = (w: number, h: number) => `${w}×${h}`;
/** The export sheet's lines shrink no smaller than this, then shorten (review R16 S4). */
const INFO_MIN = 11;

/** A label that shrinks to fit (to `min` px at the least, if given), then shortens (spec 10.1). Its text is set by fitAll, never by Preact. */
const L = ({ t, c, min }: { t: string; c?: string; min?: number }) => <span class={c ? `fit ${c}` : 'fit'} data-fit={t} data-fit-min={min} />;

/**
 * Spec 6: layout waits for the pairing's fonts; if they have not arrived in 4 s, the style's default pairing
 * draws, a note says so, and the spec keeps the pairing asked for.
 */
async function fontsFor(ready: Promise<void>, spec: Spec): Promise<{ use: Use; drawn: Drawn }> {
  await ready;
  const want = choosePairing(spec), def = defaultPairing(spec.style);
  const ok = available(want) || (await ensure(want));
  const notes: string[] = [];
  if (!ok) notes.push(`${want.name} offline · ${def.name}`);
  const failed = coreFailures();
  if (failed.length) notes.push(`Bundled font failed: ${failed.join(', ')}`);
  return { use: { pairing: ok ? want.id : def.id }, drawn: { wanted: want.id, pairing: ok ? want.id : def.id, note: notes.join(' · ') } };
}

/**
 * Spec 6: offline, prefer a type seed whose pairing's fonts are already here. Keeps the seed when its pairing
 * is available, the app is online, or Type is locked; else draws new type seeds until one resolves to an
 * available pairing (every style's default is core, so one always exists).
 */
function preferAvailable(s: Spec, typeLocked = false): Spec {
  if (typeLocked || navigator.onLine || s.pick.pairing || available(choosePairing(s))) return s;
  const next = { ...s, seeds: { ...s.seeds } };
  for (let i = 0; i < 1000 && !available(choosePairing(next)); i++) next.seeds.type = newSeed();
  return next;
}

function load(): Saved {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch { raw = null; }
  const q = new URLSearchParams(location.search).get('s');
  // the design now lives in the saved state; a reload must not reopen the link's design over it
  if (q !== null) history.replaceState(null, '', location.pathname + location.hash);
  return openLink(restore(raw, () => defaultSpec(newSeeds())), q);
}

/** Text on the field while it is typed; follows the spec when the spec changes from elsewhere (Back, Kept). */
function Field({ layer, onText }: { layer: TextLayer; onText: (id: string, v: string) => void }) {
  const data = layer.level === 'data';
  const value = layerText(layer);
  const [draft, setDraft] = useState(value);
  const shown = data ? (infoText(parseInfo(draft)) === value ? draft : value) : value;
  const onInput = (e: Event) => { const v = (e.target as HTMLInputElement).value; setDraft(v); onText(layer.id, v); };
  const props = { class: 'field', value: shown, 'data-field': layer.id, 'data-level': layer.level, 'aria-label': LEVEL_NAME[layer.level], placeholder: LEVEL_NAME[layer.level], onInput, spellcheck: false };
  return layer.level === 'headline' ? <textarea rows={1} {...props} /> : <input type="text" {...props} />;
}

/** A panel with fixed height and page chips when a tab does not fit one page (spec 10.1). */
/** Whether a media query matches, kept current. */
function useMedia(q: string): boolean {
  const [on, setOn] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q), f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}

function Panel({ pages, page, setPage }: { pages: ComponentChildren[]; page: number; setPage: (n: number) => void }) {
  const p = Math.max(0, Math.min(page, pages.length - 1));
  return (
    <div class="panel" data-testid="panel">
      <div class="page" data-page={p}>{pages[p]}</div>
      {pages.length === 2 && (
        <div class="chips" role="group" aria-label="Pages">
          {pages.map((_, i) => <button class={i === p ? 'chip on' : 'chip'} aria-pressed={i === p} aria-label={`Page ${i + 1}`} data-chip={i} onClick={() => setPage(i)}><L t={String(i + 1)} /></button>)}
        </div>
      )}
      {/* three pages or more (Postmodern's Look tab on a short screen): one 48 px stepper, so the rows keep their
          width (review R6 E2); a tap goes to the next page, round to the first */}
      {pages.length > 2 && (
        <div class="chips" role="group" aria-label="Pages">
          <button class="chip step on" aria-label={`Page ${p + 1} of ${pages.length}, next page`} data-step={p} data-pages={pages.length} onClick={() => setPage((p + 1) % pages.length)}><L t={`${p + 1}/${pages.length}`} /></button>
        </div>
      )}
    </div>
  );
}

export function App({ ready }: { ready: Promise<void> }) {
  const init = useRef<Saved | null>(null);
  init.current ??= load();
  const [doc, setDoc] = useState<{ spec: Spec; back: Spec[] }>({ spec: init.current.spec, back: init.current.back });
  const [kept, setKept] = useState<Spec[]>(init.current.kept);
  const [locks, setLocks] = useState<Locks>(init.current.locks);
  const [advanced, setAdvanced] = useState(init.current.advanced);
  const [tab, setTab] = useState<Tab>('style');
  // a tab the mode does not have (Look in Advanced, Layout in Simple) shows the Style tab
  const [pages, setPages] = useState<Record<Tab, number>>({ style: 0, text: 0, look: 0, layout: 0, graphic: 0, type: 0, colour: 0, photo: 0 });
  /** Graphic tab: whose parameters are shown, of the graphics the design draws. */
  const [tune, setTune] = useState(0);
  /** Text tab: the layer whose row shows its edit controls (Move up and down, Remove), or none. */
  const [editing, setEditing] = useState<string | null>(null);
  /** Text tab: the level the Add button adds. */
  const [addLevel, setAddLevel] = useState<Level>('body');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sizes, setSizes] = useState<Format[]>([init.current.spec.format]);
  const [kind, setKind] = useState<Kind>('jpeg');
  const [size, setSize] = useState<Size>('1x');
  const [bleed, setBleed] = useState(false);
  const [expNote, setExpNote] = useState('');
  const [keptPage, setKeptPage] = useState(0);
  const [flash, setFlash] = useState<'' | 'copied' | 'copyfail' | 'kept'>('');
  const [saveNote, setSaveNote] = useState('');
  const tall = useMedia(TALL);
  const [busy, setBusy] = useState(false);
  /** Strips drawn of all, while a big export is made (review R16 M9). */
  const [making, setMaking] = useState<[number, number] | null>(null);
  /** Bumped when a size probed after the sheet painted (review R16 M6), so the sheet greys what cannot be made. */
  const [probed, setProbed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [scene, setScene] = useState<Scene | null>(null);
  /** Photo tab: '' idle, 'reading' while a photo is imported, 'failed' when the file could not be read. */
  const [photoState, setPhotoState] = useState<'' | 'reading' | 'failed'>('');
  /** The design names a photo that is not on this phone (deleted, or a design from elsewhere). */
  const [photoGone, setPhotoGone] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const spec = doc.spec;

  const cv = useRef<HTMLCanvasElement>(null);
  const tiles = useRef<Partial<Record<StyleId, HTMLCanvasElement | null>>>({});
  const keptCv = useRef<(HTMLCanvasElement | null)[]>([]);
  const docRef = useRef(doc);
  docRef.current = doc;
  const keptRef = useRef(kept);
  keptRef.current = kept;
  const locksRef = useRef(locks);
  locksRef.current = locks;
  const drawn = useRef<Drawn | null>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const drawnSpec = useRef<Spec | null>(null);
  const token = useRef(0);
  const lastKey = useRef<string | null>(null);
  const hold = useRef<{ t: number; fired: boolean }>({ t: 0, fired: false });
  // review R14 S4: decoded photos stay in memory only for the current design and the Kept page shown; the rest are
  // released after each draw and read from the phone again when a design needs them
  const keptShown = useRef<(string | undefined)[]>([]);
  keptShown.current = sheet === 'kept' ? kept.slice(keptPage * KEPT_PAGE, (keptPage + 1) * KEPT_PAGE).map((k) => k.photo?.id) : [];

  const draw = (s: Spec) => {
    const my = ++token.current;
    // the design's photo is read from the phone before the design is drawn (spec 8.9); one not on this phone is drawn without
    const job = Promise.all([fontsFor(ready, s), ensurePhoto(s.photo?.id)]).then(([{ use, drawn: d }, has]) => {
      if (my !== token.current || !cv.current) return;
      setPhotoGone(!!s.photo && !has);
      const sc = render(cv.current, s, null, use);
      releasePhotos([s.photo?.id, ...keptShown.current]);
      drawn.current = d;
      drawnSpec.current = s;
      setNote(d.note);
      setScene(sc);
    });
    pending.current = job;
    return job;
  };

  /** A change to the design: the design before it goes onto Back. Typing in one field is one step. */
  const commit = (f: (s: Spec) => Spec, key: string | null = null) => {
    setDoc((d) => {
      const n = f(d.spec);
      if (same(n, d.spec)) return d;
      const merge = key !== null && lastKey.current === key;
      lastKey.current = key;
      return { spec: n, back: merge ? d.back : pushBack(d.back, d.spec) };
    });
  };
  const goBack = () => {
    lastKey.current = null;
    setDoc((d) => (d.back.length ? { spec: d.back[d.back.length - 1], back: d.back.slice(0, -1) } : d));
  };
  // the session's recent shuffles (spec 8.0: no repeat of layout, transform, graphics and palette in 60; review R9 S1)
  const recentShuffles = useRef<string[]>([]);
  const shuffleKey = (s: Spec) => `${s.style}|${s.format}|${varietyKey(sceneOf(s))}`;
  const doShuffle = () => commit((s) => {
    // Layout locked: the photo keeps the role it is drawn in (spec 8.9, Carried R12 from R17)
    const held = locksRef.current.layout && s.photo ? holdPhoto(s, sceneOf(s, undefined, scene ? { pairing: scene.pairing } : {})) : s;
    const r = shuffleFresh(held, locksRef.current, recentShuffles.current, shuffleKey);
    recentShuffles.current = r.recent;
    return preferAvailable(r.spec, locksRef.current.type);
  });
  const pickStyle = (id: StyleId) => commit((s) => preferAvailable(withStyle(s, id), locksRef.current.type));
  const set = (p: Partial<Spec>) => commit((s) => ({ ...s, ...p }));
  const onText = (id: string, v: string) => commit((s) => setLayerText(s, id, v), 'text:' + id);
  const keep = () => {
    const s = docRef.current.spec;
    setKept((k) => addKept(k, s));
    setFlash('kept');
    setTimeout(() => setFlash(''), 1200);
  };
  const openKept = (i: number) => {
    const s = keptRef.current[i];
    if (!s) return;
    commit(() => s);
    setSheet(null);
  };
  const deleteKept = (i: number) => setKept((k) => k.filter((_, j) => j !== i));
  const copySeed = () => {
    const show = (f: 'copied' | 'copyfail') => { setFlash(f); setTimeout(() => setFlash(''), 1200); };
    const w = navigator.clipboard?.writeText(seedCode(spec.seeds));
    if (!w) show('copyfail');
    else w.then(() => show('copied'), () => show('copyfail'));
  };

  /**
   * Export (spec 10.1): each chosen format at the chosen size, drawn at that size from the spec after its fonts and
   * photo (spec 4, 6), as files named rstr-<seed>-<format>-<width>. A size this phone cannot make is never made
   * smaller in silence: the sheet says so and offers the largest that works.
   */
  const files = async (): Promise<File[]> => {
    const s = docRef.current.spec, out: File[] = [];
    setExpNote('');
    for (const f of FORMAT_LIST.filter((x) => sizes.includes(x))) {
      const one = { ...s, format: f }, z: Size = size === 'print' && f !== 'A' ? '3x' : size, b = bleed && z === 'print';
      const { use } = await fontsFor(ready, one);
      await ensurePhoto(one.photo?.id);
      try {
        const m = await makeExport(one, use, z, b, kind, LIMITS, undefined, (i, n) => setMaking([i, n]));
        setMaking(null);
        out.push(new File([m.blob], fileName(s, f, z, b, kind), { type: m.blob.type }));
      } catch (e) {
        // the largest size that works, the one that failed left out (review R16 S2)
        const largest = e instanceof ExportError ? e.largest : null;
        setMaking(null);
        // two lines, so neither is shortened at 360 wide; the size moves to the largest, so no sRGB line beside them
        setExpNote(`${(e as Error).message || 'Export failed'}${largest ? `\nLargest that works: ${SIZE_LABEL[largest]}` : ''}`);
        if (largest) setSize(largest);
        throw e;
      }
    }
    return out;
  };
  const save = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      for (const file of await files()) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch { /* said on the sheet */ } finally { setBusy(false); }
  };
  const canShare = (() => {
    try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] }); } catch { return false; }
  })();
  const share = async () => {
    setBusy(true);
    try { await navigator.share({ files: await files() }); } catch { /* cancelled, or said on the sheet */ } finally { setBusy(false); }
  };

  useEffect(() => {
    installApi(ready, () => docRef.current.spec, {
      idle: () => pending.current,
      drawn: () => drawn.current,
      current: () => drawnSpec.current === docRef.current.spec,
      app: {
        load: (raw: unknown) => commit(() => migrate(raw)),
        state: () => structuredClone({ spec: docRef.current.spec, back: docRef.current.back, kept: keptRef.current, locks: locksRef.current }),
        stage: () => (cv.current && cv.current.width > 1 ? pixelHash(cv.current) : ''),
        fileName: (raw: unknown, f: Format, z: Size, b: boolean, k: Kind) => fileName(migrate(raw), f, z, b, k),
      },
    });
    ready.then(() => setLoaded(true));
    // fonts that arrive after the 4 s wait: draw again with the pairing that was asked for
    return onFontsChange(() => {
      const d = drawn.current;
      if (d && d.pairing !== d.wanted && available(choosePairing(docRef.current.spec))) draw(docRef.current.spec);
    });
  }, []);
  useEffect(() => { if (loaded) draw(spec); }, [spec, loaded]);

  // autosave: the design, Back steps, Kept, locks and the Simple/Advanced switch (spec 10.1)
  useEffect(() => {
    const all = { spec: doc.spec, back: doc.back, kept, locks, advanced };
    try {
      localStorage.setItem(STORE_KEY, serialize(all));
      setSaveNote('');
    } catch {
      // full or blocked: try once without the Back steps, and say what was not saved
      try {
        localStorage.setItem(STORE_KEY, serialize({ ...all, back: [] }));
        setSaveNote('Back steps not saved on this phone: storage full');
      } catch { setSaveNote('Not saved on this phone: storage full'); }
    }
  }, [doc, kept, locks, advanced]);

  // photos no design refers to any more (current, Back, Kept) leave the phone, a little after the last change
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      const used = new Set([doc.spec, ...doc.back, ...kept].map((s) => s.photo?.id).filter((x): x is string => !!x));
      prune(used).catch(() => undefined);
    }, 3000);
    return () => clearTimeout(t);
  }, [doc, kept, loaded]);

  // labels fit after every render and on resize
  useLayoutEffect(() => { fitAll(); });
  useEffect(() => {
    const f = () => fitAll();
    addEventListener('resize', f);
    ready.then(f);
    return () => removeEventListener('resize', f);
  }, []);

  // style tiles: small live renders of the current design in each style, one per frame after the stage
  useEffect(() => {
    if (!loaded || tab !== 'style' || sheet) return;
    let stop = false;
    const ids = [...STYLE_IDS];
    const next = () => {
      const id = ids.shift();
      if (stop || !id) return;
      const c = tiles.current[id];
      if (c?.parentElement) {
        // a tile shows the style, not the finish: drawn Clean, so a tile never blocks the phone for a finish's
        // effect and guard (review R7 S3: Grunge tiles 0.6 to 1.1 s each under a 4x CPU throttle)
        const s = { ...(id === spec.style ? spec : withStyle(spec, id)), finish: 'clean' as const };
        const box = c.parentElement.getBoundingClientRect(), [W, H] = FORMATS[s.format];
        const w = Math.min(box.width, (box.height * W) / H) * devicePixelRatio;
        if (w > 1) thumb(c, s, w, resolvePairing(s, available));
      }
      setTimeout(next, 0);
    };
    // after 150 ms (Carried R7): tiles wait until a run of Shuffle taps pauses; the stop flag drops tiles of a
    // design already left
    const t = setTimeout(next, 150);
    return () => { stop = true; clearTimeout(t); };
  }, [spec, loaded, tab, sheet]);

  // Kept thumbnails of the page shown
  useEffect(() => {
    if (sheet !== 'kept' || !loaded) return;
    let stop = false;
    keptCv.current.forEach((c, i) => {
      const s = kept[keptPage * KEPT_PAGE + i];
      if (!c || !s) return;
      // a kept design's photo is read from the phone first (spec 8.9)
      ensurePhoto(s.photo?.id).then(() => {
        if (stop || !c.parentElement) return;
        const box = c.parentElement.getBoundingClientRect(), [W, H] = FORMATS[s.format];
        thumb(c, s, Math.min(box.width - 8, ((box.height - 8) * W) / H) * devicePixelRatio, resolvePairing(s, available));
        releasePhotos([docRef.current.spec.photo?.id, ...keptShown.current]);
      });
    });
    return () => { stop = true; };
  }, [sheet, kept, keptPage, loaded]);

  const keptPages = Math.max(1, Math.ceil(kept.length / KEPT_PAGE));
  useEffect(() => { if (keptPage >= keptPages) setKeptPage(keptPages - 1); }, [keptPages]);

  // what each lock holds now, from the drawn Scene
  const value = (f: Facet): string => {
    if (!scene) return '';
    // the layout the Scene drew, as the Graphic lock names its motif
    if (f === 'layout') return human(scene.frame) || 'Fallback';
    if (f === 'colour') return PALETTES[spec.style].find((p) => p.id === scene.palette)?.name ?? '';
    // the display family only; the full pairing name belongs to the Type tab (R10)
    if (f === 'type') return choosePairing(spec).name.split(' / ')[0];
    const g = scene.items.filter((i) => i.kind === 'graphic').map((i) => (i as { name: string }).name);
    return human(g.find((n) => STYLES[spec.style].motifs.includes(n)) ?? g[0] ?? 'none');
  };

  const setPage = (n: number) => setPages((p) => ({ ...p, [tab]: n }));
  const seg = <T extends string>(list: [T, string][], cur: T, on: (v: T) => void, attr: string) => (
    <div class="seg" role="group">
      {list.map(([v, label]) => <button class={cur === v ? 'on' : ''} aria-pressed={cur === v} {...{ [attr]: v }} onClick={() => on(v)}><L t={label} /></button>)}
    </div>
  );

  const stylePages = [
    <div class="tiles">
      {STYLE_IDS.map((id) => (
        <button class={spec.style === id ? 'tile on' : 'tile'} aria-pressed={spec.style === id} data-style={id} onClick={() => pickStyle(id)}>
          <span class="thumb"><canvas ref={(c) => { tiles.current[id] = c; }} /></span>
          <span class="words"><L t={STYLES[id].name} c="name" /><L t={STYLES[id].blurb} c="blurb" /></span>
        </button>
      ))}
    </div>,
  ];
  // a text layer's row (spec 8.6, 10.2, 10.3): its level (a tap steps to the next), its words and More, which turns
  // the row to its edit controls (in Advanced Up and Down, then on/off, Remove and Done) so the field keeps at least
  // 160 px at 360 (review R17 M2); a layer that is off shows its words dimmed; one the design cannot fit is flagged
  const textRow = (l: TextLayer, i: number) => {
    const flagged = !!scene?.flagged?.includes(l.id);
    const next = LEVELS[(LEVELS.indexOf(l.level) + 1) % LEVELS.length];
    const lvl = <button class="lvl" data-level-of={l.id} aria-label={`${LEVEL_NAME[l.level]}${flagged ? ', does not fit' : ''}: change to ${LEVEL_NAME[next]}`} onClick={() => commit((s) => setLevel(s, l.id, next))}><L t={flagged ? LEVEL_SHORT[l.level] + ' !' : LEVEL_SHORT[l.level]} /></button>;
    const cls = (flagged ? 'slot layer flagged' : 'slot layer') + (editing === l.id ? ' editing' : '') + (l.on ? '' : ' off');
    if (editing === l.id) return (
      <div class={cls} data-layer={l.id} data-flagged={flagged ? '' : undefined}>
        {!advanced && lvl}
        {advanced && <button class="icon up" data-up={l.id} aria-label="Move up" disabled={i === 0} onClick={() => commit((s) => moveLayer(s, l.id, -1))}><Icon n="prev" /></button>}
        {advanced && <button class="icon down" data-down={l.id} aria-label="Move down" disabled={i === spec.text.length - 1} onClick={() => commit((s) => moveLayer(s, l.id, 1))}><Icon n="prev" /></button>}
        <button class={l.on ? 'switch on' : 'switch'} role="switch" aria-checked={l.on} aria-label={`${LEVEL_NAME[l.level]} on`} data-layer-on={l.id} onClick={() => commit((s) => toggleLayer(s, l.id))}><i /></button>
        <button class="icon wide" data-remove={l.id} aria-label={`Remove ${LEVEL_NAME[l.level]}`} onClick={() => { setEditing(null); commit((s) => removeLayer(s, l.id)); }}><Icon n="close" />{!advanced && <L t="Remove" />}</button>
        <button class="icon" data-done={l.id} aria-label="Done" onClick={() => setEditing(null)}><Icon n="check" /></button>
      </div>
    );
    return (
      <div class={cls} data-layer={l.id} data-flagged={flagged ? '' : undefined}>
        {lvl}
        <Field key={l.id + l.level} layer={l} onText={onText} />
        <button class="icon" data-more={l.id} aria-label={`More for ${LEVEL_NAME[l.level]}${l.on ? '' : ', off'}`} onClick={() => setEditing(l.id)}><Icon n="more" /></button>
      </div>
    );
  };
  // add a layer, up to eight (spec 8.6): the level button steps through the six levels, Add adds one of it; the panel
  // turns to the page the new row is on
  const addRow = (
    <div class="slot layer" data-row="layer-add">
      <button class="lvl" data-add-level={addLevel} aria-label={`Adds ${LEVEL_NAME[addLevel]}: change level`} onClick={() => setAddLevel(LEVELS[(LEVELS.indexOf(addLevel) + 1) % LEVELS.length])}><L t={LEVEL_SHORT[addLevel]} /></button>
      <button class="icon wide" data-add={addLevel} disabled={spec.text.length >= MAX_LAYERS} aria-label={`Add ${LEVEL_NAME[addLevel]}`} onClick={() => { commit((s) => addLayer(s, addLevel)); setPages((p) => ({ ...p, text: 99 })); }}><Icon n="add" /><L t={spec.text.length >= MAX_LAYERS ? 'Eight layers' : 'Add layer'} /></button>
    </div>
  );
  /** Rows two to a page, or all on one page where four 48 px rows fit (spec 10.1: page chips only when they do not fit). */
  const paged = (rows: ComponentChildren[]) => {
    const per = tall ? 4 : 2, out: ComponentChildren[][] = [];
    for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per));
    return out.map((r) => <div class="rows">{r}</div>);
  };
  const pomo = spec.style === 'pomo';
  // a picked layout of the other dialect would win over the Dialect control (review R6 M4): it goes
  const setDialect = (d: string) => commit((s) => {
    const dialect = d === 'either' ? null : (d as Spec['pick']['dialect']);
    const of = dialect && STYLES.pomo.parts.layout.layoutsOf?.[dialect];
    return { ...s, pick: { ...s.pick, dialect, layout: of && s.pick.layout && !of.includes(s.pick.layout) ? null : s.pick.layout } };
  });
  const textPages = paged([...spec.text.map(textRow), addRow]);
  const modeRow = seg([['light', 'Light'], ['dark', 'Dark']], spec.mode, (m) => set({ mode: m }), 'data-mode');
  const finishRow = seg(FINISHES, spec.finish, (f) => set({ finish: f }), 'data-finish');
  const marksRow = <div class="captioned"><L t="Marks" c="cap" />{seg(MARKS, spec.marks, (m) => set({ marks: m }), 'data-marks')}</div>;
  const rerollBtn = (f: Facet) => <button aria-label={REROLL_LABEL[f]} data-reroll={f} onClick={() => commit((s) => reroll(s, f))}><Icon n="reroll" /><L t={FACET_LABEL[f]} /></button>;
  const lookPages = paged([
    modeRow,
    // spec 7 (R7): every finish and marks level draws
    finishRow,
    marksRow,
    <div class="captioned"><L t="New" c="cap" /><div class="seg rerolls" role="group">{FACETS.map(rerollBtn)}</div></div>,
    // Postmodern only: the Dialect control (spec 8.2)
    ...(pomo ? [<div class="captioned"><L t="Dialect" c="cap" />{seg(DIALECT, spec.pick.dialect ?? 'either', setDialect, 'data-dialect')}</div>] : []),
  ]);

  // Advanced (spec 10.3): the controls the parts list for the design on screen, drawn by kind
  // a control whose effect hangs on how the text fits is tried with the fonts in use (review R10 S1): a few solves, so
  // only when the design or the stage changes
  const adv: Advanced | null = useMemo(() => (advanced && scene ? advancedOf(spec, scene, (s) => sceneOf(s, undefined, { pairing: scene.pairing })) : null), [advanced, spec, scene]);
  const setCtl = (c: Control, v: Value, merge = false) => commit((s) => apply(s, c, v), merge ? 'ctl:' + c.id : null);
  const ctlRow = (c: Control): ComponentChildren => {
    const cur = read(spec, c.where);
    if (c.kind === 'choice' && c.options.length <= SEG_MAX) {
      return (
        <div class="captioned" data-row={c.id}><L t={c.label} c="cap" />
          <div class="seg" role="group">
            {c.options.map((o) => <button class={cur === o.v ? 'on' : ''} aria-pressed={cur === o.v} data-ctl={c.id} data-v={String(o.v)} onClick={() => setCtl(c, o.v)}><L t={o.label} /></button>)}
          </div>
        </div>
      );
    }
    if (c.kind === 'choice') {
      // a stepper through Auto and every option: one thumb, nothing to scroll; unset, it shows what the design draws
      // (muted) and steps from there (review R10 M6)
      const at = cur === null && c.drawn !== undefined ? c.drawn : cur;
      const i = Math.max(0, c.options.findIndex((o) => o.v === at)), n = c.options.length;
      return (
        <div class="captioned stepper" data-row={c.id}><L t={c.label} c="cap" />
          <button class="step" aria-label={`${c.label}: previous`} data-ctl-prev={c.id} onClick={() => setCtl(c, c.options[(i + n - 1) % n].v)}><Icon n="prev" /></button>
          <L t={c.options[i].label} c={cur === null ? 'value unset' : 'value'} />
          <button class="step" aria-label={`${c.label}: next`} data-ctl-next={c.id} onClick={() => setCtl(c, c.options[(i + 1) % n].v)}><Icon n="next" /></button>
        </div>
      );
    }
    if (c.kind === 'range') {
      const v = typeof cur === 'number' ? cur : c.shown ?? c.min;
      // a scale-like range moves in log space: equal thumb travel, equal ratio (review R10 M2)
      const lg = !!c.log && c.min > 0, span = Math.log(c.max / c.min);
      const toT = (x: number) => Math.round((LOG_STEPS * Math.log(Math.max(c.min, Math.min(c.max, x)) / c.min)) / span);
      const fromT = (t: number) => Number((c.min * Math.exp((span * t) / LOG_STEPS)).toPrecision(4));
      return (
        <div class="captioned ranged" data-row={c.id}><L t={c.label} c="cap" />
          <input type="range" class="range" min={lg ? 0 : c.min} max={lg ? LOG_STEPS : c.max} step={lg ? 1 : c.step} value={lg ? toT(v) : v} aria-label={c.label} data-ctl={c.id}
            onInput={(e) => { const x = Number((e.target as HTMLInputElement).value); setCtl(c, lg ? fromT(x) : x, true); }} />
          <L t={num(v, c.step)} c={cur === null ? 'value unset' : 'value'} />
          <button class={cur === null ? 'auto on' : 'auto'} aria-pressed={cur === null} aria-label={`${c.label}: auto`} data-ctl-auto={c.id} onClick={() => setCtl(c, null)}><L t="Auto" /></button>
        </div>
      );
    }
    const on = cur === null;
    return (
      <div class="slot edge" data-row={c.id}><L t={c.label} c="cap" /><L t={on ? c.onLabel : c.offLabel} c="hint" />
        <button class={on ? 'switch on' : 'switch'} role="switch" aria-checked={on} aria-label={c.label} data-ctl={c.id} data-testid={c.id === 'pomo.paperEdge' ? 'paper-edge' : undefined}
          onClick={() => setCtl(c, on ? c.off : null)}><i /></button>
      </div>
    );
  };
  /** Switches of one kind (the marks allowed) as rows of toggles: pressed is on. */
  const switchRows = (list: Control[], cap: string) => chunk(list, PER_ROW).map((part, k) => (
    <div class="captioned" data-row={'switches-' + k}><L t={k ? '' : cap} c="cap" />
      <div class="seg" role="group">
        {part.map((c) => {
          const on = read(spec, c.where) === null;
          return <button class={on ? 'on' : ''} aria-pressed={on} data-ctl={c.id} onClick={() => c.kind === 'switch' && setCtl(c, on ? c.off : null)}><L t={c.label} /></button>;
        })}
      </div>
    </div>
  ));
  const newRow = (f: Facet) => <div class="captioned"><L t="New" c="cap" /><div class="seg rerolls" role="group">{rerollBtn(f)}</div></div>;
  const tabRows = (t: 'layout' | 'graphic' | 'type' | 'photo') => (adv ? adv.tabs[t] : []);

  // Graphic tab: the choices, then the parameters of one drawn graphic at a time (a stepper picks which)
  const gAll = tabRows('graphic'), gLib = gAll.filter((c) => c.kind === 'range' && c.where.at === 'params' && c.where.key.startsWith('g.'));
  const gNames = [...new Set(gLib.map((c) => (c.where as { key: string }).key.split('.')[1]))];
  const gOne = gNames[tune % Math.max(1, gNames.length)];
  const tuneRow = gNames.length ? [
    <div class="captioned stepper" data-row="tune"><L t="Tune" c="cap" />
      <button class="step" aria-label="Tune: previous graphic" data-tune-prev onClick={() => setTune((x) => (x + gNames.length - 1) % gNames.length)}><Icon n="prev" /></button>
      <L t={human(gOne)} c="value" />
      <button class="step" aria-label="Tune: next graphic" data-tune-next onClick={() => setTune((x) => (x + 1) % gNames.length)}><Icon n="next" /></button>
    </div>,
  ] : [];

  // Colour tab: the palette, the design's colours (each a system colour picker), reset, the warning (spec 5)
  const colours = adv?.colours ?? [];
  const warn = scene?.colourWarn?.length ? scene.colourWarn : null;
  const swatch = (d: DesignColour, i: number) => (
    <label class={d.now !== d.base ? 'swatch on' : 'swatch'} style={{ background: d.now }} data-swatch={i}>
      <input type="color" value={d.now} aria-label={d.label} data-colour={i} onInput={(e) => commit((s) => setColour(s, d.roles, (e.target as HTMLInputElement).value), 'colour:' + d.roles.join())} />
      <L t={d.label} c="name" />
    </label>
  );
  const edited = !!spec.pick.colours?.[spec.mode];
  /** Reset: this mode's colours back to the palette's; the other form's edits stay. */
  const resetColours = (s: Spec): Spec => {
    const all = { ...(s.pick.colours ?? {}) };
    delete all[s.mode];
    return { ...s, pick: { ...s.pick, colours: Object.keys(all).length ? all : null } };
  };

  // Photo tab (spec 10.2, 10.3, 8.9): add or change, remove, New crop, the Treatment tiles (R15); Advanced adds role,
  // scale, offset and the treatment's parameters
  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    setPhotoState('reading');
    try {
      const id = await addPhoto(f);
      setPhotoState('');
      commit((s) => withPhoto(s, id));
    } catch { setPhotoState('failed'); }
  };
  const has = !!spec.photo;
  const shown = photoOf(spec.photo?.id);
  const photoHint = photoState === 'reading' ? 'Reading photo' : photoState === 'failed' ? 'Could not read that photo'
    : !has ? 'Kept on this phone only' : photoGone ? 'Photo not on this phone' : shown ? `${shown.w} × ${shown.h} px` : '';
  // the palette form drawn (which treatments it can take) and the treatment the design draws (review R15 S1, M7)
  const form = choosePalette(spec);
  const drawnTreat = (scene?.items.find((i) => i.kind === 'graphic' && i.name === 'photo') as { params?: Record<string, unknown> } | undefined)?.params?.treat;
  const photoRows = [
    <div class="seg" role="group" data-row="photo-file">
      <button data-testid="photo-add" disabled={photoState === 'reading'} onClick={() => fileIn.current?.click()}><Icon n="photo" /><L t={has ? 'Change' : 'Add photo'} /></button>
      <button data-testid="photo-remove" disabled={!has} onClick={() => commit((s) => withPhoto(s, null))}><Icon n="close" /><L t="Remove" /></button>
    </div>,
    <div class="captioned" data-row="photo-crop">
      <L t={photoHint} c={photoState === 'failed' || photoGone ? 'hint warn' : 'hint'} />
      <div class="seg rerolls one" role="group"><button data-testid="photo-crop" disabled={!has} aria-label="New crop" onClick={() => commit((s) => newCrop(s))}><Icon n="reroll" /><L t="New crop" /></button></div>
    </div>,
    // Treatment tiles (spec 10.2): Auto (the graphic stream's) and the seven, four to a row (SEG_MAX), so the eight fill
    // two rows and no page holds a short row alone (review bundle 5 M7), each row at one label size (review R15 S5); a
    // treatment the palette cannot draw is disabled (S1); while Auto is on, the tile of the treatment drawn is marked (M7)
    ...chunk([null, ...TREATMENTS] as (string | null)[], SEG_MAX).map((part, k) => (
      <div class="seg" role="group" data-row={'photo-treat-' + k} data-fit-row="">
        {part.map((v) => {
          const on = (spec.photo?.treatment ?? null) === v, can = v === null || treatOffered(v as Treatment, form);
          const drawnHere = !on && v !== null && spec.photo?.treatment == null && drawnTreat === v;
          return <button class={on ? 'on' : drawnHere ? 'drawn' : ''} aria-pressed={on} data-drawn={drawnHere ? '' : undefined} disabled={!has || !can} data-treat={v ?? 'auto'} onClick={() => commit((s) => apply(s, treatmentControl(), v))}><L t={v ? TREATMENT_LABEL[v as keyof typeof TREATMENT_LABEL] : 'Auto'} /></button>;
        })}
      </div>
    )),
  ];
  const photoPages = paged(photoRows);

  const advPages: Record<Tab, ComponentChildren[]> = {
    style: [...stylePages, ...paged([
      modeRow, finishRow,
      ...(adv?.tabs.style.filter((c) => c.kind === 'range') ?? []).map(ctlRow),
      marksRow,
      ...switchRows(adv?.tabs.style.filter((c) => c.kind === 'switch') ?? [], 'Allow'),
    ])],
    layout: paged([...tabRows('layout').map(ctlRow), newRow('layout')]),
    graphic: paged([...gAll.filter((c) => !gLib.includes(c)).map(ctlRow), newRow('graphic'), ...tuneRow, ...gLib.filter((c) => (c.where as { key: string }).key.split('.')[1] === gOne).map(ctlRow)]),
    type: paged([...tabRows('type').map(ctlRow), newRow('type')]),
    colour: paged([
      ...(adv?.tabs.colour ?? []).map(ctlRow),
      ...chunk(colours, SWATCH_ROW).map((part, k) => <div class="swatches" data-row={'colours-' + k}>{part.map((d, j) => swatch(d, k * SWATCH_ROW + j))}</div>),
      <div class="captioned" data-row="colour-reset">
        <button class="reset" data-testid="colour-reset" disabled={!edited} onClick={() => commit(resetColours)}><L t="Reset" /></button>
        <L t={warn ? 'Low contrast: text kept on a plate' : edited ? 'For this design only' : 'Tap a colour to change it'} c={warn ? 'hint warn' : 'hint'} />
        <div class="seg rerolls one" role="group">{rerollBtn('colour')}</div>
      </div>,
    ]),
    // the position of each slot's lead layer follows its row (spec 8.5, 8.6), and so does every other layer's place
    // where its level has more than one (review R17 S4)
    text: paged([...spec.text.flatMap((l, i) => {
      const k = LEVEL_SLOT[l.level], lead = leadsOf(spec.text)[k];
      const pos = lead?.id === l.id && l.level !== 'body' && l.level !== 'label' ? adv?.positions[k] : adv?.layerPlaces[l.id];
      return [textRow(l, i), ...(pos ? [ctlRow(pos)] : [])];
    }), addRow]),
    look: lookPages,
    // the treatment is on its tiles; the generated list adds the rest
    photo: paged([...photoRows, ...(adv?.tabs.photo ?? []).filter((c) => c.id !== 'photo.treatment').map(ctlRow)]),
  };
  const panel = advanced ? advPages[tab] : { style: stylePages, text: textPages, look: lookPages, photo: photoPages }[tab as 'style' | 'text' | 'look' | 'photo'];

  // the export sheet: which sizes this phone can make for the formats and file chosen, and what the file will be
  // a size not yet probed counts as one that works until the probe after paint says otherwise (review R16 M6); a size
  // that failed this session is greyed (review R16 S2)
  const expOk = useMemo(() => {
    if (sheet !== 'export') return [] as Size[];
    const all: Size[] = ['1x', '2x', '3x', 'print'];
    return all.filter((z) => sizes.every((f) => (z === 'print' && f !== 'A') || workingSizes(f, kind, [z], bleed && z === 'print', LIMITS, false).length > 0));
  }, [sheet, sizes, kind, bleed, expNote, probed]);
  useEffect(() => {
    if (sheet !== 'export') return;
    // one probe per idle moment once the sheet has painted, then the sheet again
    const idle = (f: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 200 }) : setTimeout(f, 30));
    let alive = true, any = false;
    const step = () => { if (!alive) return; if (probeQueued()) { any = true; idle(step); } else if (any) setProbed((p) => p + 1); };
    requestAnimationFrame(() => idle(step));
    return () => { alive = false; };
  }, [sheet, expOk]);
  useEffect(() => {
    if (sheet === 'export' && expOk.length && !expOk.includes(size)) setSize(expOk[expOk.length - 1]);
  }, [sheet, expOk]);
  // at most four lines (review R16 S4): the failure and the largest that works (just after a failure, at a size under
  // Print), or what cannot be made; the file; sRGB at Print; the photo. A tap on a choice clears the failure's note.
  const expLines = useMemo(() => {
    if (sheet !== 'export') return [] as string[];
    const out: string[] = [];
    const first = FORMAT_LIST.find((f) => sizes.includes(f)) ?? spec.format, b = bleed && size === 'print';
    const D = exportDims(first, size === 'print' && first !== 'A' ? '3x' : size, b);
    const cannot = (['1x', '2x', '3x', 'print'] as Size[]).filter((z) => (z !== 'print' || sizes.includes('A')) && !expOk.includes(z));
    if (expNote) out.push(...expNote.split('\n'));
    else if (cannot.length) out.push(`This phone cannot make ${cannot.map((z) => SIZE_LABEL[z]).join(', ')} as ${KIND_LABEL[kind]}${kind !== 'png' ? '; PNG may' : ''}`);
    // WebP carries no density, so its Print file does not open at A3 by itself (review R16 S1)
    out.push(size === 'print' ? `A3${kind === 'webp' ? ' (WebP holds no dpi)' : ' at 300 dpi'}, ${px(D.w, D.h)} px${b ? ', 3 mm bleed' : ''}` : sizes.length > 1 ? `${sizes.length} files, ${D.w} px wide` : `${px(D.w, D.h)} px`);
    if (size === 'print') out.push('sRGB: saturated colours print duller');
    if (spec.photo) {
      const n = photoNeed({ ...spec, format: first }, { pairing: drawn.current?.pairing }, size === 'print' && first !== 'A' ? '3x' : size);
      if (n) out.push(`Photo ${px(...n.has)}, wants ${px(...n.wants)}${photoShort(n) ? ': drawn anyway' : ''}`);
    }
    return out;
  }, [sheet, sizes, size, bleed, kind, expOk, expNote, spec]);


  return (
    <div class={sheet ? 'app sheeted' : 'app'}>
      <header>
        <div class="wm" aria-label="rstr">rs<b>t</b>r</div>
        <button class="seedchip" data-testid="seed" aria-label="Copy seed" onClick={copySeed}><L t={flash === 'copied' ? 'Copied' : flash === 'copyfail' ? 'Copy failed' : `#${seedCode(spec.seeds)}`} /></button>
        <button class="kept" data-testid="kept" aria-label="Kept" onClick={() => setSheet('kept')}><Icon n="kept" /><L t={String(kept.length)} /></button>
        <button class="adv" data-testid="advanced" aria-pressed={advanced} onClick={() => { setAdvanced((a) => !a); setTab((t) => (advanced ? (SIMPLE_TABS.includes(t) ? t : 'style') : t === 'look' ? 'style' : t)); }}><L t="Advanced" /></button>
      </header>
      <input ref={fileIn} type="file" accept="image/*" hidden data-testid="photo-input" onChange={onFile} />
      <div class={note || saveNote ? 'stage noted' : 'stage'}>
        <canvas ref={cv} data-testid="stage" />
        {(note || saveNote) && (
          <div class="note" role="status">
            {saveNote && <span data-testid="save-note">{saveNote}</span>}
            {saveNote && note && ' · '}
            {note && <span data-testid="font-note">{note}</span>}
          </div>
        )}
      </div>
      {seg(FORMAT_LIST.map((f) => [f, f] as [Format, string]), spec.format, (f) => set({ format: f }), 'data-format')}
      <div class="locks" role="group" aria-label="Locks">
        {FACETS.map((f) => (
          <button class={locks[f] ? 'lock on' : 'lock'} aria-pressed={locks[f]} data-lock={f} onClick={() => setLocks((l) => ({ ...l, [f]: !l[f] }))}>
            <span class="top"><Icon n={locks[f] ? 'lock' : 'unlock'} /><L t={FACET_LABEL[f]} /></span>
            <L t={value(f)} c="val" />
          </button>
        ))}
      </div>
      <Panel pages={panel} page={pages[tab]} setPage={setPage} />
      <div class="actions">
        <button class="act" data-testid="back" aria-label="Back" disabled={!doc.back.length} onClick={goBack}><Icon n="back" /></button>
        <button class="shuffle" data-testid="shuffle" onClick={doShuffle}><Icon n="shuffle" /><L t="Shuffle" /></button>
        <button class={flash === 'kept' ? 'act done' : 'act'} data-testid="keep" aria-label="Keep" onClick={keep}><Icon n="keep" /></button>
        <button class="act" data-testid="export" aria-label="Export" disabled={!loaded} onClick={() => { setSizes([spec.format]); if (size === 'print' && spec.format !== 'A') setSize('3x'); setExpNote(''); setSheet('export'); }}><Icon n="save" /></button>
      </div>
      <nav class="tabs" role="tablist">
        {(advanced ? ADV_TABS : SIMPLE_TABS).map((t) => (
          <button role="tab" aria-selected={tab === t} class={tab === t ? 'on' : ''} data-tab={t} onClick={() => setTab(t)}><Icon n={t} /><L t={human(t)} /></button>
        ))}
      </nav>
      {sheet && <div class="scrim" data-testid="scrim" onClick={() => setSheet(null)} />}
      {sheet === 'export' && (
        <div class="sheet" data-testid="export-sheet" role="dialog" aria-label="Export">
          <div class="sheethead"><L t="Export" c="title" /><button class="act" data-testid="close" aria-label="Close" onClick={() => setSheet(null)}><Icon n="close" /></button></div>
          <div class="captioned" data-row="formats">
            <L t="Formats" c="cap" />
            <div class="seg" role="group">
              {FORMAT_LIST.map((f) => (
                <button class={sizes.includes(f) ? 'on' : ''} aria-pressed={sizes.includes(f)} data-fmt={f} onClick={() => {
                  const next = sizes.includes(f) ? (sizes.length > 1 ? sizes.filter((x) => x !== f) : sizes) : [...sizes, f];
                  setSizes(next);
                  setExpNote('');
                  // Print is A3: a format other than A takes the largest screen size instead
                  if (size === 'print' && next.some((x) => x !== 'A')) setSize('3x');
                }}><L t={f} /></button>
              ))}
            </div>
          </div>
          <div class="captioned" data-row="size">
            <L t="Size" c="cap" />
            <div class="seg" role="group">
              {(sizes.includes('A') ? (['1x', '2x', '3x', 'print'] as Size[]) : (['1x', '2x', '3x'] as Size[])).map((z) => (
                <button class={size === z ? 'on' : ''} aria-pressed={size === z} data-size={z} disabled={!expOk.includes(z)} onClick={() => { setExpNote(''); setSize(z); if (z === 'print') setSizes(['A']); }}><L t={SIZE_LABEL[z]} /></button>
              ))}
            </div>
          </div>
          {size === 'print' && (
            <div class="captioned" data-row="bleed">
              <L t="Bleed" c="cap" />
              {seg([['off', 'Off'], ['3mm', '3 mm']], bleed ? '3mm' : 'off', (v) => { setExpNote(''); setBleed(v === '3mm'); }, 'data-bleed')}
            </div>
          )}
          <div class="captioned" data-row="file">
            <L t="File" c="cap" />
            {seg(KINDS, kind, (k) => { setExpNote(''); setKind(k); }, 'data-kind')}
          </div>
          <div class="expinfo" data-testid="export-info">
            {expLines.map((t, i) => <L t={t} c={i === 0 && expNote ? 'hint warn' : 'hint'} min={INFO_MIN} />)}
          </div>
          <div class="go">
            <button class="primary" data-testid="save" disabled={busy} onClick={save}><Icon n="save" /><L t={busy ? (making ? `Making… ${making[0]} of ${making[1]}` : 'Making…') : `Save ${sizes.length} ${sizes.length === 1 ? 'file' : 'files'}`} /></button>
            {canShare && <button class="act" data-testid="share" aria-label="Share" disabled={busy} onClick={share}><Icon n="share" /></button>}
          </div>
        </div>
      )}
      {sheet === 'kept' && (
        <div class="sheet" data-testid="kept-sheet" role="dialog" aria-label="Kept">
          <div class="sheethead"><L t={`Kept · ${kept.length}`} c="title" /><button class="act" data-testid="close" aria-label="Close" onClick={() => setSheet(null)}><Icon n="close" /></button></div>
          {kept.length ? (
            <div class="keptgrid">
              {Array.from({ length: KEPT_PAGE }, (_, j) => {
                const i = keptPage * KEPT_PAGE + j;
                if (!kept[i]) return <span class="cell" />;
                return (
                  <button class="cell" data-kept={i} aria-label={`Kept design ${i + 1}`}
                    onPointerDown={() => { hold.current.fired = false; clearTimeout(hold.current.t); hold.current.t = window.setTimeout(() => { hold.current.fired = true; deleteKept(i); }, 600); }}
                    onPointerUp={() => clearTimeout(hold.current.t)} onPointerLeave={() => clearTimeout(hold.current.t)} onPointerCancel={() => clearTimeout(hold.current.t)}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => { if (!hold.current.fired) openKept(i); hold.current.fired = false; }}>
                    <canvas key={JSON.stringify(kept[i])} ref={(c) => { keptCv.current[j] = c; }} />
                  </button>
                );
              })}
            </div>
          ) : <div class="empty"><L t="Nothing kept yet" /></div>}
          <div class="pager">
            <button class="act" data-testid="kept-prev" aria-label="Previous page" disabled={keptPage === 0} onClick={() => setKeptPage((p) => p - 1)}><Icon n="prev" /></button>
            <L t={kept.length ? `${keptPage + 1} / ${keptPages} · tap opens, hold deletes` : 'Keep saves the design here'} c="hint" />
            <button class="act" data-testid="kept-next" aria-label="Next page" disabled={keptPage >= keptPages - 1} onClick={() => setKeptPage((p) => p + 1)}><Icon n="next" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

