/**
 * The frame of spec 10.1 and Simple mode of 10.2: header, stage, format, locks, panel, action row, tab bar,
 * the Kept and Export sheets. State logic is pure and lives in ./state; drawing lives in the engine.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { installApi } from '../api';
import { choosePairing, render, scene as sceneOf, thumb, type Use } from '../engine';
import { varietyKey } from '../engine/proof';
import { resolvePairing } from '../engine/layout';
import { pixelHash } from '../engine/pixels';
import { defaultPairing } from '../data/pairings';
import { PALETTES } from '../data/palettes';
import { available, coreFailures, ensure, onFontsChange } from '../fonts';
import { FORMAT_LIST, FORMATS, type Format } from '../engine/formats';
import { STYLES } from '../engine/styles';
import type { Scene } from '../engine/scene';
import { defaultSpec, FACETS, migrate, newSeed, newSeeds, seedCode, STYLE_IDS, type Facet, type Finish, type Marks, type Slot, type Spec, type StyleId } from '../engine/spec';
import { fitAll } from './fit';
import { Icon } from './icons';
import { addKept, infoText, openLink, parseInfo, pushBack, reroll, restore, serialize, shuffleFresh, STORE_KEY, withStyle, type Locks, type Saved } from './state';
import { advancedOf, type Advanced } from '../engine/advanced';
import { apply, read, setColour, type Control, type DesignColour, type Value } from '../engine/controls';

/** What the stage drew: the pairing asked for, the one used, and the note (spec 6). */
export interface Drawn { wanted: string; pairing: string; note: string; }

type Tab = 'style' | 'text' | 'look' | 'layout' | 'graphic' | 'type' | 'colour';
/** Simple's four tabs (Photo comes with R14) and Advanced's seven (spec 10.2, 10.3; Photo with R14). */
const SIMPLE_TABS: Tab[] = ['style', 'text', 'look'];
const ADV_TABS: Tab[] = ['style', 'layout', 'graphic', 'type', 'colour', 'text'];
type Sheet = null | 'kept' | 'export';
type Kind = 'jpeg' | 'png';

const FACET_LABEL: Record<Facet, string> = { layout: 'Layout', colour: 'Colour', graphic: 'Graphic', type: 'Type' };
const REROLL_LABEL: Record<Facet, string> = { layout: 'New layout', colour: 'New colours', graphic: 'New graphic', type: 'New type' };
const FINISHES: [Finish, string][] = [['clean', 'Clean'], ['grain', 'Grain'], ['grunge', 'Grunge'], ['vhs', 'VHS'], ['glitch', 'Glitch']];
const MARKS: [Marks, string][] = [['off', 'Off'], ['light', 'Light'], ['full', 'Full']];
/** Postmodern's Dialect control (spec 8.2, 10.2): Either lets the layout stream pick. */
const DIALECT: [string, string][] = [['either', 'Either'], ['icecream', 'Ice cream'], ['photocopy', 'Photocopy']];
const SLOT_LABEL: Record<Slot, string> = { title: 'Title', subtitle: 'Subtitle', info: 'Info', caption: 'Caption' };
const KEPT_PAGE = 6;
/** Screens this tall hold four 48 px rows in the panel; the same query sets the panel's height in app.css. */
const TALL = '(min-height: 760px)';

/** A choice with this many options or fewer is a row of segments; more is a stepper (spec 10.1: 48 px each). */
const SEG_MAX = 4;
/** At most this many switches or swatches share a row (each at least 48 px beside the page chips at 360 wide). */
const PER_ROW = 4;
const chunk = <T,>(l: T[], n: number): T[][] => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));
/** A range value as the row shows it: a whole number, or two decimals. */
const num = (v: number, step: number) => (step >= 1 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, ''));

const human = (id: string) => (id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ') : '');
const same = (a: Spec, b: Spec) => JSON.stringify(a) === JSON.stringify(b);
export const fileName = (s: Spec, f: Format, k: Kind) => `rstr-${seedCode(s.seeds)}-${f.replace(':', 'x')}.${k === 'jpeg' ? 'jpg' : 'png'}`;

/** A label that shrinks to fit, then shortens (spec 10.1). Its text is set by fitAll, never by Preact. */
const L = ({ t, c }: { t: string; c?: string }) => <span class={c ? `fit ${c}` : 'fit'} data-fit={t} />;

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
function Field({ slot, spec, onText }: { slot: Slot; spec: Spec; onText: (slot: Slot, v: string) => void }) {
  const value = slot === 'info' ? infoText(spec.text.info.v) : (spec.text[slot].v as string);
  const [draft, setDraft] = useState(value);
  const shown = slot === 'info' ? (infoText(parseInfo(draft)) === value ? draft : value) : value;
  const onInput = (e: Event) => { const v = (e.target as HTMLInputElement).value; setDraft(v); onText(slot, v); };
  const props = { class: 'field', value: shown, 'data-field': slot, 'aria-label': SLOT_LABEL[slot], onInput, spellcheck: false };
  return slot === 'title' ? <textarea rows={1} {...props} /> : <input type="text" {...props} />;
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
  const [pages, setPages] = useState<Record<Tab, number>>({ style: 0, text: 0, look: 0, layout: 0, graphic: 0, type: 0, colour: 0 });
  /** Graphic tab: whose parameters are shown, of the graphics the design draws. */
  const [tune, setTune] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sizes, setSizes] = useState<Format[]>([init.current.spec.format]);
  const [kind, setKind] = useState<Kind>('jpeg');
  const [keptPage, setKeptPage] = useState(0);
  const [flash, setFlash] = useState<'' | 'copied' | 'copyfail' | 'kept'>('');
  const [saveNote, setSaveNote] = useState('');
  const tall = useMedia(TALL);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [scene, setScene] = useState<Scene | null>(null);
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

  const draw = (s: Spec) => {
    const my = ++token.current;
    const job = fontsFor(ready, s).then(({ use, drawn: d }) => {
      if (my !== token.current || !cv.current) return;
      const sc = render(cv.current, s, null, use);
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
    const r = shuffleFresh(s, locksRef.current, recentShuffles.current, shuffleKey);
    recentShuffles.current = r.recent;
    return preferAvailable(r.spec, locksRef.current.type);
  });
  const pickStyle = (id: StyleId) => commit((s) => preferAvailable(withStyle(s, id), locksRef.current.type));
  const set = (p: Partial<Spec>) => commit((s) => ({ ...s, ...p }));
  const onText = (slot: Slot, v: string) => commit((s) => ({
    ...s,
    text: { ...s.text, [slot]: { ...s.text[slot], v: slot === 'info' ? parseInfo(v) : v } },
  }), 'text:' + slot);
  const toggleSlot = (slot: Slot) => commit((s) => ({ ...s, text: { ...s.text, [slot]: { ...s.text[slot], on: !s.text[slot].on } } }));
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

  /** Export: each chosen size drawn at full size after its fonts (spec 4, 6), as files named rstr-<seed>-<format>. */
  const files = async (): Promise<File[]> => {
    const s = docRef.current.spec, out: File[] = [];
    for (const f of FORMAT_LIST.filter((x) => sizes.includes(x))) {
      const one = { ...s, format: f };
      const { use } = await fontsFor(ready, one);
      const c = document.createElement('canvas');
      render(c, one, null, use);
      const type = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, type, 0.92));
      if (blob) out.push(new File([blob], fileName(s, f, kind), { type }));
    }
    return out;
  };
  const save = async () => {
    setBusy(true);
    try {
      for (const file of await files()) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        await new Promise((r) => setTimeout(r, 150));
      }
    } finally { setBusy(false); }
  };
  const canShare = (() => {
    try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] }); } catch { return false; }
  })();
  const share = async () => {
    setBusy(true);
    try { await navigator.share({ files: await files() }); } catch { /* cancelled */ } finally { setBusy(false); }
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
        fileName: (raw: unknown, f: Format, k: Kind) => fileName(migrate(raw), f, k),
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
    keptCv.current.forEach((c, i) => {
      const s = kept[keptPage * KEPT_PAGE + i];
      if (!c || !s || !c.parentElement) return;
      const box = c.parentElement.getBoundingClientRect(), [W, H] = FORMATS[s.format];
      thumb(c, s, Math.min(box.width - 8, ((box.height - 8) * W) / H) * devicePixelRatio, resolvePairing(s, available));
    });
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
  const textRow = (slot: Slot) => (
    <div class="slot">
      <L t={SLOT_LABEL[slot]} c="cap" />
      <Field slot={slot} spec={spec} onText={onText} />
      <button class={spec.text[slot].on ? 'switch on' : 'switch'} role="switch" aria-checked={spec.text[slot].on} aria-label={`${SLOT_LABEL[slot]} on`} data-slot={slot} onClick={() => toggleSlot(slot)}><i /></button>
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
  const textPages = paged((['title', 'subtitle', 'info', 'caption'] as Slot[]).map(textRow));
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
  const adv: Advanced | null = advanced && scene ? advancedOf(spec, scene) : null;
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
      // a stepper through Auto and every option: one thumb, nothing to scroll
      const i = Math.max(0, c.options.findIndex((o) => o.v === cur)), n = c.options.length;
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
      return (
        <div class="captioned ranged" data-row={c.id}><L t={c.label} c="cap" />
          <input type="range" class="range" min={c.min} max={c.max} step={c.step} value={v} aria-label={c.label} data-ctl={c.id}
            onInput={(e) => setCtl(c, Number((e.target as HTMLInputElement).value), true)} />
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
  const tabRows = (t: 'layout' | 'graphic' | 'type') => (adv ? adv.tabs[t] : []);

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
      ...chunk(colours, PER_ROW).map((part, k) => <div class="swatches" data-row={'colours-' + k}>{part.map((d, j) => swatch(d, k * PER_ROW + j))}</div>),
      <div class="captioned" data-row="colour-reset">
        <button class="reset" data-testid="colour-reset" disabled={!edited} onClick={() => commit(resetColours)}><L t="Reset" /></button>
        <L t={warn ? 'Low contrast: text kept on a plate' : edited ? 'For this design only' : 'Tap a colour to change it'} c={warn ? 'hint warn' : 'hint'} />
        <div class="seg rerolls one" role="group">{rerollBtn('colour')}</div>
      </div>,
    ]),
    text: paged((['title', 'subtitle', 'info', 'caption'] as Slot[]).flatMap((k) => [textRow(k), ...(adv?.positions[k] ? [ctlRow(adv.positions[k]!)] : [])])),
    look: lookPages,
  };
  const panel = advanced ? advPages[tab] : { style: stylePages, text: textPages, look: lookPages }[tab as 'style' | 'text' | 'look'];

  return (
    <div class={sheet ? 'app sheeted' : 'app'}>
      <header>
        <div class="wm" aria-label="RSTR">RS<b>T</b>R</div>
        <button class="seedchip" data-testid="seed" aria-label="Copy seed" onClick={copySeed}><L t={flash === 'copied' ? 'Copied' : flash === 'copyfail' ? 'Copy failed' : `#${seedCode(spec.seeds)}`} /></button>
        <button class="kept" data-testid="kept" aria-label="Kept" onClick={() => setSheet('kept')}><Icon n="kept" /><L t={String(kept.length)} /></button>
        <button class="adv" data-testid="advanced" aria-pressed={advanced} onClick={() => { setAdvanced((a) => !a); setTab((t) => (advanced ? (SIMPLE_TABS.includes(t) ? t : 'style') : t === 'look' ? 'style' : t)); }}><L t="Advanced" /></button>
      </header>
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
        <button class="act" data-testid="export" aria-label="Export" disabled={!loaded} onClick={() => { setSizes([spec.format]); setSheet('export'); }}><Icon n="save" /></button>
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
          <L t="Sizes" c="cap" />
          <div class="seg" role="group">
            {FORMAT_LIST.map((f) => (
              <button class={sizes.includes(f) ? 'on' : ''} aria-pressed={sizes.includes(f)} data-size={f} onClick={() => setSizes((z) => (z.includes(f) ? (z.length > 1 ? z.filter((x) => x !== f) : z) : [...z, f]))}><L t={f} /></button>
            ))}
          </div>
          <L t="File" c="cap" />
          {seg([['jpeg', 'JPEG'], ['png', 'PNG']], kind, setKind, 'data-kind')}
          <div class="go">
            <button class="primary" data-testid="save" disabled={busy} onClick={save}><Icon n="save" /><L t={`Save ${sizes.length} ${sizes.length === 1 ? 'file' : 'files'}`} /></button>
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

