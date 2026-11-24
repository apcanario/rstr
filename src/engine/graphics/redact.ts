/** Redacted bars (Postmodern photocopy, found graphic): solid bars as over blacked-out lines. Colour: a. */
import { val } from './params';
import type { Graphic } from './types';

export const redact: Graphic = {
  name: 'redact',
  params: {
    count: { min: 1, max: 7, def: 3, int: true },
    height: { min: 0.018, max: 0.09, def: 0.04, log: true },   // share of the canvas width
    length: { min: 0.3, max: 1, def: 0.7 },                    // the longest, share of the box width
  },
  draw(ctx, g, r, T) {
    const G = redact, R = g.box, W = Number(g.params.W), n = val(g, G, 'count'), h = W * val(g, G, 'height'), L = R.w * val(g, G, 'length');
    ctx.fillStyle = g.colours.a;
    for (let i = 0; i < n; i++) {
      const y = R.y + i * h * 1.45;
      if (y + h > R.y + R.h) break;
      ctx.fillRect(R.x + r() * R.w * 0.08, y, L * (0.45 + r() * 0.55) * T.rev(i * 0.1), h);
    }
  },
};
