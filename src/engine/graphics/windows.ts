/** A floating stack of empty windows (Vaporwave, spec 8.4): title bar, three squares, a hard shadow. Colours: window, bar, ink, shadow. */
import { val } from './params';
import type { Graphic } from './types';

export const windows: Graphic = {
  name: 'windows',
  params: {
    count: { min: 1, max: 6, def: 3, int: true },
    size: { min: 0.22, max: 0.7, def: 0.42 },       // window width, share of the box width
    step: { min: 0.02, max: 0.16, def: 0.06 },      // offset from one window to the next, share of the box width
    aspect: { min: 0.4, max: 1.1, def: 0.65 },      // height over width
  },
  draw(ctx, g, r, T) {
    const G = windows, R = g.box, C = g.colours, W = Number(g.params.W) || R.w;
    const n = val(g, G, 'count'), w = R.w * val(g, G, 'size'), st = R.w * val(g, G, 'step'), h = w * val(g, G, 'aspect');
    const bar = Math.max(W * 0.03, h * 0.12), lw = Math.max(2, W * 0.003), sh = W * 0.012;
    // the stack starts somewhere in the box and steps down and to one side
    const dir = r() < 0.5 ? 1 : -1;
    let x = R.x + (R.w - w - st * (n - 1)) * r() + (dir < 0 ? st * (n - 1) : 0), y = R.y + Math.max(0, R.h - h - st * (n - 1)) * r();
    for (let i = 0; i < n; i++) {
      const e = T.rev(i * 0.3), yy = y + (1 - e) * W * 0.05;
      ctx.globalAlpha = e;
      ctx.fillStyle = C.shadow; ctx.fillRect(x + sh, yy + sh, w, h);
      ctx.fillStyle = C.window; ctx.fillRect(x, yy, w, h);
      ctx.fillStyle = C.bar; ctx.fillRect(x, yy, w, bar);
      ctx.fillStyle = C.window;
      for (let k = 0; k < 3; k++) ctx.fillRect(x + w - (k + 1) * bar * 0.62 - bar * 0.2, yy + bar * 0.28, bar * 0.42, bar * 0.42);
      ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.strokeRect(x, yy, w, h);
      x += st * dir; y += st;
    }
    ctx.globalAlpha = 1;
  },
};
