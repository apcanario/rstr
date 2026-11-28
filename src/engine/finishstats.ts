/**
 * Row R19 (spec 9.4): how much each finish changes a design against Clean, for the tools. Kept in its own file so the
 * same probe can be laid into the R7 build (commit e41f8ef) to measure the baselines, unchanged.
 *
 * Per finish, at strength 1 (the strength dials cleared), on the 1x canvas:
 * - `mean`: the mean of |brightness of the finish - brightness of Clean| over every pixel (Rec. 601 luma, 0 to 255);
 * - `outside`: the same over the pixels VHS and Glitch do not hold (outside `heldMask`, the text and its ring);
 * - `mid`, `rest`: the share of pixels whose brightness changes by more than 24 levels in the middle 60% of the page
 *   (by width and by height) and in the rest of it;
 * - `restored`: text items the guard put back; `hash`: the finished pixels (Glitch's are held to the R7 build's).
 */
import { FORMATS } from './formats';
import type { Ctx } from './graphics/types';
import { heldMask, paintFinished } from './finish';
import { paint } from './paint';
import { browserMeasure, scene as sceneOf } from './index';
import type { Use } from './layout';
import type { Finish, Spec } from './spec';

export interface FinishStat { mean: number; outside: number; mid: number; rest: number; restored: number; hash: string; }

function canvas(w: number, h: number): Ctx {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as Ctx;
}
const lumaOf = (d: Uint8ClampedArray) => {
  const y = new Float32Array(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) y[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return y;
};

export function finishStats(spec: Spec, use: Use = {}, finishes: Finish[] = ['grain', 'grunge', 'vhs', 'glitch']): { items: number; stats: Record<string, FinishStat> } {
  const [W, H] = FORMATS[spec.format];
  const base = { ...spec, finish: 'clean' as Finish, params: Object.fromEntries(Object.entries(spec.params).filter(([k]) => !k.startsWith('finish.'))) };
  const sc = sceneOf(base, browserMeasure(), use);
  const a = canvas(W, H);
  paint(a, sc, null);
  const A = lumaOf(a.getImageData(0, 0, W, H).data);
  const held = heldMask(sc, a);
  const mx0 = Math.round(W * 0.2), mx1 = Math.round(W * 0.8), my0 = Math.round(H * 0.2), my1 = Math.round(H * 0.8);
  const stats: Record<string, FinishStat> = {};
  for (const f of finishes) {
    const b = canvas(W, H), s = { ...base, finish: f };
    const rep = paintFinished(b, sceneOf(s, browserMeasure(), use), s, null);
    const raw = b.getImageData(0, 0, W, H).data, B = lumaOf(raw);
    let sum = 0, out = 0, nOut = 0, midN = 0, midC = 0, restN = 0, restC = 0;
    for (let y = 0, j = 0; y < H; y++) {
      const inY = y >= my0 && y < my1;
      for (let x = 0; x < W; x++, j++) {
        const dv = Math.abs(B[j] - A[j]);
        sum += dv;
        if (!held[j]) { out += dv; nOut++; }
        if (inY && x >= mx0 && x < mx1) { midN++; if (dv > 24) midC++; } else { restN++; if (dv > 24) restC++; }
      }
    }
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw[i]; h = Math.imul(h, 16777619); }
    stats[f] = { mean: sum / (W * H), outside: nOut ? out / nOut : 0, mid: midC / midN, rest: restC / restN, restored: rep.restored, hash: (h >>> 0).toString(16) + ':' + raw.length };
  }
  return { items: sc.items.filter((i) => i.kind === 'text').length, stats };
}
