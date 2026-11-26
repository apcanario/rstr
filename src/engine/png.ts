/**
 * A PNG written row by row (R16, big renders): when no canvas of an export's size can be made, the strips go straight
 * into a file. RGB, 8 bits, each row filtered Sub, deflated by the platform's CompressionStream ('deflate' is the
 * zlib stream PNG wants). Opaque only: the poster has no transparency. No dependency.
 */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC[(c ^ p[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const u32 = (v: number) => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
function chunk(type: string, data: Uint8Array): Uint8Array[] {
  const t = new TextEncoder().encode(type);
  return [u32(data.length), t, data, u32(crc32([t, data]))];
}

/** RGBA rows of width w to filtered RGB scanlines (filter 1, Sub). Pure. */
export function scanlines(d: Uint8ClampedArray | Uint8Array, w: number, n: number): Uint8Array {
  const out = new Uint8Array(n * (1 + w * 3));
  for (let y = 0; y < n; y++) {
    let o = y * (1 + w * 3);
    out[o++] = 1;
    let pr = 0, pg = 0, pb = 0;
    for (let x = 0, i = y * w * 4; x < w; x++, i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      out[o++] = (r - pr) & 255; out[o++] = (g - pg) & 255; out[o++] = (b - pb) & 255;
      pr = r; pg = g; pb = b;
    }
  }
  return out;
}

/** 300 dpi in pixels per metre, as pHYs carries it. */
export const ppm = (dpi: number) => Math.round(dpi / 0.0254);

/**
 * The chunks every export PNG carries after IHDR: sRGB (spec 10.1: colour is sRGB; review R16 M4), and at Print its
 * density as pHYs (review R16 S1), so a print shop opens it at A3, not at 72 or 96 dpi.
 */
export function tagChunks(dpi: number | null, skip: Set<string> = new Set()): Uint8Array[] {
  const out: Uint8Array[] = [];
  if (!skip.has('sRGB') && !skip.has('iCCP')) out.push(...chunk('sRGB', new Uint8Array([0])));
  if (dpi && !skip.has('pHYs')) {
    const d = new Uint8Array(9), v = ppm(dpi);
    d.set(u32(v), 0); d.set(u32(v), 4); d[8] = 1;
    out.push(...chunk('pHYs', d));
  }
  return out;
}

/**
 * A canvas-encoded PNG with the tags of tagChunks spliced in after IHDR (none it already has). The image data is
 * not copied: the new file is the old one's slices round the new chunks.
 */
export async function tagPng(b: Blob, dpi: number | null): Promise<Blob> {
  const head = new Uint8Array(await b.slice(0, Math.min(b.size, 1 << 16)).arrayBuffer());
  const type = (o: number) => String.fromCharCode(head[o + 4], head[o + 5], head[o + 6], head[o + 7]);
  const len = (o: number) => ((head[o] << 24) | (head[o + 1] << 16) | (head[o + 2] << 8) | head[o + 3]) >>> 0;
  if (head.length < 33 || type(8) !== 'IHDR') return b;
  const have = new Set<string>();
  for (let o = 8; o + 8 <= head.length; o += 12 + len(o)) { const t = type(o); if (t === 'IDAT' || t === 'IEND') break; have.add(t); }
  const add = tagChunks(dpi, have);
  if (!add.length) return b;
  const at = 8 + 12 + len(8);
  return new Blob([b.slice(0, at), ...(add as BlobPart[]), b.slice(at)], { type: 'image/png' });
}

/**
 * A canvas-encoded JPEG at a density: its JFIF APP0 set to units 1 (dots per inch) and dpi both ways, or a JFIF
 * APP0 put in after the SOI where it has none (review R16 S1).
 */
export async function tagJpeg(b: Blob, dpi: number): Promise<Blob> {
  const h = new Uint8Array(await b.slice(0, 18).arrayBuffer());
  if (h[0] !== 0xff || h[1] !== 0xd8) return b;
  const dens = [1, (dpi >> 8) & 255, dpi & 255, (dpi >> 8) & 255, dpi & 255];
  if (h[2] === 0xff && h[3] === 0xe0 && String.fromCharCode(...h.subarray(6, 11)) === 'JFIF\0') {
    const top = h.slice(0, 18);
    top.set(dens, 13);
    return new Blob([top, b.slice(18)], { type: 'image/jpeg' });
  }
  const app0 = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, ...dens, 0, 0]);
  return new Blob([b.slice(0, 2), app0, b.slice(2)], { type: 'image/jpeg' });
}

export class PngWriter {
  private w: Writable;
  private out: Promise<Uint8Array[]>;
  private seen = 0;
  /** `dpi`: the density pHYs records (Print), or null for none. */
  constructor(private width: number, private height: number, private dpi: number | null = null) {
    const cs = new CompressionStream('deflate');
    this.w = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    this.out = (async () => {
      const parts: Uint8Array[] = [];
      for (;;) { const r = await reader.read(); if (r.done) break; parts.push(r.value); }
      return parts;
    })();
  }
  /** The next n rows, RGBA, of the image's width. */
  async rows(d: Uint8ClampedArray, n: number): Promise<void> {
    if (d.length !== n * this.width * 4) throw new Error('png: row width');
    this.seen += n;
    await this.w.ready;
    await this.w.write(scanlines(d, this.width, n) as Uint8Array<ArrayBuffer>);
  }
  /** Close the stream and give the file. */
  async end(): Promise<Blob> {
    if (this.seen !== this.height) throw new Error(`png: ${this.seen} rows of ${this.height}`);
    await this.w.close();
    const z = await this.out;
    const ihdr = new Uint8Array(13);
    ihdr.set(u32(this.width), 0); ihdr.set(u32(this.height), 4);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const parts: Uint8Array[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...chunk('IHDR', ihdr), ...tagChunks(this.dpi)];
    // each compressed part its own IDAT (at most 4 MB each), so the compressed file is never held twice (review R16 M5)
    for (const p of z) for (let i = 0; i < p.length; i += 4 << 20) parts.push(...chunk('IDAT', p.subarray(i, Math.min(p.length, i + (4 << 20)))));
    parts.push(...chunk('IEND', new Uint8Array(0)));
    return new Blob(parts as BlobPart[], { type: 'image/png' });
  }
}
type Writable = WritableStreamDefaultWriter<BufferSource>;
