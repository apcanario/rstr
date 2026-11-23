/**
 * The frame of spec 10.1 and Simple mode of 10.2: header, stage, format, locks, panel, action row, tab bar,
 * the Kept and Export sheets. State logic is pure and lives in ./state; drawing lives in the engine.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { installApi } from '../api';
import { choosePairing, render, thumb, type Use } from '../engine';
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
import { addKept, infoText, openLink, parseInfo, pushBack, reroll, restore, serialize, shuffle as shuffleSpec, STORE_KEY, withStyle, type Locks, type Saved } from './state';

/** What the stage drew: the pairing asked for, the one used, and the note (spec 6). */
export interface Drawn { wanted: string; pairing: string; note: string; }

type Tab = 'style' | 'text' | 'look';
type Sheet = null | 'kept' | 'export';
type Kind = 'jpeg' | 'png';

const FACET_LABEL: Record<Facet, string> = { layout: 'Layout', colour: 'Colour', graphic: 'Graphic', type: 'Type' };
const REROLL_LABEL: Record<Facet, string> = { layout: 'New layout', colour: 'New colours', graphic: 'New graphic', type: 'New type' };
const FINISHES: [Finish, string][] = [['clean', 'Clean'], ['grain', 'Grain'], ['grunge', 'Grunge'], ['vhs', 'VHS'], ['glitch', 'Glitch']];
const MARKS: [Marks, string][] = [['off', 'Off'], ['light', 'Light'], ['full', 'Full']];
const SLOT_LABEL: Record<Slot, string> = { title: 'Title', subtitle: 'Subtitle', info: 'Info', caption: 'Caption' };
const KEPT_PAGE = 6;
/** Finishes and marks that draw something arrive in R7; until then only Clean and Off can be chosen. */
const DRAWN_FINISH: Finish[] = ['clean'];
const DRAWN_MARKS: Marks[] = ['off'];
/** Screens this tall hold four 48 px rows in the panel; the same query sets the panel's height in app.css. */
const TALL = '(min-height: 760px)';

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
  const p = Math.min(page, pages.length - 1);
  return (
    <div class="panel" data-testid="panel">
      <div class="page" data-page={p}>{pages[p]}</div>
      {pages.length > 1 && (
        <div class="chips" role="group" aria-label="Pages">
          {pages.map((_, i) => <button class={i === p ? 'chip on' : 'chip'} aria-pressed={i === p} aria-label={`Page ${i + 1}`} data-chip={i} onClick={() => setPage(i)}><L t={String(i + 1)} /></button>)}
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
  const [pages, setPages] = useState<Record<Tab, number>>({ style: 0, text: 0, look: 0 });
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
  const doShuffle = () => commit((s) => preferAvailable(shuffleSpec(s, locksRef.current), locksRef.current.type));
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
        const s = id === spec.style ? spec : withStyle(spec, id);
        const box = c.parentElement.getBoundingClientRect(), [W, H] = FORMATS[s.format];
        const w = Math.min(box.width, (box.height * W) / H) * devicePixelRatio;
        if (w > 1) thumb(c, s, w, resolvePairing(s, available));
      }
      setTimeout(next, 0);
    };
    const t = setTimeout(next, 30);
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
    if (f === 'layout') return spec.pick.layout ? human(spec.pick.layout) : '#' + (spec.seeds.layout >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
    if (f === 'colour') return PALETTES[spec.style].find((p) => p.id === scene.palette)?.name ?? '';
    // the display family only; the full pairing name belongs to the Type tab (R10)
    if (f === 'type') return choosePairing(spec).name.split(' / ')[0];
    const g = scene.items.filter((i) => i.kind === 'graphic').map((i) => (i as { name: string }).name);
    return human(g.find((n) => STYLES[spec.style].motifs.includes(n)) ?? g[0] ?? 'none');
  };

  const setPage = (n: number) => setPages((p) => ({ ...p, [tab]: n }));
  const seg = <T extends string>(list: [T, string][], cur: T, on: (v: T) => void, attr: string, can: (v: T) => boolean = () => true) => (
    <div class="seg" role="group">
      {list.map(([v, label]) => <button class={cur === v ? 'on' : ''} aria-pressed={cur === v} disabled={!can(v)} {...{ [attr]: v }} onClick={() => on(v)}><L t={label} /></button>)}
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
  const paged = (rows: ComponentChildren[]) => (tall ? [rows] : [rows.slice(0, 2), rows.slice(2)]).map((r) => <div class="rows">{r}</div>);
  const textPages = paged((['title', 'subtitle', 'info', 'caption'] as Slot[]).map(textRow));
  const lookPages = paged([
    seg([['light', 'Light'], ['dark', 'Dark']], spec.mode, (m) => set({ mode: m }), 'data-mode'),
    // a non-Clean finish or a non-Off marks level kept from elsewhere stays tappable, so it can be left
    seg(FINISHES, spec.finish, (f) => set({ finish: f }), 'data-finish', (f) => DRAWN_FINISH.includes(f) || f === spec.finish),
    <div class="captioned"><L t="Marks" c="cap" />{seg(MARKS, spec.marks, (m) => set({ marks: m }), 'data-marks', (m) => DRAWN_MARKS.includes(m) || m === spec.marks)}</div>,
    <div class="captioned"><L t="New" c="cap" />
      <div class="seg rerolls" role="group">
        {FACETS.map((f) => (
          <button aria-label={REROLL_LABEL[f]} data-reroll={f} onClick={() => commit((s) => reroll(s, f))}><Icon n="reroll" /><L t={FACET_LABEL[f]} /></button>
        ))}
      </div>
    </div>,
  ]);
  const panel = { style: stylePages, text: textPages, look: lookPages }[tab];

  return (
    <div class={sheet ? 'app sheeted' : 'app'}>
      <header>
        <div class="wm" aria-label="RSTR">RS<b>T</b>R</div>
        <button class="seedchip" data-testid="seed" aria-label="Copy seed" onClick={copySeed}><L t={flash === 'copied' ? 'Copied' : flash === 'copyfail' ? 'Copy failed' : `#${seedCode(spec.seeds)}`} /></button>
        <button class="kept" data-testid="kept" aria-label="Kept" onClick={() => setSheet('kept')}><Icon n="kept" /><L t={String(kept.length)} /></button>
        <button class="adv" data-testid="advanced" aria-pressed={advanced} onClick={() => setAdvanced((a) => !a)}><L t="Advanced" /></button>
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
        {(['style', 'text', 'look'] as Tab[]).map((t) => (
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

