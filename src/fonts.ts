/**
 * Font loading (spec 6). The core set and the UI face are bundled and loaded at start. Any other face is
 * fetched from Google Fonts on demand, only the faces a pairing names; the service worker (public/sw.js)
 * caches every file fetched, so a pairing used once works offline. An APK build that ran
 * tools/fetch_fonts.py ships fonts/gf/manifest.json, and then every face comes from there instead.
 * Layout only ever runs with faces this registry reports loaded (see resolvePairing in the engine).
 */
import { CORE_FONTS, UI_FONTS, facesOf, faceKey, PAIRINGS, type Pairing } from './data/pairings';
import { byFamily, cssUrl, parseCss, rulesFor } from './fontcss';
import type { FontRef } from './engine/scene';

/** Spec 6: how long layout waits for a pairing's fonts before drawing with the style's default. */
export const WAIT_MS = 4000;

type State = 'loaded' | 'failed' | Promise<boolean>;
const faces = new Map<string, State>();
const failedCore: string[] = [];
const listeners = new Set<() => void>();
type Local = Record<string, { file: string; range?: string }[]>;
let manifest: Promise<Local | null> | null = null;

const base = () => import.meta.env.BASE_URL;
const desc = (f: FontRef, unicodeRange?: string): FontFaceDescriptors => ({ weight: String(f.weight), style: f.italic ? 'italic' : 'normal', ...(unicodeRange ? { unicodeRange } : {}) });
const label = (f: FontRef) => `${f.family} ${f.weight}${f.italic ? ' italic' : ''}`;

export function onFontsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const changed = () => listeners.forEach((fn) => fn());

/** Loads the bundled core fonts and the UI face. A face that fails does not block the rest; the note names it. */
export function loadCoreFonts(): Promise<void> {
  const all = [...CORE_FONTS, ...UI_FONTS].map((f) => {
    const ref: FontRef = { family: f.family, weight: f.weight, italic: (f as { italic?: boolean }).italic };
    const face = new FontFace(f.family, `url(${base()}fonts/${f.file}) format('woff2')`, desc(ref));
    document.fonts.add(face);
    return face.load().then(
      () => { faces.set(faceKey(ref), 'loaded'); },
      () => { faces.set(faceKey(ref), 'failed'); failedCore.push(label(ref)); },
    );
  });
  return Promise.all(all).then(() => { changed(); });
}

/** Core or UI faces that failed to load, for the note. */
export const coreFailures = () => [...failedCore];

export const isKeyLoaded = (key: string) => faces.get(key) === 'loaded';
export const isLoaded = (f: FontRef) => isKeyLoaded(faceKey(f));
/** True when every face the pairing names is loaded. */
export const available = (p: Pairing) => facesOf(p).every(isLoaded);
/** Families with at least one loaded face. */
export function loadedFamilies(): string[] {
  return [...new Set([...faces.entries()].filter(([, s]) => s === 'loaded').map(([k]) => k.split('|')[0]))];
}

/** The APK's bundled faces (tools/fetch_fonts.py), by face; null in the web app, which has none. */
function loadManifest(): Promise<Local | null> {
  manifest ??= fetch(`${base()}fonts/gf/manifest.json`).then((r) => (r.ok ? r.json() : null)).then(
    (j: { faces?: { family: string; weight: number; italic?: boolean; file: string; range?: string }[] } | null) => {
      if (!j?.faces) return null;
      const out: Local = {};
      for (const f of j.faces) (out[faceKey(f)] ??= []).push({ file: f.file, range: f.range || undefined });
      return out;
    },
    () => null,
  );
  return manifest;
}

/**
 * Before the first online fetch, give the service worker a moment to take control, so the file is cached.
 * The grace counts against the 4 s wait, so it is short (review R3 M8); a file fetched before the worker
 * controls the page is simply fetched again, and cached, on its next use.
 */
let sw: Promise<unknown> | null = null;
function swReady(): Promise<unknown> {
  if (!('serviceWorker' in navigator) || navigator.serviceWorker.controller) return Promise.resolve();
  sw ??= Promise.race([
    new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })),
    new Promise((r) => setTimeout(r, 500)),
  ]);
  return sw;
}

/** Fetch the file (through the service worker and its cache) and add it as a face. */
async function addFace(f: FontRef, url: string, unicodeRange?: string): Promise<void> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`font ${res.status}`);
  const face = new FontFace(f.family, await res.arrayBuffer(), desc(f, unicodeRange));
  await face.load();
  document.fonts.add(face);
}

/** Fetch the faces of one family, from the APK's bundle if it has them, else from Google Fonts. */
async function loadFamily(family: string, want: FontRef[]): Promise<void> {
  const local = await loadManifest();
  if (local && want.every((f) => local[faceKey(f)])) {
    await Promise.all(want.flatMap((f) => local[faceKey(f)].map((x) => addFace(f, `${base()}fonts/gf/${x.file}`, x.range))));
    return;
  }
  await swReady();
  const res = await fetch(cssUrl(family, want), { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`fonts css ${res.status}`);
  const rules = rulesFor(parseCss(await res.text()), want);
  for (const f of want) if (!rules.some((r) => r.face === f)) throw new Error('no face for ' + label(f));
  await Promise.all(rules.map(({ face, rule }) => addFace(face, rule.url, rule.unicodeRange)));
}

/** Start loading every face of the pairing not yet loaded (once per face); resolves true when all are loaded. */
function load(p: Pairing): Promise<boolean> {
  const need = facesOf(p).filter((f) => faces.get(faceKey(f)) !== 'loaded');
  if (!need.length) return Promise.resolve(true);
  const jobs: Promise<boolean>[] = [];
  const fresh: FontRef[] = [];
  for (const f of need) {
    const s = faces.get(faceKey(f));
    if (s instanceof Promise) jobs.push(s);
    else fresh.push(f);   // never tried, or failed before (retry: the network may be back)
  }
  for (const [family, fs] of byFamily(fresh)) {
    const job = loadFamily(family, fs).then(() => true, () => false).then((ok) => {
      for (const f of fs) faces.set(faceKey(f), ok ? 'loaded' : 'failed');
      changed();
      return ok;
    });
    for (const f of fs) faces.set(faceKey(f), job);
    jobs.push(job);
  }
  return Promise.all(jobs).then((r) => r.every(Boolean));
}

/**
 * Wait for a pairing's fonts at most `ms`: true if they are all loaded by then. Loading goes on after a
 * timeout, and onFontsChange fires when it ends, so the caller can draw again with the real fonts.
 */
export function ensure(p: Pairing, ms = WAIT_MS): Promise<boolean> {
  if (available(p)) return Promise.resolve(true);
  return Promise.race([load(p), new Promise<boolean>((r) => setTimeout(() => r(false), ms))]);
}

export const pairingById = (id: string) => Object.values(PAIRINGS).flat().find((p) => p.id === id);
