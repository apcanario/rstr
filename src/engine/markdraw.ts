/**
 * Drawing the marks of spec 7.2 (docs/design/elements.md). Sizes are at 1080 wide, as the Scene is. Each mark draws
 * inside its box (paint clips to it) in its two colours, from its own seeded stream.
 */
import { LABEL_PX, LABEL_TRACK, MARK_FONT } from './marks';
import type { Rng } from './rng';
import { fontCss, type GraphicItem } from './scene';
import type { Ctx } from './graphics/types';

function label(ctx: Ctx, s: string, x: number, y: number, colour: string) {
  ctx.font = fontCss(MARK_FONT, LABEL_PX);
  (ctx as any).letterSpacing = LABEL_TRACK + 'px';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = colour;
  ctx.fillText(s, x, y);
  (ctx as any).letterSpacing = '0px';
}

export function drawMark(ctx: Ctx, g: GraphicItem, r: Rng): void {
  const { x, y, w, h } = g.box, c = g.colours.c, c2 = g.colours.c2, p = g.params;
  switch (p.kind) {
    case 'grid': {
      // fine grid: 54 px squares, 1 px lines at 5% of ink, a little stronger on the outer edge
      const cell = Number(p.cell) || 54;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      for (let gx = x + 0.5; gx <= x + w; gx += cell) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
      for (let gy = y + 0.5; gy <= y + h; gy += cell) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
      ctx.stroke();
      ctx.globalAlpha = 1;
      // one cell filled, a grid's own reference point
      const i = Math.floor(r() * Math.floor(w / cell)), j = Math.floor(r() * Math.floor(h / cell));
      ctx.fillStyle = c2;
      ctx.fillRect(x + i * cell + 1, y + j * cell + 1, cell - 1, cell - 1);
      return;
    }
    case 'slashes': {
      // parallelograms at 60 degrees running in from the edge: medium (44, partly off the canvas), big (64),
      // a thin companion (5) in the second colour, a hairline (1.5)
      const run = h / Math.tan(Math.PI / 3), right = p.from === 'right';
      const bars: [number, number, string][] = [[44, -22, c], [64, 14, c], [5, 14, c2], [1.5, 14, c]];
      let at = 0;
      for (const [bw, gap, col] of bars) {
        at += gap;
        const x0 = right ? x + w - at - bw : x + at;
        ctx.fillStyle = col;
        ctx.beginPath();
        if (right) { ctx.moveTo(x0, y + h); ctx.lineTo(x0 + bw, y + h); ctx.lineTo(x0 + bw - run, y); ctx.lineTo(x0 - run, y); }
        else { ctx.moveTo(x0 + run, y); ctx.lineTo(x0 + run + bw, y); ctx.lineTo(x0 + bw, y + h); ctx.lineTo(x0, y + h); }
        ctx.closePath();
        ctx.fill();
        at += bw;
      }
      return;
    }
    case 'bar': {
      ctx.fillStyle = Number(p.tone) ? c2 : c;
      ctx.fillRect(x, y, w, h);
      return;
    }
    case 'ruler': {
      // 1 px ticks every 8 px, every fifth one longer, along a free edge
      const step = Number(p.step) || 8, vert = !!p.vertical;
      ctx.fillStyle = c;
      const n = Math.floor((vert ? h : w) / step);
      for (let i = 0; i <= n; i++) {
        const long = i % 5 === 0, len = long ? 22 : 10;
        if (vert) ctx.fillRect(x, y + i * step, len, 1);
        else ctx.fillRect(x + i * step, y + h - len, 1, len);
      }
      if (vert) ctx.fillRect(x, y, 1, n * step + 1); else ctx.fillRect(x, y + h - 1, n * step + 1, 1);
      return;
    }
    case 'crosshair': {
      // r 24 circle, four arms from 12 to 36, r 4 dot in the second colour, two readouts beside it
      const cx = x + 38, cy = y + 38;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(cx + dx * 12, cy + dy * 12); ctx.lineTo(cx + dx * 36, cy + dy * 36); }
      ctx.stroke();
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      // a crosshair with no room for its readouts on one surface comes without them (review bundle 3 M2)
      if (typeof p.label === 'string') label(ctx, p.label, x + 88, y + 32, c);
      if (typeof p.label2 === 'string') label(ctx, p.label2, x + 88, y + 56, c);
      return;
    }
    case 'barcode': {
      // bars of varied width with the seed under them, or (beside: the strip's width) beside them
      ctx.fillStyle = c;
      const side = Number(p.beside) || 0, end = side ? x + side : x + w;
      let bx = x;
      while (bx < end) {
        const bw = 1 + Math.floor(r() * 4) * 2;
        ctx.fillRect(bx, y, Math.min(bw, end - bx), side ? h : 38);
        bx += bw + 2 + Math.floor(r() * 3) * 2;
      }
      if (side) label(ctx, String(p.label ?? ''), x + side + 12, y + h - 5, c);
      else label(ctx, String(p.label ?? ''), x, y + h - 3, c);
      return;
    }
    case 'status': {
      // segmented cells, some filled, and a short readout
      const n = Number(p.cells) || 8, on = Number(p.on) || 1;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < n; i++) {
        const cx = x + i * 18 + 0.75;
        if (i < on) { ctx.fillStyle = i === on - 1 ? c2 : c; ctx.fillRect(cx, y + 0.75, 14, h - 1.5); }
        else { ctx.strokeStyle = c; ctx.strokeRect(cx, y + 0.75, 14, h - 1.5); }
      }
      label(ctx, String(p.label ?? ''), x + n * 18 + 12, y + h - 5, c);
      return;
    }
    case 'label': {
      label(ctx, String(p.label ?? ''), x + 1, y + 15, c);
      return;
    }
    case 'dots': {
      // a small block of dots, some lit
      const cols = Number(p.cols) || 6, rows = Number(p.rows) || 4;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const lit = r() < 0.35;
        ctx.globalAlpha = lit ? 1 : 0.3;
        ctx.fillStyle = lit ? c2 : c;
        ctx.beginPath();
        ctx.arc(x + 6 + i * 12, y + 6 + j * 12, lit ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    case 'card': {
      // a panel with a 45 degree chamfer of 28 px on two opposite corners, 1.5 px border, a 6 px accent bar on
      // the left split in two colours: the home of the info slot (it keeps off the info ink: paint cuts it out)
      const k = Number(p.chamfer) || 28, i = 0.75;
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + i, y + i);
      ctx.lineTo(x + w - k, y + i);
      ctx.lineTo(x + w - i, y + k);
      ctx.lineTo(x + w - i, y + h - i);
      ctx.lineTo(x + k, y + h - i);
      ctx.lineTo(x + i, y + h - k);
      ctx.closePath();
      ctx.stroke();
      const bh = (h - k - 12) / 2;
      ctx.fillStyle = c2;
      ctx.fillRect(x + 6, y + 6, 6, bh);
      ctx.fillStyle = c;
      ctx.fillRect(x + 6, y + 6 + bh, 6, bh);
      return;
    }
  }
}
