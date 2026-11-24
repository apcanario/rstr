/** Horizon mountains as a glowing polyline (Vaporwave, spec 8.4): the box's bottom edge is the horizon. Colours: fill, line. */
import { val } from './params';
import type { Graphic } from './types';

export const mountains: Graphic = {
  name: 'mountains',
  params: {
    peaks: { min: 3, max: 16, def: 7, int: true },
    height: { min: 0.25, max: 1, def: 0.6 },        // tallest peak, share of the box height
    rough: { min: 0, max: 1, def: 0.5 },            // how much the peaks vary
    ridges: { min: 0, max: 6, def: 3, int: true },  // wire lines down each face
  },
  draw(ctx, g, r, T) {
    const G = mountains, R = g.box, C = g.colours, W = Number(g.params.W) || R.w;
    const n = val(g, G, 'peaks'), hi = val(g, G, 'height') * R.h * T.rev(0), rough = val(g, G, 'rough'), rid = val(g, G, 'ridges');
    const base = R.y + R.h, pts: [number, number][] = [[R.x - 2, base]];
    for (let i = 0; i <= n * 2; i++) {
      const x = R.x + (R.w * i) / (n * 2), peak = i % 2 === 1;
      const h = peak ? hi * (1 - rough * r() * 0.8) : hi * (0.1 + 0.25 * r() * rough);
      pts.push([x, base - h]);
    }
    pts.push([R.x + R.w + 2, base]);
    ctx.fillStyle = C.fill; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(2, W * 0.003); ctx.shadowColor = C.line; ctx.shadowBlur = W * 0.01;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    // wire ridges from each peak down to the base
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [px, py] = pts[i];
      for (let k = 1; k <= rid; k++) { const f = k / (rid + 1); ctx.moveTo(px, py); ctx.lineTo(px + (pts[i - 1][0] - px) * f + (pts[i + 1][0] - px) * (1 - f), base); }
    }
    ctx.stroke(); ctx.shadowBlur = 0;
  },
};
