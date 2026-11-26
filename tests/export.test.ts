/** Row R16 (spec 10.1): export sizes and names, the bleed, the PNG writer, and strip invariance of the pixel passes. */
import { describe, expect, test } from 'vitest';
import { BLEED, exportDims, FORMAT_LIST, FORMATS, PRINT, sizesOf } from '../src/engine/formats';
import { glitchKernel, grainKernel, grungeKernel, vhsKernel, type Keep } from '../src/engine/finish';
import { treatPixels, treatReach } from '../src/engine/treat';
import { bleedSink, exportName } from '../src/engine/export';
import { crc32, PngWriter } from '../src/engine/png';
import { inflateSync } from 'node:zlib';

const W = 96, H = 160;
const img = (seed: number) => { const d = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < d.length; i++) d[i] = (i * 2654435761 + seed) >>> 24; return d; };
const keep: Keep = { l: 30, r: 30, t: 30, b: 30, corners: [40, 40, 40, 40] };
const KERNELS: Record<string, (d: Uint8ClampedArray, y0: number) => void> = {
  grain: (d, y0) => grainKernel(d, W, H, 5, 1, y0),
  grunge: (d, y0) => grungeKernel(d, W, H, 5, 1, keep, y0),
  vhs: (d, y0) => vhsKernel(d, W, H, 5, 1.3, y0),
  glitch: (d, y0) => glitchKernel(d, W, H, 5, 1.3, { x0: 40, y0: 50, h: 30, len: 30, dir: 1 }, y0),
};

describe('pixel passes in strips (R16: a strip draws the pixels of the same rows of the whole)', () => {
  for (const [name, k] of Object.entries(KERNELS)) {
    test(name, () => {
      const whole = img(1);
      k(whole, 0);
      for (const cut of [[0, 37], [37, 100], [100, 160]]) {
        const all = img(1), part = all.slice(cut[0] * W * 4, cut[1] * W * 4);
        k(part, cut[0]);
        expect(Buffer.from(part).equals(Buffer.from(whole.subarray(cut[0] * W * 4, cut[1] * W * 4))), `${name} rows ${cut}`).toBe(true);
      }
    });
  }
});

describe('export sizes (spec 10.1)', () => {
  test('1x, 2x and 3x of every format, Print and its bleed for A only', () => {
    for (const f of FORMAT_LIST) {
      const [w, h] = FORMATS[f];
      for (const [z, k] of [['1x', 1], ['2x', 2], ['3x', 3]] as const) expect(exportDims(f, z)).toMatchObject({ w: w * k, h: h * k, trimW: w * k, trimH: h * k });
      expect(sizesOf(f).includes('print')).toBe(f === 'A');
    }
    expect(FORMATS.A).toEqual([1080, 1527]);
    expect(exportDims('A', 'print')).toMatchObject({ w: 3508, h: 4961, trimW: 3508, trimH: 4961 });
    expect(exportDims('A', 'print', true)).toMatchObject({ w: 3579, h: 5032, trimW: PRINT[0], trimH: PRINT[1], bleed: BLEED });
    expect(() => exportDims('3:4', 'print')).toThrow();
    // 3 mm at 300 dpi is 35.4 px: the spec's 3579 x 5032 splits 35 + 36
    expect(BLEED[0] + BLEED[2]).toBe(71);
    expect(BLEED[1] + BLEED[3]).toBe(71);
  });
  test('names: rstr-<seed>-<format>-<width>.<ext>', () => {
    expect(exportName('0844-7F75', '3:4', 2160, 'jpeg')).toBe('rstr-0844-7F75-3x4-2160.jpg');
    expect(exportName('0844-7F75', 'A', 3579, 'png')).toBe('rstr-0844-7F75-A-3579.png');
    expect(exportName('0844-7F75', '9:16', 1080, 'webp')).toBe('rstr-0844-7F75-9x16-1080.webp');
  });
});

describe('the bleed (mirrored edge) and the PNG writer', () => {
  const D = { trimW: 7, trimH: 9, w: 7 + 2 + 3, h: 9 + 2 + 3, bleed: [2, 2, 3, 3] as [number, number, number, number] };
  const trim = new Uint8ClampedArray(7 * 9 * 4).map((_, i) => (i * 37) & 255);
  const at = (d: Uint8ClampedArray, w: number, x: number, y: number) => [...d.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];
  test('strips of any height give the same file, every bleed pixel the trim pixel mirrored over the edge', () => {
    const run = (step: number) => {
      const out = new Uint8ClampedArray(D.w * D.h * 4);
      const sink = bleedSink({ rows: (d, y, n) => { expect(d.length).toBe(D.w * n * 4); out.set(d, y * D.w * 4); } }, D);
      for (let y = 0; y < 9; y += step) { const n = Math.min(step, 9 - y); sink.rows(trim.slice(y * 28, (y + n) * 28), y, n); }
      return out;
    };
    const a = run(9), b = run(4), c = run(1);
    expect(Buffer.from(a).equals(Buffer.from(b)) && Buffer.from(a).equals(Buffer.from(c))).toBe(true);
    const mir = (v: number, n: number) => (v < 0 ? -1 - v : v >= n ? 2 * n - 1 - v : v);
    for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) expect(at(a, D.w, x, y)).toEqual(at(trim, 7, mir(x - 2, 7), mir(y - 2, 9)));
  });
  test('the PNG writer: signature, IHDR, and its rows inflate back to the pixels', async () => {
    const w = 5, h = 4, px = new Uint8ClampedArray(w * h * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 53) & 255));
    const p = new PngWriter(w, h);
    await p.rows(px.slice(0, w * 4 * 3), 3);
    await p.rows(px.slice(w * 4 * 3), 1);
    const buf = new Uint8Array(await (await p.end()).arrayBuffer());
    expect([...buf.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const dv = new DataView(buf.buffer);
    expect([dv.getUint32(16), dv.getUint32(20), buf[24], buf[25]]).toEqual([w, h, 8, 2]);
    // gather IDAT, check every chunk's CRC
    let o = 8, z: number[] = [];
    while (o < buf.length) {
      const n = dv.getUint32(o), type = String.fromCharCode(...buf.subarray(o + 4, o + 8));
      expect(dv.getUint32(o + 8 + n)).toBe(crc32([buf.subarray(o + 4, o + 8), buf.subarray(o + 8, o + 8 + n)]));
      if (type === 'IDAT') z = z.concat([...buf.subarray(o + 8, o + 8 + n)]);
      o += 12 + n;
    }
    const raw = inflateSync(Buffer.from(z));
    expect(raw.length).toBe(h * (1 + w * 3));
    for (let y = 0; y < h; y++) {
      expect(raw[y * (1 + w * 3)]).toBe(1);
      let pr = [0, 0, 0];
      for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
        const v = (raw[y * (1 + w * 3) + 1 + x * 3 + c] + pr[c]) & 255;
        expect(v).toBe(px[(y * w + x) * 4 + c]);
        pr[c] = v;
      }
    }
  });
});

describe('a treated photo in windows (R16: a strip treats only its rows, as the same rows of the whole)', () => {
  const w = 60, h = 90, src = new Uint8ClampedArray(w * h * 4).map((_, i) => (i % 4 === 3 ? 255 : ((i * 2654435761) >>> 24)));
  const cols = ['#102030', '#f0e0d0'];
  for (const params of [{ treat: 'halftone', screen: 7, angle: 30 }, { treat: 'dither', dot: 3 }, { treat: 'threshold', level: 0.5 }, { treat: 'mono', contrast: 1.2 }]) {
    test(String(params.treat), () => {
      const whole = src.slice();
      treatPixels(whole, w, h, params, cols, 1.5);
      const { margin, align } = treatReach(params, 1.5);
      for (const [r0, r1] of [[0, 20], [20, 47], [47, 90]]) {
        let wy0 = Math.max(0, r0 - margin);
        wy0 = Math.floor(wy0 / align) * align;
        const wy1 = Math.min(h, r1 + margin), part = src.slice(wy0 * w * 4, wy1 * w * 4);
        treatPixels(part, w, wy1 - wy0, params, cols, 1.5, { ox: 0, oy: wy0, x0: 0, y0: 0, x1: w, y1: h });
        const got = part.subarray((r0 - wy0) * w * 4, (r1 - wy0) * w * 4), want = whole.subarray(r0 * w * 4, r1 * w * 4);
        expect(Buffer.from(got).equals(Buffer.from(want)), `${params.treat} rows ${r0}-${r1}`).toBe(true);
      }
    });
  }
});
