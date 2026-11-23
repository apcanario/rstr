/** Vaporwave graphics: stars, the slit sun, the grid floor and the horizon glow. */
import { luminance } from '../colour';
import { TAU } from './clock';
import type { Draw } from './types';

export const stars: Draw = (ctx, g, r, T) => {
  const W = Number(g.params.W), hz = Number(g.params.hz);
  ctx.fillStyle = g.colours.ink;
  ctx.globalAlpha = luminance(g.colours.ground) < 0.2 ? 0.85 : 0.5;
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = r() * hz * 0.7;
    const s = W * (0.0015 + r() * 0.003) * (T.on ? 0.6 + 0.4 * Math.sin(TAU * T.ph * 2 + i) : 1);
    ctx.fillRect(x - s * 3, y - s / 2, s * 6, s); ctx.fillRect(x - s / 2, y - s * 3, s, s * 6);
  }
  ctx.globalAlpha = 1;
};
export const starDraws = 46 * 3;

export const sun: Draw = (ctx, g, _r, T) => {
  const C = g.colours, x = Number(g.params.x), sy = Number(g.params.y), R = Number(g.params.r);
  const y = sy + (1 - T.rev(0)) * R;
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
  const grad = ctx.createLinearGradient(0, y - R, 0, y + R);
  grad.addColorStop(0, C.accent3); grad.addColorStop(0.55, C.accent); grad.addColorStop(1, C.sky1);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.rect(x - R, y - R, R * 2, R * 2.5);
  for (let i = 0; i < 8; i++) {
    const yy = y - R * 0.05 + (i + (T.on ? (T.ph * 4) % 1 : 0)) * R * 0.145;
    ctx.rect(x - R, yy, R * 2, R * (0.012 + i * 0.011));
  }
  ctx.fill('evenodd');
};

export const grid: Draw = (ctx, g, _r, T) => {
  const C = g.colours, W = g.box.w, hz = g.box.y, H = g.box.y + g.box.h;
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(2, W * 0.003); ctx.shadowColor = C.line; ctx.shadowBlur = W * 0.012;
  ctx.beginPath();
  for (let i = -14; i <= 14; i++) { ctx.moveTo(W / 2 + i * W * 0.035, hz); ctx.lineTo(W / 2 + i * W * 0.42, H); }
  const off = T.on ? (T.ph * 6) % 1 : 0;
  for (let k = 0; k < 14; k++) { const z = (k + off) / 14, yy = hz + (H - hz) * Math.pow(z, 2.2); ctx.moveTo(0, yy); ctx.lineTo(W, yy); }
  ctx.stroke();
  ctx.shadowBlur = 0;
};

export const horizon: Draw = (ctx, g) => {
  const W = Number(g.params.W), hz = Number(g.params.hz);
  ctx.fillStyle = g.colours.accent; ctx.shadowColor = g.colours.accent; ctx.shadowBlur = W * 0.02;
  ctx.fillRect(0, hz - W * 0.002, W, W * 0.004); ctx.shadowBlur = 0;
};
