/** Swiss graphics, ported from the spike. Each draws inside g.box. */
import { pick, shuffle } from '../rng';
import { TAU, clamp } from './clock';
import type { Draw } from './types';

export const topo: Draw = (ctx, g, r, T) => {
  const R = g.box, C = g.colours, W = Number(g.params.W);
  if (C.fill) { ctx.fillStyle = C.fill; ctx.fillRect(R.x, R.y, R.w, R.h); }
  const hills: { x: number; y: number; s: number; a: number; p: number }[] = [];
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) hills.push({ x: r(), y: r(), s: 0.16 + r() * 0.22, a: (r() < 0.25 ? -1 : 1) * (0.5 + r()), p: r() * TAU });
  const step = W / 135, nx = Math.ceil(R.w / step) + 1, ny = Math.ceil(R.h / step) + 1, asp = R.h / R.w;
  const f = new Float32Array(nx * ny);
  let lo = 1e9, hi = -1e9;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u = i / (nx - 1), v = (j / (ny - 1)) * asp;
    let z = 0;
    for (const h of hills) {
      const hx = h.x + 0.05 * Math.cos(TAU * T.ph + h.p), hy = (h.y + 0.05 * Math.sin(TAU * T.ph + h.p)) * asp;
      const d = ((u - hx) * (u - hx) + (v - hy) * (v - hy)) / (h.s * h.s);
      z += h.a * Math.exp(-d);
    }
    f[j * nx + i] = z; if (z < lo) lo = z; if (z > hi) hi = z;
  }
  const levels = 13 + Math.floor(r() * 6), every = 4;
  ctx.lineCap = 'round';
  for (let k = 1; k < levels; k++) {
    const L = lo + (hi - lo) * k / levels, index = k % every === 0;
    ctx.beginPath();
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = f[j * nx + i], b = f[j * nx + i + 1], c = f[(j + 1) * nx + i + 1], d = f[(j + 1) * nx + i];
      const m = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
      if (m === 0 || m === 15) continue;
      const x0 = R.x + i * step, y0 = R.y + j * step;
      const top = [x0 + step * (L - a) / (b - a), y0], rgt = [x0 + step, y0 + step * (L - b) / (c - b)];
      const bot = [x0 + step * (L - d) / (c - d), y0 + step], lft = [x0, y0 + step * (L - a) / (d - a)];
      const seg = (p: number[], q: number[]) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
      switch (m) {
        case 1: case 14: seg(lft, bot); break;
        case 2: case 13: seg(bot, rgt); break;
        case 3: case 12: seg(lft, rgt); break;
        case 4: case 11: seg(top, rgt); break;
        case 6: case 9: seg(top, bot); break;
        case 7: case 8: seg(lft, top); break;
        case 5: seg(lft, top); seg(bot, rgt); break;
        case 10: seg(lft, bot); seg(top, rgt); break;
      }
    }
    ctx.strokeStyle = index ? C.hi : C.line;
    ctx.lineWidth = W * (index ? 0.0046 : 0.0019);
    ctx.stroke();
  }
};

export const blocks: Draw = (ctx, g, r, T) => {
  const R = g.box, C = g.colours, mod = Number(g.params.mod);
  const cols = Math.max(2, Math.round(R.w / mod)), rows = Math.max(2, Math.round(R.h / mod));
  const cw = R.w / cols, rh = R.h / rows;
  const vc = 1 + Math.floor(r() * (cols - 1)), hr = 1 + Math.floor(r() * (rows - 1)), side = r() < 0.5;
  const cells = side
    ? [[0, 0, vc, rows], [vc, 0, cols - vc, hr], [vc, hr, cols - vc, rows - hr]]
    : [[0, 0, vc, hr], [0, hr, vc, rows - hr], [vc, 0, cols - vc, rows]];
  const fills = shuffle(r, [C.accent, C.ink, C.accent2 === C.ink ? null : C.accent2, null] as (string | null)[]);
  if (!fills[0] && !fills[1]) fills[0] = C.accent;
  cells.forEach((c, i) => {
    const e = T.rev(i * 0.6), x = R.x + c[0] * cw, y = R.y + c[1] * rh, w = c[2] * cw, h = c[3] * rh;
    const fill = fills[i];
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y + h * (1 - e), w, h * e); }
  });
  const big = cells.slice().sort((p, q) => q[2] * q[3] - p[2] * p[3])[0], bi = cells.indexOf(big);
  const cx = R.x + (big[0] + big[2] / 2) * cw, cy = R.y + (big[1] + big[3] / 2) * rh;
  const rad = Math.min(big[2] * cw, big[3] * rh) * (0.3 + 0.04 * Math.sin(TAU * T.ph)) * T.rev(2);
  ctx.fillStyle = fills[bi] === C.accent ? C.ground : fills[bi] ? C.accent : C.ink;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
};

export const bars: Draw = (ctx, g, r, T) => {
  const R = g.box, C = g.colours;
  const ang = pick(r, [-45, -30, 30, 45, 60]) * Math.PI / 180 + (T.on ? 0.03 * Math.sin(TAU * T.ph) : 0);
  const n = 7 + Math.floor(r() * 4), span = Math.hypot(R.w, R.h), unit = span / (n * (n + 1));
  ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.rotate(ang);
  let x = -span / 2; const grow = r() < 0.5;
  for (let i = 0; i < n; i++) {
    const k = grow ? i + 1 : n - i, w = unit * k, e = T.rev(i * 0.35);
    ctx.fillStyle = i % 4 === 3 ? C.ink : C.accent;
    ctx.fillRect(x, -span, w, span * 2 * e);
    x += w + unit * (n + 1 - k);
  }
  ctx.restore();
};

export const dots: Draw = (ctx, g, r, T) => {
  const R = g.box, C = g.colours, mod = Number(g.params.mod);
  const step = mod / 3, fx0 = r(), fy0 = r(), inv = r() < 0.4;
  const fx = R.x + R.w * (fx0 + 0.12 * Math.cos(TAU * T.ph)), fy = R.y + R.h * (fy0 + 0.12 * Math.sin(TAU * T.ph));
  const maxd = Math.hypot(R.w, R.h) * 0.75, e = T.rev(0);
  ctx.fillStyle = C.accent;
  for (let y = R.y + step / 2; y < R.y + R.h; y += step) for (let x = R.x + step / 2; x < R.x + R.w; x += step) {
    let k = clamp(1 - Math.hypot(x - fx, y - fy) / maxd, 0, 1); if (inv) k = 1 - k;
    const rad = step * 0.5 * Math.pow(k, 1.6) * e;
    if (rad > 0.6) { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); }
  }
};

export const disc: Draw = (ctx, g, r, T) => {
  const R = g.box, C = g.colours;
  const m = Math.min(R.w, R.h), cx = R.x + R.w * (0.25 + r() * 0.5), cy = R.y + R.h * (0.3 + r() * 0.5);
  const rad = m * (0.42 + r() * 0.3) * T.rev(0);
  ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(cx + m * 0.02 * Math.cos(TAU * T.ph), cy, rad, 0, TAU); ctx.fill();
  const a2 = r() * TAU + TAU * T.ph * (T.on ? 1 : 0), r2 = m * (0.07 + r() * 0.07) * T.rev(1.5);
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * rad * 0.98, cy + Math.sin(a2) * rad * 0.98, r2, 0, TAU); ctx.fill();
};

