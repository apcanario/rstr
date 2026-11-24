/** The faint ground pattern (Postmodern): dots, grid, confetti, ruled lines or hatching (kinds 0 to 4). Colour: ink, at low alpha. Defaults are the spike's look. */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const pattern: Graphic = {
  name: 'pattern',
  params: {
    pitch: { min: 1 / 40, max: 1 / 8, def: 1 / 18, log: true },   // share of the width
    alpha: { min: 0.06, max: 0.3, def: 0.16 },
    count: { min: 20, max: 200, def: 90, int: true },               // confetti pieces
  },
  draw(ctx, g, r, _T) {
    const G = pattern, C = g.colours, W = g.box.w, H = g.box.h, gp = Number(g.params.kind), st = W * val(g, G, 'pitch');
    ctx.globalAlpha = val(g, G, 'alpha'); ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1, W * 0.0016);
    if (gp === 0) {
      for (let y = st / 2; y < H; y += st) for (let x = st / 2; x < W; x += st) { ctx.beginPath(); ctx.arc(x, y, W * 0.0045, 0, TAU); ctx.fill(); }
    } else if (gp === 1) {
      ctx.beginPath();
      for (let x = st; x < W; x += st) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = st; y < H; y += st) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (gp === 3) {
      ctx.beginPath();
      for (let y = st; y < H; y += st * 0.6) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (gp === 4) {
      ctx.beginPath();
      for (let x = -H; x < W; x += st * 0.7) { ctx.moveTo(x, H); ctx.lineTo(x + H, 0); }
      ctx.stroke();
    } else {
      const n = val(g, G, 'count');
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = r() * H, a = r() * TAU;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-W * 0.012, -W * 0.003, W * 0.024, W * 0.006); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },
};
/** How many draws the pattern takes from the graphic stream (after the kind draw), for a confetti count. */
export const patternDraws = (kind: number, count: number) => (kind === 2 ? count * 3 : 0);
/** How many kinds there are. */
export const PATTERN_KINDS = 5;
