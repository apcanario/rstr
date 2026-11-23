/** Postmodern shapes, each with a hard ink shadow; the shape graphic draws one of them where its item places it. */
import type { Rng } from '../rng';
import { pick } from '../rng';
import { TAU } from './clock';
import { val } from './params';
import type { Ctx, Graphic } from './types';
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

/** One placed shape: g.xf places it, params carry its choices. Drawn twice: shadow in ink, then itself. Defaults are the spike's look. */
export const shape: Graphic = {
  name: 'shape',
  params: {
    scale: { min: 0.5, max: 1.6, def: 1 },     // x the size layout gave it
    shadow: { min: 0, max: 2.5, def: 1 },      // x the shadow offset
    spin: { min: -0.6, max: 0.6, def: 0 },     // extra turn, radians
  },
  draw(ctx, g, _r, T) {
    const G = shape, P = g.colours as unknown as Pal, s = Number(g.params.s) * val(g, G, 'scale'), d = Number(g.params.d) * val(g, G, 'shadow'), k = Number(g.params.k);
    const def = SHAPES[String(g.params.shape)];
    const e = T.rev(k * 0.25);
    if (e <= 0.01) return;
    ctx.save();
    if (T.on) { ctx.translate(0, s * 0.03 * Math.cos(TAU * T.ph + k * 1.7)); ctx.rotate(0.07 * Math.sin(TAU * T.ph + k)); }
    const spin = val(g, G, 'spin');
    if (spin) ctx.rotate(spin);
    ctx.scale(e, e);
    ctx.save(); ctx.translate(d, d); def.draw(ctx, s, g.params, P, P.ink); ctx.restore();
    def.draw(ctx, s, g.params, P, null);
    ctx.restore();
  },
};
