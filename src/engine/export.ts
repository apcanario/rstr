/**
 * Export (spec 10.1, row R16): every size drawn at that size from the spec, never scaled up from a smaller canvas.
 * The Scene is laid out once in 1080-wide units and drawn through a view (./view) at 1x, 2x, 3x or Print, so the
 * finishes, the copier pass and a photo's treatment run on the export's own pixels.
 *
 * Big renders: where a canvas of the asked size cannot be made, or drawing on one fails, the export is drawn in
 * horizontal strips (each with a band more each side (BAND), so passes that read neighbours see what the whole
 * would) and joined: into one canvas where one of the size can still be made (JPEG, WebP, PNG), else straight into a
 * PNG written row by row (./png). A strip draws exactly the pixels of the same rows of the whole (tested at 3x): the
 * finish guard's reading is summed over the strips and its rounds run over them as they run on one canvas. If that
 * fails too, `ExportError` says which size this phone cannot make; the sheet offers the largest that works.
 *
 * Bleed (Print only): the 3 mm round the trim are the trim's own edge mirrored outward, so the ground, every graphic
 * that reaches the edge and the finish run on past the trim line, and nothing on the trim moves.
 */
import type { Ctx } from './graphics/types';
import { exportDims, FORMATS, PRINT_DPI, SIZE_LABEL, SIZE_LIST, sizesOf, type ExportDims, type Format, type Size } from './formats';
import { cellSums, cleanOf, finishBody, GUARD_ROUNDS, readingOf, readsLow, restoreItems, RING, tooLow, type FinishReport, type Sums } from './finish';
import { bounds } from './geom';
import { scene as sceneOf, browserMeasure } from './index';
import type { Use } from './layout';
import { photoOf } from './photo';
import type { GraphicItem, Scene, TextItem } from './scene';
import type { Spec } from './spec';
import { exportView, setView, surfaceLike, type View } from './view';
import { PngWriter, tagJpeg, tagPng } from './png';
import { paintFinished } from './finish';

export type FileKind = 'jpeg' | 'png' | 'webp';
export const FILE_KINDS: FileKind[] = ['jpeg', 'png', 'webp'];
export const MIME: Record<FileKind, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const EXT: Record<FileKind, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
/** A file type as the sheet and its messages name it. */
export const KIND_LABEL: Record<FileKind, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };
/** JPEG quality of spec 10.1; WebP at the same. */
export const QUALITY = 0.92;
/**
 * The band of ./view at export sizes, export rows: vector drawing is clipped band by band, on one canvas and in
 * strips alike. A strip keeps one band and draws one more above and below (its margin, for passes that read
 * neighbours: the held mask's growth, a blur's reach), so its canvas is three bands tall.
 */
export const BAND = 512;
/** Bands a strip keeps. */
export const STRIP_BANDS = 1;

/** File name of spec 10.1: rstr-<seed>-<format>-<width>.<ext>; the width is the file's (bleed included). */
export const exportName = (seed: string, f: Format, width: number, k: FileKind) => `rstr-${seed}-${f.replace(':', 'x')}-${width}.${EXT[k]}`;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
function newCanvas(w: number, h: number): AnyCanvas {
  return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
}
const ctxOf = (c: AnyCanvas) => c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx | null;
/** Free a canvas's pixels now rather than at the next collection. */
const free = (c: AnyCanvas | null | undefined) => { if (c) { c.width = 0; c.height = 0; } };

/**
 * Limits for the tools (spec 10.1, the honest failure): act as a phone that makes no canvas over `maxArea` pixels,
 * or one that makes the canvas but cannot encode one over `failEncodeAbove` pixels (review R16 S2).
 */
export interface Limits { maxArea?: number; failEncodeAbove?: number; }

/**
 * Sizes that failed in this session, per format, file type and bleed (review R16 S2): a size that could be made as
 * a canvas but failed on the way (out of memory, an encoder that gives nothing) is no longer offered or enabled.
 */
const failed = new Set<string>();
const failKey = (f: Format, s: Size, bleed: boolean, k: FileKind) => `${f}|${s}|${bleed && s === 'print' ? 'bleed' : ''}|${k}`;
export const hasFailed = (f: Format, s: Size, bleed: boolean, k: FileKind) => failed.has(failKey(f, s, bleed, k));
/** Forget the failures (the tools). */
export const forgetFailures = () => failed.clear();

/**
 * Whether a canvas of w x h can be made and drawn on here: made, filled at its far corner, read back. A browser
 * that cannot hold it gives no context or reads back nothing.
 */
const made = new Map<string, boolean>();
const queued = new Set<string>();
/**
 * `now` false: a size not yet probed counts as one that can be made, and is queued for probeQueued (review R16 M6:
 * the sheet probes after it has painted, not on opening).
 */
export function canMake(w: number, h: number, lim: Limits = {}, now = true): boolean {
  if (lim.maxArea != null && w * h > lim.maxArea) return false;
  const key = `${w}x${h}`;
  if (!made.has(key)) {
    if (!now) { queued.add(key); return true; }
    made.set(key, probe(w, h));
  }
  return made.get(key)!;
}
/** Probe one queued size; false when none was queued. */
export function probeQueued(): boolean {
  const key = queued.values().next().value;
  if (key === undefined) return false;
  queued.delete(key);
  if (!made.has(key)) { const [w, h] = key.split('x').map(Number); made.set(key, probe(w, h)); }
  return true;
}
function probe(w: number, h: number): boolean {
  let c: AnyCanvas | null = null;
  try {
    c = newCanvas(w, h);
    const x = c.getContext('2d') as Ctx | null;
    if (!x || c.width !== w || c.height !== h) return false;
    x.putImageData(new ImageData(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1), w - 1, h - 1);
    const d = x.getImageData(w - 1, h - 1, 1, 1).data;
    return d[0] === 255 && d[3] === 255;
  } catch { return false; } finally { free(c); }
}

/** Draw a spec's export on one canvas (resized to the file's pixels): the trim through its view, then the bleed. */
export function renderSingle(canvas: AnyCanvas, spec: Spec, sc: Scene, D: ExportDims, band: number | undefined = bandFor(D, sc)): FinishReport {
  const bleed = D.w !== D.trimW || D.h !== D.trimH;
  const trim = bleed ? newCanvas(D.trimW, D.trimH) : canvas;
  if (trim.width !== D.trimW) trim.width = D.trimW;
  if (trim.height !== D.trimH) trim.height = D.trimH;
  setView(trim, exportView(sc.w, sc.h, D.trimW, D.trimH, 0, band));
  const x = ctxOf(trim);
  if (!x) throw new Error('no canvas');
  const rep = paintFinished(x, sc, spec);
  if (bleed) {
    // the trim's rows into the file's canvas through the bleed sink (byte copies: what the strips do, row for row)
    canvas.width = D.w; canvas.height = D.h;
    const o = ctxOf(canvas);
    if (!o) throw new Error('no canvas');
    const sink = bleedSink(canvasSink(o), D);
    for (let y = 0; y < D.trimH; y += BAND) {
      const n = Math.min(BAND, D.trimH - y);
      sink.rows(x.getImageData(0, y, D.trimW, n).data, y, n);
    }
    free(trim);
  }
  setView(canvas, null);
  return rep;
}

/** Bands at every size but 1x (1x is the stage's own drawing, never drawn in strips). */
export const bandFor = (D: ExportDims, sc: Scene): number | undefined => (D.trimW === sc.w && D.trimH === sc.h ? undefined : BAND);

/** Where a strip's trim rows go, in order: y0 is the first trim row, d the RGBA rows of the trim's width. */
export interface RowSink { rows(d: Uint8ClampedArray, y0: number, n: number): Promise<void> | void; }

/** A sink that adds the bleed: each trim row mirrored out at its ends, and the first and last rows mirrored above and below. */
export function bleedSink(out: RowSink, D: ExportDims): RowSink {
  const [l, t, r, b] = D.bleed, W = D.trimW, H = D.trimH, OW = W + l + r;
  if (!l && !t && !r && !b) return out;
  const widen = (d: Uint8ClampedArray, n: number) => {
    const o = new Uint8ClampedArray(OW * n * 4);
    for (let y = 0; y < n; y++) {
      const s = y * W * 4, q = y * OW * 4;
      o.set(d.subarray(s, s + W * 4), q + l * 4);
      for (let i = 0; i < l; i++) o.set(d.subarray(s + (l - 1 - i) * 4, s + (l - i) * 4), q + i * 4);
      for (let i = 0; i < r; i++) o.set(d.subarray(s + (W - 1 - i) * 4, s + (W - i) * 4), q + (l + W + i) * 4);
    }
    return o;
  };
  let tail: Uint8ClampedArray[] = [], head: Uint8ClampedArray[] | null = t ? [] : null, y = 0, seen = 0;
  const rowsOf = (l: Uint8ClampedArray[]) => { const o = new Uint8ClampedArray(OW * 4 * l.length); l.forEach((r, j) => o.set(r, j * OW * 4)); return o; };
  return {
    // in order and without waiting in between: a sink that writes at once (a canvas) stays synchronous
    rows(d, _y0, n) {
      const wide = widen(d, n), ps: unknown[] = [];
      const lines = Array.from({ length: n }, (_, j) => wide.subarray(j * OW * 4, (j + 1) * OW * 4));
      seen += n;
      const emit = (l: Uint8ClampedArray[]) => { if (l.length) { ps.push(out.rows(rowsOf(l), y, l.length)); y += l.length; } };
      if (head) {
        // the top bleed needs the first t rows: hold rows until there are t of them (or the trim ends)
        head.push(...lines.map((r) => r.slice()));
        if (head.length >= t || seen === H) {
          emit(Array.from({ length: t }, (_, j) => head![Math.min(head!.length - 1, t - 1 - j)]));
          emit(head);
          head = null;
        }
      } else emit(lines);
      for (let j = Math.max(0, n - b); j < n; j++) tail.push(lines[j].slice());
      if (tail.length > b) tail = tail.slice(tail.length - b);
      if (seen === H && b) emit(Array.from({ length: b }, (_, j) => tail[Math.max(0, tail.length - 1 - j)]));
      return ps.some((p) => p instanceof Promise) ? Promise.all(ps).then(() => undefined) : undefined;
    },
  };
}

/** A sink into one canvas of the file's size. */
export function canvasSink(x: Ctx): RowSink {
  return { rows(d, y0, n) { x.putImageData(new ImageData(d as unknown as Uint8ClampedArray<ArrayBuffer>, d.length / 4 / n, n), 0, y0); } };
}

/**
 * Draw a spec's export in horizontal strips of at most `rows` trim rows, each strip's trim rows handed to `sink` in
 * order. Pixel for pixel what renderSingle draws on the trim (tested at 3x): the finish guard's rounds run over the
 * strips (its readings summed strip by strip), then the strips are drawn once more with what it put back.
 * Returns how many strips were drawn in all and how many text items the guard put back.
 */
export async function renderStrips(spec: Spec, sc: Scene, D: ExportDims, rows: number, sink: RowSink, M = BAND, progress?: Progress): Promise<{ strips: number; drawn: number; restored: number }> {
  if (rows % BAND || M % BAND) throw new Error('strips sit on band lines');
  const W = D.trimW, H = D.trimH, rep: FinishReport = { paint: 0, effect: 0, text: 0, guard: 0, restored: 0 };
  const bands: [number, number][] = [];
  for (let y = 0; y < H; y += rows) bands.push([y, Math.min(H, y + rows)]);
  let drawn = 0;
  const draw = (y0: number, y1: number, restores: TextItem[]) => {
    const top = Math.max(0, y0 - M), bot = Math.min(H, y1 + M), c = newCanvas(W, bot - top);
    setView(c, exportView(sc.w, sc.h, W, H, top, BAND));
    const x = ctxOf(c);
    if (!x) throw new Error('no strip canvas');
    let clean = finishBody(x, sc, spec, null, rep);
    if (restores.length) { clean ??= cleanOf(x, sc, null); restoreItems(x, clean, restores); }
    drawn++;
    return { x, c, clean, top };
  };
  const restores: TextItem[] = [];
  if (spec.finish !== 'clean') {
    const texts = sc.items.filter((i): i is TextItem => i.kind === 'text'), done = new Set<TextItem>();
    const v: View = exportView(sc.w, sc.h, W, H);
    // the rows each item is read in (its grid, as cellSums lays it), export px
    const span = (it: TextItem): [number, number] => { const B = bounds(it.quad), rd = Math.ceil(RING * v.sx) + 2; return [Math.floor(B.y * v.sy) - rd, Math.ceil((B.y + B.h) * v.sy) + rd]; };
    for (let round = 0; round < GUARD_ROUNDS; round++) {
      const need = texts.filter((it) => !done.has(it));
      if (!need.length) break;
      const fin = new Map<TextItem, Sums | null>(), cl = new Map<TextItem, Sums | null>();
      for (const [y0, y1] of bands) {
        const here = need.filter((it) => { const [a, b] = span(it); return a < y1 && b > y0; });
        if (!here.length) continue;
        const s = draw(y0, y1, restores), clean = s.clean ?? cleanOf(s.x, sc, null), mask = surfaceLike(s.x);
        for (const it of here) {
          fin.set(it, cellSums(s.x, mask, it, RING, fin.get(it) ?? null, y0 - s.top, y1 - s.top));
          cl.set(it, cellSums(clean, mask, it, RING, cl.get(it) ?? null, y0 - s.top, y1 - s.top));
        }
        free(s.c); free(clean.canvas as AnyCanvas); free(mask.canvas as AnyCanvas);
      }
      const bad = need.filter((it) => {
        const m = readingOf(fin.get(it) ?? null);
        if (!readsLow(m)) return false;
        if (!tooLow(readingOf(cl.get(it) ?? null), m)) { done.add(it); return false; }
        return true;
      });
      if (!bad.length) break;
      restores.push(...bad);
      for (const it of bad) done.add(it);
    }
  }
  for (const [k, [y0, y1]] of bands.entries()) {
    const s = draw(y0, y1, restores);
    const d = s.x.getImageData(0, y0 - s.top, W, y1 - y0).data;
    free(s.c); if (s.clean) free(s.clean.canvas as AnyCanvas);
    await sink.rows(d, y0, y1 - y0);
    // a task boundary, so the sheet can paint the count
    if (progress) { progress(k + 1, bands.length); await new Promise((r) => setTimeout(r, 0)); }
  }
  return { strips: bands.length, drawn, restored: restores.length };
}

async function blobOf(c: AnyCanvas, k: FileKind, dpi: number | null, lim: Limits = {}): Promise<Blob> {
  const type = MIME[k];
  if (lim.failEncodeAbove != null && c.width * c.height > lim.failEncodeAbove) throw new Error('encode failed');
  const b = 'convertToBlob' in c ? await c.convertToBlob({ type, quality: QUALITY }) : await new Promise<Blob | null>((r) => (c as HTMLCanvasElement).toBlob(r, type, QUALITY));
  if (!b || b.size === 0) throw new Error('encode failed');
  // a browser that cannot write the type gives PNG: never a file of another type under this name
  if (b.type && b.type !== type) throw new ExportError(`This browser cannot write ${KIND_LABEL[k]}`, null);
  // sRGB on every PNG, and Print's density on PNG and JPEG; WebP carries neither (the sheet says so at Print)
  return k === 'png' ? tagPng(b, dpi) : k === 'jpeg' && dpi ? tagJpeg(b, dpi) : b;
}

/** An export this phone cannot make (spec 10.1: never a silent smaller file). `largest`: the largest size that works, if any. */
export class ExportError extends Error {
  constructor(msg: string, public largest: Size | null) { super(msg); }
}

export interface Made { blob: Blob; w: number; h: number; how: 'single' | 'strips' | 'strips-png'; ms: number; strips: number; }

/**
 * One export file: format, size, bleed and file type of spec 10.1. One canvas where it can be made and drawn;
 * otherwise strips joined into one canvas (any file type) or, where no canvas of the size can be made, a PNG written
 * strip by strip. `force`: 'strips' or 'strips-png' to take that path (the tools). Throws ExportError when none works.
 */
export async function makeExport(spec: Spec, use: Use, size: Size, bleed: boolean, k: FileKind, lim: Limits = {}, force?: 'strips' | 'strips-png', progress?: Progress): Promise<Made> {
  if (force) return makeOne(spec, use, size, bleed, k, lim, force, progress);
  try { return await makeOne(spec, use, size, bleed, k, lim, undefined, progress); }
  catch (e) {
    // any failure on the way is the honest failure: said, and the size not offered again this session
    failed.add(failKey(spec.format, size, bleed, k));
    const at = SIZE_LIST.indexOf(size), ok = workingSizes(spec.format, k, sizesOf(spec.format), bleed, lim).filter((z) => SIZE_LIST.indexOf(z) < at);
    const msg = e instanceof ExportError ? e.message : `This phone cannot make ${SIZE_LABEL[size]} ${KIND_LABEL[k]} for ${spec.format}`;
    throw new ExportError(msg, ok[ok.length - 1] ?? null);
  }
}
/** Strips drawn of all the final pass draws, as it goes (the sheet's `Making… 4 of 10`, review R16 M9). */
export type Progress = (done: number, of: number) => void;

async function makeOne(spec: Spec, use: Use, size: Size, bleed: boolean, k: FileKind, lim: Limits, force?: 'strips' | 'strips-png', progress?: Progress): Promise<Made> {
  const t0 = performance.now(), D = exportDims(spec.format, size, bleed), sc = sceneOf(spec, browserMeasure(), use);
  const dpi = size === 'print' ? PRINT_DPI : null;
  const done = (blob: Blob, how: Made['how'], strips = 1): Made => ({ blob, w: D.w, h: D.h, how, ms: performance.now() - t0, strips });
  const whole = canMake(D.w, D.h, lim);
  if (!force && whole && canMake(D.trimW, D.trimH, lim)) {
    const c = newCanvas(D.w, D.h);
    try { renderSingle(c, spec, sc, D); return done(await blobOf(c, k, dpi, lim), 'single'); }
    catch (e) { if (e instanceof ExportError) throw e; /* out of memory on the way: strips */ } finally { free(c); }
  }
  const rows = STRIP_BANDS * BAND;
  if (!canMake(D.trimW, rows + 2 * BAND, lim)) throw new ExportError(`This phone cannot make ${SIZE_LABEL[size]} for ${spec.format}`, null);
  if (force !== 'strips-png' && whole) {
    const c = newCanvas(D.w, D.h), x = ctxOf(c);
    try {
      if (!x) throw new Error('no canvas');
      const r = await renderStrips(spec, sc, D, rows, bleedSink(canvasSink(x), D), BAND, progress);
      return done(await blobOf(c, k, dpi, lim), 'strips', r.strips);
    } catch (e) { if (e instanceof ExportError || force) throw e; } finally { free(c); }
  }
  if (k !== 'png') throw new ExportError(`This phone cannot make ${SIZE_LABEL[size]} ${KIND_LABEL[k]} for ${spec.format}; PNG may`, null);
  const png = new PngWriter(D.w, D.h, dpi);
  const r = await renderStrips(spec, sc, D, rows, bleedSink({ rows: (d, _y, n) => png.rows(d, n) }, D), BAND, progress);
  return done(await png.end(), 'strips-png', r.strips);
}

/** The sizes that work for a format and file type here, in order (the sheet greys the rest). */
export function workingSizes(f: Format, k: FileKind, sizes: Size[], bleed: boolean, lim: Limits = {}, now = true): Size[] {
  return sizes.filter((s) => {
    if (hasFailed(f, s, bleed, k)) return false;
    const D = exportDims(f, s, bleed && s === 'print');
    if (canMake(D.w, D.h, lim, now)) return true;
    // no canvas of the size: only a PNG can be written strip by strip
    return k === 'png' && canMake(D.trimW, (STRIP_BANDS + 2) * BAND, lim, now);
  });
}

/**
 * The photo's pixels against what the size wants (spec 8.9 Print): the photo's size, and the size it is drawn at in
 * the export (its cover rect at the export's scale). Null when the design draws no photo.
 */
export function photoNeed(spec: Spec, use: Use, size: Size): { has: [number, number]; wants: [number, number] } | null {
  const sc = sceneOf(spec, browserMeasure(), use);
  const g = sc.items.find((i): i is GraphicItem => i.kind === 'graphic' && i.name === 'photo');
  const p = g && photoOf(String(g.params.id));
  if (!g || !p) return null;
  const D = exportDims(spec.format, size), [W, H] = FORMATS[spec.format], P = g.params as Record<string, number>;
  return { has: [p.w, p.h], wants: [Math.round((P.w * D.trimW) / W), Math.round((P.h * D.trimH) / H)] };
}
/** Whether a photo has fewer pixels than the size draws it at, on either axis (review R16 S3). */
export const photoShort = (n: { has: [number, number]; wants: [number, number] }) => n.has[0] < n.wants[0] || n.has[1] < n.wants[1];
