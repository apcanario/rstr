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

export class PngWriter {
  private w: Writable;
  private out: Promise<Uint8Array[]>;
  private seen = 0;
  constructor(private width: number, private height: number) {
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
    // IDAT in chunks of at most 4 MB
    let all = 0;
    for (const p of z) all += p.length;
    const flat = new Uint8Array(all);
    let o = 0;
    for (const p of z) { flat.set(p, o); o += p.length; }
    const parts: Uint8Array[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...chunk('IHDR', ihdr)];
    for (let i = 0; i < flat.length; i += 4 << 20) parts.push(...chunk('IDAT', flat.subarray(i, Math.min(flat.length, i + (4 << 20)))));
    parts.push(...chunk('IEND', new Uint8Array(0)));
    return new Blob(parts as BlobPart[], { type: 'image/png' });
  }
}
type Writable = WritableStreamDefaultWriter<BufferSource>;
