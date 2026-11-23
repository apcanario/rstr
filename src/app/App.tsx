/** A plain one-screen app (R1): stage, style, format, Shuffle, Export. The full frame is R4. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { installApi } from '../api';
import { choosePairing, render, type Use } from '../engine';
import { defaultPairing } from '../data/pairings';
import { available, coreFailures, ensure, onFontsChange } from '../fonts';
import { FORMAT_LIST, type Format } from '../engine/formats';
import { STYLES } from '../engine/styles';
import { defaultSpec, migrate, newSeed, newSeeds, seedCode, STYLE_IDS, type Spec, type StyleId } from '../engine/spec';

function initial(): Spec {
  const q = new URLSearchParams(location.search).get('s');
  if (q) return migrate(q);
  return defaultSpec(newSeeds());
}

const icon = {
  shuffle: 'M560-160v-80h104L537-367l57-57 126 126v-102h80v240H560Zm-344 0-56-56 504-504H560v-80h240v240h-80v-104L216-160Zm151-377L160-744l56-56 207 207-56 56Z',
  save: 'M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z',
};
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 -960 960 960" aria-hidden="true"><path d={d} /></svg>
);

/** What the stage drew: the pairing asked for, the one used, and the note (spec 6). */
export interface Drawn { wanted: string; pairing: string; note: string; }

/**
 * Spec 6: layout waits for the pairing's fonts; if they have not arrived in 4 s, the style's default pairing
 * draws, a note says so, and the spec keeps the pairing asked for.
 */
async function fontsFor(ready: Promise<void>, spec: Spec): Promise<{ use: Use; drawn: Drawn }> {
  await ready;
  const want = choosePairing(spec), def = defaultPairing(spec.style);
  const ok = available(want) || (await ensure(want));
  const notes: string[] = [];
  if (!ok) notes.push(`${want.name} fonts not available, shown in ${def.name}`);
  const failed = coreFailures();
  if (failed.length) notes.push(`Bundled font failed: ${failed.join(', ')}`);
  return { use: { pairing: ok ? want.id : def.id }, drawn: { wanted: want.id, pairing: ok ? want.id : def.id, note: notes.join(' · ') } };
}

export function App({ ready }: { ready: Promise<void> }) {
  const [spec, setSpec] = useState<Spec>(initial);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState('');
  const cv = useRef<HTMLCanvasElement>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const drawn = useRef<Drawn | null>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const drawnSpec = useRef<Spec | null>(null);
  const token = useRef(0);

  const draw = (s: Spec) => {
    const my = ++token.current;
    const job = fontsFor(ready, s).then(({ use, drawn: d }) => {
      if (my !== token.current || !cv.current) return;
      render(cv.current, s, null, use);
      drawn.current = d;
      drawnSpec.current = s;
      setNote(d.note);
    });
    pending.current = job;
    return job;
  };

  useEffect(() => {
    installApi(ready, () => specRef.current, { idle: () => pending.current, drawn: () => drawn.current, current: () => drawnSpec.current === specRef.current });
    ready.then(() => setLoaded(true));
    // fonts that arrive after the 4 s wait: draw again with the pairing that was asked for
    return onFontsChange(() => {
      const d = drawn.current;
      if (d && d.pairing !== d.wanted && available(choosePairing(specRef.current))) draw(specRef.current);
    });
  }, []);
  useEffect(() => {
    if (loaded) draw(spec);
  }, [spec, loaded]);

  const set = (p: Partial<Spec>) => setSpec((s) => ({ ...s, ...p }));
  const shuffle = () => setSpec((s) => {
    const next: Spec = { ...s, seeds: newSeeds(), pick: { palette: null, pairing: null, motif: null, layout: null } };
    // spec 6: offline, prefer a pairing whose fonts are already here
    for (let i = 0; i < 32 && !navigator.onLine && !available(choosePairing(next)); i++) next.seeds = { ...next.seeds, type: newSeed() };
    return next;
  });
  const save = async () => {
    const { use } = await fontsFor(ready, spec);   // spec 6: export waits for fonts the same way the stage does
    const c = document.createElement('canvas');
    render(c, spec, null, use);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `rstr-${seedCode(spec.seeds)}-${spec.format.replace(':', 'x')}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div class="app">
      <header>
        <div class="wm">RS<b>T</b>R</div>
        <div class="seed" data-testid="seed">#{seedCode(spec.seeds)}</div>
        <button class="mode" data-testid="mode" aria-pressed={spec.mode === 'dark'} onClick={() => set({ mode: spec.mode === 'dark' ? 'light' : 'dark' })}>{spec.mode === 'dark' ? 'Dark' : 'Light'}</button>
      </header>
      <div class={note ? 'stage noted' : 'stage'}>
        <canvas ref={cv} data-testid="stage" />
        {note && <div class="note" data-testid="font-note" role="status">{note}</div>}
      </div>
      <div class="seg" role="group" aria-label="Style">
        {STYLE_IDS.map((id: StyleId) => (
          <button class={spec.style === id ? 'on' : ''} data-style={id} onClick={() => set({ style: id, pick: { palette: null, pairing: null, motif: null, layout: null } })}>{STYLES[id].name}</button>
        ))}
      </div>
      <div class="seg" role="group" aria-label="Format">
        {FORMAT_LIST.map((f: Format) => (
          <button class={spec.format === f ? 'on' : ''} data-format={f} onClick={() => set({ format: f })}>{f}</button>
        ))}
      </div>
      <div class="go">
        <button class="shuffle" data-testid="shuffle" onClick={shuffle}><Icon d={icon.shuffle} />Shuffle</button>
        <button class="export" data-testid="export" aria-label="Export" disabled={!loaded} onClick={save}><Icon d={icon.save} /></button>
      </div>
    </div>
  );
}
