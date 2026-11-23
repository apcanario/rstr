/** An accent slab with an ink disc (Brutalist). Colours: accent, ink. Defaults are the spike's look. */
import { TAU } from './clock';
import { val } from './params';
import type { Graphic } from './types';

export const slab: Graphic = {
  name: 'slab',
  params: {
    fill: { min: 0.3, max: 1, def: 1 },     // slab length, share of the box
    disc: { min: 0, max: 0.95, def: 0.8 },  // disc diameter, share of the box height (0: none)
    at: { min: 0, max: 1, def: 1 },         // disc from left (0) to right (1)
  },
  draw(ctx, g, _r, T) {
    const G = slab, { x, y, w: iw, h } = g.box;
    ctx.fillStyle = g.colours.accent; ctx.fillRect(x, y, iw * val(g, G, 'fill') * T.rev(2), h);
    const d = Math.min(h * val(g, G, 'disc'), iw * 0.3);
    if (d < 1) return;
    ctx.fillStyle = g.colours.ink;
    ctx.beginPath(); ctx.arc(x + d * 0.75 + (iw - 1.5 * d) * val(g, G, 'at'), y + h / 2, d / 2, 0, TAU); ctx.fill();
  },
};
