/**
 * The copier pass (Postmodern photocopy, spec 8.2): a pass over everything drawn so far, type included, as a
 * photocopier leaves it: raised contrast, grain, dust, faint horizontal streaks and dark edges. It reads the
 * canvas's pixels and writes them back, so it ignores the item's box and draws once per render. Port of the
 * spike's `photocopy`: the ideas, not the code. Deterministic from the graphic stream.
 */
import { val } from './params';
import type { Graphic } from './types';

export const copier: Graphic = {
  name: 'copier',
  params: {
    grain: { min: 0.2, max: 1.6, def: 1 },           // noise, x the spike's
    streaks: { min: 0, max: 0.08, def: 0.03 },       // share of rows darkened as a streak
    edges: { min: 0, max: 1, def: 0.55 },            // chance of a dark edge on each side
    contrast: { min: 1, max: 1.3, def: 1.14 },
  },
  draw(ctx, g, r, _T) {
    const G = copier, cv = ctx.canvas, W = cv.width, H = cv.height;
    if (!W || !H) return;
    const amt = val(g, G, 'grain'), stk = val(g, G, 'streaks'), pe = val(g, G, 'edges'), k = val(g, G, 'contrast');
    // sizes are shares of the canvas, so a preview and an export look alike
    const u = W / 1080;
    const streak = new Float32Array(H);
    for (let y = 0; y < H; y++) streak[y] = r() < stk ? -(8 + r() * 40) : 0;
    const eL = r() < pe ? W * (0.02 + r() * 0.05) : 0, eR = r() < pe ? W * (0.02 + r() * 0.05) : 0, eT = r() < pe * 0.7 ? H * (0.01 + r() * 0.025) : 0;
    let s = ((r() * 4294967296) >>> 0) || 1;
    const im = ctx.getImageData(0, 0, W, H), d = im.data;
    const dust = 0.0014 / Math.max(0.25, u * u);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const n = (s >>> 0) / 4294967296;
      let v = (n - 0.5) * 70 * amt + streak[y];
      if (n > 1 - dust) v += 140; else if (n < dust) v -= 170;
      if (x < eL) v -= 255 * Math.pow(1 - x / eL, 1.4) * (0.5 + n);
      if (x > W - eR) v -= 255 * Math.pow(1 - (W - x) / eR, 1.4) * (0.5 + n);
      if (y < eT) v -= 255 * Math.pow(1 - y / eT, 1.4) * (0.5 + n);
      for (let c = 0; c < 3; c++) { const p = (d[i + c] - 128) * k + 128 + v; d[i + c] = p < 0 ? 0 : p > 255 ? 255 : p; }
    }
    ctx.putImageData(im, 0, 0);
  },
};
