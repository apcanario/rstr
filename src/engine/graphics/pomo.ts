/** Postmodern graphics: the ground pattern and the shapes, each with a hard ink shadow. */
import type { Rng } from '../rng';
import { pick } from '../rng';
import { TAU } from './clock';
import type { Ctx, Draw } from './types';

export const pattern: Draw = (ctx, g, r) => {
  const C = g.colours, W = g.box.w, H = g.box.h, gp = Number(g.params.kind), st = W / 18;
  ctx.globalAlpha = 0.16; ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1, W * 0.0016);
  if (gp === 0) {
    for (let y = st / 2; y < H; y += st) for (let x = st / 2; x < W; x += st) { ctx.beginPath(); ctx.arc(x, y, W * 0.0045, 0, TAU); ctx.fill(); }
  } else if (gp === 1) {
    ctx.beginPath();
    for (let x = st; x < W; x += st) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = st; y < H; y += st) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  } else {
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * H, a = r() * TAU;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-W * 0.012, -W * 0.003, W * 0.024, W * 0.006); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
};
/** How many draws the pattern takes from the graphic stream (after the kind draw). */
export const patternDraws = (kind: number) => (kind === 2 ? 270 : 0);

type Pal = { ink: string; ground: string; accent: string; accent2: string; accent3: string };
type Params = Record<string, number | string | boolean>;
/** Each shape: choose(r) takes its random choices at layout time; draw(ctx, s, params, over) paints it, over = shadow colour. */
export const SHAPES: Record<string, { choose: (r: Rng, P: Pal) => Params; draw: (ctx: Ctx, s: number, p: Params, P: Pal, over: string | null) => void }> = {
  stripes: {
    choose: (r, P) => ({ n: 6 + Math.floor(r() * 4), c1: pick(r, ['accent', 'accent2', 'accent3']), c2: pick(r, ['ink', 'ground']) }),
    draw(ctx, s, p, P, ov) {
      if (ov) { ctx.fillStyle = ov; ctx.fillRect(-s / 2, -s * 0.36, s, s * 0.72); return; }
      const n = Number(p.n);
      for (let i = 0; i < n; i++) { ctx.fillStyle = (P as any)[String(i % 2 ? p.c2 : p.c1)]; ctx.fillRect(-s / 2, -s * 0.36 + i * s * 0.72 / n, s, s * 0.72 / n + 1); }
    },
  },
  half: {
    choose: (r) => ({ c: pick(r, ['accent', 'accent2', 'accent3']) }),
    draw(ctx, s, p, P, ov) { ctx.fillStyle = ov || (P as any)[String(p.c)]; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, Math.PI, 0); ctx.closePath(); ctx.fill(); },
  },
  tri: {
    choose: (r) => ({ c: pick(r, ['accent', 'accent2', 'accent3']) }),
    draw(ctx, s, p, P, ov) { ctx.fillStyle = ov || (P as any)[String(p.c)]; ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.4); ctx.lineTo(s * 0.45, s * 0.4); ctx.lineTo(-s * 0.45, -s * 0.45); ctx.closePath(); ctx.fill(); },
  },
  squiggle: {
    choose: (r) => ({ c: pick(r, ['accent', 'accent2', 'ink']), n: 5 + Math.floor(r() * 3) }),
    draw(ctx, s, p, P, ov) {
      const n = Number(p.n);
      ctx.strokeStyle = ov || (P as any)[String(p.c)]; ctx.lineWidth = s * 0.075; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = -s * 0.5 + s * i / n, y = (i % 2 ? -1 : 1) * s * 0.12; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    },
  },
  dotsq: {
    choose: (r) => ({ c: pick(r, ['accent3', 'accent2', 'accent']) }),
    draw(ctx, s, p, P, ov) {
      const n = 6;
      ctx.fillStyle = ov || (P as any)[String(p.c)]; ctx.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8);
      if (ov) return;
      ctx.fillStyle = P.ink;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.beginPath(); ctx.arc(-s * 0.4 + s * 0.8 * (i + 0.5) / n, -s * 0.4 + s * 0.8 * (j + 0.5) / n, s * 0.022, 0, TAU); ctx.fill(); }
    },
  },
  stairs: {
    choose: (r) => ({ c: pick(r, ['accent', 'accent2', 'accent3']) }),
    draw(ctx, s, p, P, ov) {
      const n = 4;
      ctx.fillStyle = ov || (P as any)[String(p.c)]; ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.45);
      for (let i = 0; i < n; i++) { ctx.lineTo(-s * 0.45 + s * 0.9 * i / n, s * 0.45 - s * 0.9 * (i + 1) / n); ctx.lineTo(-s * 0.45 + s * 0.9 * (i + 1) / n, s * 0.45 - s * 0.9 * (i + 1) / n); }
      ctx.lineTo(s * 0.45, s * 0.45); ctx.closePath(); ctx.fill();
    },
  },
  ring: {
    choose: (r) => ({ c: pick(r, ['accent', 'accent2', 'ink']) }),
    draw(ctx, s, p, P, ov) { ctx.strokeStyle = ov || (P as any)[String(p.c)]; ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU); ctx.stroke(); },
  },
};
export const SHAPE_NAMES = Object.keys(SHAPES);

/** One placed shape: g.xf places it, params carry its choices. Drawn twice: shadow in ink, then itself. */
export const shape: Draw = (ctx, g, _r, T) => {
  const P = g.colours as unknown as Pal, s = Number(g.params.s), d = Number(g.params.d), k = Number(g.params.k);
  const def = SHAPES[String(g.params.shape)];
  const e = T.rev(k * 0.25);
  if (e <= 0.01) return;
  ctx.save();
  if (T.on) { ctx.translate(0, s * 0.03 * Math.cos(TAU * T.ph + k * 1.7)); ctx.rotate(0.07 * Math.sin(TAU * T.ph + k)); }
  ctx.scale(e, e);
  ctx.save(); ctx.translate(d, d); def.draw(ctx, s, g.params, P, P.ink); ctx.restore();
  def.draw(ctx, s, g.params, P, null);
  ctx.restore();
};
