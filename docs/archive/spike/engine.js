/* Modular identity engine — spike. One spec (JSON) -> any format, still or animated. Canvas 2D only. */
(function (g) {
  'use strict';
  const FORMATS = { '1:1': [1080, 1080], '3:4': [1080, 1440], '9:16': [1080, 1920] };
  const F = { sans: '"ID Sans"', disp: '"ID Display"', serif: '"ID Serif"', mono: '"ID Mono"', heavy: '"ID Heavy"', black: '"ID Black"', wide: '"ID Wide"', pixel: '"ID Pixel"' };
  const MOTIFS = ['topo', 'blocks', 'bars', 'dots', 'disc', 'lines'];
  const PAL = {
    swiss: [
      { name: 'Paper', bg: '#F2EFE8', ink: '#161616', a: '#E4002B', b: '#161616' },
      { name: 'Signal', bg: '#E4002B', ink: '#F7F4EE', a: '#161616', b: '#F7F4EE' },
      { name: 'Night', bg: '#111113', ink: '#EDEAE3', a: '#FF5A36', b: '#EDEAE3' },
      { name: 'Yellow', bg: '#F6C700', ink: '#141414', a: '#141414', b: '#F7F4EE' },
      { name: 'Cobalt', bg: '#F2EFE8', ink: '#161616', a: '#1B3FAB', b: '#E4002B' },
      { name: 'Pine', bg: '#0F5B46', ink: '#F2EFE8', a: '#F6C700', b: '#F2EFE8' }
    ],
    brutal: [
      { name: 'Concrete', bg: '#EDEDEA', ink: '#0A0A0A', a: '#FF3B00' },
      { name: 'Blackout', bg: '#0A0A0A', ink: '#F2F2F0', a: '#E8FF00' },
      { name: 'Hazard', bg: '#E8FF00', ink: '#0A0A0A', a: '#FF3B00' },
      { name: 'Alarm', bg: '#FF3B00', ink: '#0A0A0A', a: '#F2F2F0' },
      { name: 'Klein', bg: '#1F3BFF', ink: '#F2F2F0', a: '#E8FF00' }
    ],
    vapor: [
      { name: 'Sunset', g: ['#120458', '#7A04EB', '#FF6AD5', '#FFB86B'], floor: '#12032E', ink: '#FFFFFF', a: '#FF71CE', b: '#01CDFE', c: '#FFFB96', dark: true },
      { name: 'Night', g: ['#05010F', '#1B0B4B', '#5B1E9E', '#FF2E97'], floor: '#07020F', ink: '#FFFFFF', a: '#FF2E97', b: '#05FFA1', c: '#FFE66D', dark: true },
      { name: 'Miami', g: ['#00A6FB', '#7BDFF2', '#F7AEF8', '#FDE2A8'], floor: '#2A0A5E', ink: '#FFFFFF', a: '#FF5DA2', b: '#00F5D4', c: '#FFF275', dark: true },
      { name: 'Mint', g: ['#C9FFF2', '#D9E8FF', '#FFD6F6', '#FFF3C4'], floor: '#F6EBFF', ink: '#2B1055', a: '#FF5DA2', b: '#7A5CFF', c: '#00B8A9', dark: false }
    ],
    grunge: [
      { name: 'Paper', bg: '#E7E2D6', ink: '#0E0E0E', a: '#D7261E' },
      { name: 'Xerox', bg: '#D9D7D0', ink: '#111111', a: '#111111' },
      { name: 'Acid', bg: '#101010', ink: '#E9E6DC', a: '#D9FF2F' },
      { name: 'Ink blue', bg: '#E7E2D6', ink: '#101010', a: '#1C3FD1' },
      { name: 'Rust', bg: '#D8D0BE', ink: '#151210', a: '#C4501B' }
    ],
    pomo: [
      { name: 'Milano', bg: '#F3EAD8', ink: '#141414', a: '#FF4F9A', b: '#00A7A0', c: '#FFD23F' },
      { name: 'Arcade', bg: '#1B1B3A', ink: '#F3EAD8', a: '#FF6B35', b: '#39D0C0', c: '#F7D002' },
      { name: 'Citrus', bg: '#FFD23F', ink: '#141414', a: '#3A36DB', b: '#FF4F4F', c: '#F7F1E3' },
      { name: 'Lilac', bg: '#E8E4F0', ink: '#19161F', a: '#7B2FF7', b: '#FF7A59', c: '#19C3A6' }
    ]
  };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const TAU = Math.PI * 2;

  function font(ctx, fam, px, wt, ital) { ctx.font = (ital ? 'italic ' : '') + wt + ' ' + px + 'px ' + fam; }
  function wrap(ctx, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/)) {
        const t = line ? line + ' ' + w : w;
        if (!line || ctx.measureText(t).width <= maxW) line = t; else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out;
  }
  /* largest size at which the text fits the box: never overflows, never clips */
  function fit(ctx, text, fam, wt, maxW, maxH, start, min, lh, maxLines, ital) {
    for (let s = start; s >= min; s -= 2) {
      font(ctx, fam, s, wt, ital);
      const L = wrap(ctx, text, maxW);
      const wide = Math.max.apply(null, L.map(l => ctx.measureText(l).width));
      if (L.length <= maxLines && wide <= maxW && L.length * s * lh <= maxH) return { size: s, lines: L };
    }
    font(ctx, fam, min, wt, ital);
    return { size: min, lines: wrap(ctx, text, maxW) };
  }
  function spaced(ctx, str, x, y, tr) {
    if ('letterSpacing' in ctx) { ctx.letterSpacing = tr + 'px'; ctx.fillText(str, x, y); ctx.letterSpacing = '0px'; }
    else ctx.fillText(str, x, y);
  }
  function spacedW(ctx, str, tr) {
    if ('letterSpacing' in ctx) { ctx.letterSpacing = tr + 'px'; const w = ctx.measureText(str).width; ctx.letterSpacing = '0px'; return w; }
    return ctx.measureText(str).width;
  }

  /* ---------- time ---------- */
  function clock(t) {
    // t: null => still. Otherwise {s, dur} seconds.
    if (!t) return { on: false, ph: 0.3, rev: () => 1 };
    return { on: true, ph: t.s / t.dur, rev: (i) => ease((t.s - 0.15 - i * 0.12) / 0.7) * (1 - ease((t.s - (t.dur - 0.5)) / 0.4)) };
  }

  /* ---------- motifs: draw inside rect R, clipped ---------- */
  function topo(ctx, R, r, C, T, W) {
    const hills = [], n = 4 + Math.floor(r() * 3);
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
    const bold = pick(r, [1, 1, 1, 2.6, 5]), levels = bold > 2 ? 5 + Math.floor(r() * 4) : 13 + Math.floor(r() * 6), every = bold > 2 ? 2 : 4;
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
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
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
      ctx.lineWidth = W * (bold > 2 ? 0.0032 : (index ? 0.0046 : 0.0019)) * bold;
      ctx.stroke();
    }
  }
  function blocks(ctx, R, r, C, T, W, mod) {
    const cols = Math.max(2, Math.round(R.w / mod)), rows = Math.max(2, Math.round(R.h / mod));
    const cw = R.w / cols, rh = R.h / rows;
    const vc = 1 + Math.floor(r() * (cols - 1)), hr = 1 + Math.floor(r() * (rows - 1)), side = r() < 0.5;
    const cells = side
      ? [[0, 0, vc, rows], [vc, 0, cols - vc, hr], [vc, hr, cols - vc, rows - hr]]
      : [[0, 0, vc, hr], [0, hr, vc, rows - hr], [vc, 0, cols - vc, rows]];
    const fills = [C.a, C.ink, C.b === C.ink ? null : C.b, null].sort(() => r() - 0.5);
    if (!fills[0] && !fills[1]) fills[0] = C.a;
    cells.forEach((c, i) => {
      const e = T.rev(i * 0.6), x = R.x + c[0] * cw, y = R.y + c[1] * rh, w = c[2] * cw, h = c[3] * rh;
      if (fills[i]) { ctx.fillStyle = fills[i]; ctx.fillRect(x, y + h * (1 - e), w, h * e); }
    });
    const big = cells.slice().sort((p, q) => q[2] * q[3] - p[2] * p[3])[0], bi = cells.indexOf(big);
    const cx = R.x + (big[0] + big[2] / 2) * cw, cy = R.y + (big[1] + big[3] / 2) * rh;
    const rad = Math.min(big[2] * cw, big[3] * rh) * (0.3 + 0.04 * Math.sin(TAU * T.ph)) * T.rev(2);
    ctx.fillStyle = fills[bi] === C.a ? C.bg : (fills[bi] ? C.a : C.ink);
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
  }
  function bars(ctx, R, r, C, T, W) {
    const ang = pick(r, [-45, -30, 30, 45, 60]) * Math.PI / 180 + (T.on ? 0.03 * Math.sin(TAU * T.ph) : 0);
    const n = 7 + Math.floor(r() * 4), span = Math.hypot(R.w, R.h), unit = span / (n * (n + 1));
    ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.rotate(ang);
    let x = -span / 2; const grow = r() < 0.5;
    for (let i = 0; i < n; i++) {
      const k = grow ? i + 1 : n - i, w = unit * k, e = T.rev(i * 0.35);
      ctx.fillStyle = (i % 4 === 3) ? C.ink : C.a;
      ctx.fillRect(x, -span * e + span / 2 - span * (1 - e) * 0, w, span * 2 * e - span);
      ctx.fillRect(x, -span, w, span * 2 * e);
      x += w + unit * (n + 1 - k);
    }
    ctx.restore();
  }
  function dots(ctx, R, r, C, T, W, mod) {
    const step = mod / pick(r, [4, 3, 3, 2, 1.25, 0.85]), fx0 = r(), fy0 = r(), inv = r() < 0.4;
    const fx = R.x + R.w * (fx0 + 0.12 * Math.cos(TAU * T.ph)), fy = R.y + R.h * (fy0 + 0.12 * Math.sin(TAU * T.ph));
    const maxd = Math.hypot(R.w, R.h) * 0.75, e = T.rev(0);
    ctx.fillStyle = C.a;
    for (let y = R.y + step / 2; y < R.y + R.h; y += step) for (let x = R.x + step / 2; x < R.x + R.w; x += step) {
      let k = clamp(1 - Math.hypot(x - fx, y - fy) / maxd, 0, 1); if (inv) k = 1 - k;
      const rad = step * 0.5 * Math.pow(k, 1.6) * e;
      if (rad > 0.6) { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); }
    }
  }
  function disc(ctx, R, r, C, T, W) {
    const m = Math.min(R.w, R.h), cx = R.x + R.w * (0.25 + r() * 0.5), cy = R.y + R.h * (0.3 + r() * 0.5);
    const rad = m * (0.42 + r() * 0.3) * T.rev(0);
    ctx.fillStyle = C.a; ctx.beginPath(); ctx.arc(cx + m * 0.02 * Math.cos(TAU * T.ph), cy, rad, 0, TAU); ctx.fill();
    const a2 = r() * TAU + TAU * T.ph * (T.on ? 1 : 0), r2 = m * (0.07 + r() * 0.07) * T.rev(1.5);
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * rad * 0.98, cy + Math.sin(a2) * rad * 0.98, r2, 0, TAU); ctx.fill();
  }
  function lines(ctx, R, r, C, T, W) {
    const vert = r() < 0.5, n = 5 + Math.floor(r() * 16), grow = r() < 0.6, pitch = (vert ? R.w : R.h) / n;
    for (let i = 0; i < n; i++) {
      const k = grow ? (i + 1) / n : 1 - i / n, th = pitch * (0.06 + 0.86 * k) * T.rev(i * 0.1);
      ctx.fillStyle = (i % 5 === 4) ? C.ink : C.a;
      if (vert) ctx.fillRect(R.x + i * pitch, R.y, th, R.h); else ctx.fillRect(R.x, R.y + i * pitch, R.w, th);
    }
  }
  const MOTIF_FN = { topo, blocks, bars, dots, disc, lines };

  /* ---------- SWISS ---------- */
  function swiss(ctx, W, H, spec, T) {
    const rt = rng((spec.seeds.layout ^ 0x9E3779B9) >>> 0);
    const tilt = spec.tilt != null ? spec.tilt : (rt() < 0.34 ? pick(rt, [-14, -9, 9, 14, -90]) : 0);
    if (!tilt) return swissCore(ctx, W, H, spec, T, 0);
    if (tilt === -90) {                       // the whole layout turned a quarter, read from the side
      ctx.save(); ctx.translate(0, H); ctx.rotate(-Math.PI / 2);
      const P9 = swissCore(ctx, H, W, Object.assign({}, spec, { format: 'side' }), T, 0); ctx.restore(); return P9;
    }
    const a = tilt * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), k = Math.min(W / (W * c + H * sn), H / (W * sn + H * c));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(a); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
    const P = swissCore(ctx, W, H, spec, T, tilt); ctx.restore(); return P;
  }
  function swissCore(ctx, W, H, spec, T, tilt) {
    const rl = rng(spec.seeds.layout), rc = rng(spec.seeds.colour), rm = rng(spec.seeds.motif);
    const P = PAL.swiss[spec.palette != null ? spec.palette : Math.floor(rc() * PAL.swiss.length)];
    const story = spec.format === '9:16';
    const M = Math.round(W * 0.0667), cols = 6, mod = (W - 2 * M) / cols, G = Math.round(W * 0.028);
    const top = M + (story ? H * 0.085 : 0), bot = H - M - (story ? H * 0.1 : 0), innerH = bot - top;
    const arche = spec.layout != null ? spec.layout : Math.floor(rl() * 3);
    const axis = pick(rl, [0, 0, 1, 2]), big = pick(rl, [0.55, 1, 1, 1.5]);
    const motif = spec.motif || pick(rm, MOTIFS);
    const tx = spec.text, any = ['title', 'subtitle', 'info', 'caption'].some(k => tx[k].on);
    ctx.fillStyle = P.bg; ctx.fillRect(-W * 2, -H * 2, W * 5, H * 5);

    let MR, TR, panel = null;
    if (!any) MR = { x: 0, y: 0, w: W, h: H };
    else if (arche === 2) {
      MR = { x: 0, y: 0, w: W, h: H };
      const ph = Math.round(innerH * (story ? 0.4 : 0.5) / mod) * mod, atTop = rl() < 0.5;
      panel = { x: 0, y: atTop ? 0 : H - (ph + (H - bot) + M * 0.6), w: M + mod * 5, h: ph + (atTop ? top : H - bot) + M * 0.6 };
      TR = { x: M, y: atTop ? top : panel.y + M * 0.6, w: mod * 5 - M * 0.6, h: ph };
    } else {
      const frac = spec.format === '1:1' ? 0.47 : 0.52, mh = Math.round(innerH * frac / mod) * mod;
      const bleed = rl() < 0.5;
      if (arche === 0) {
        MR = bleed ? { x: 0, y: 0, w: W, h: top + mh } : { x: M, y: top, w: W - 2 * M, h: mh };
        TR = { x: M, y: top + mh + G * 1.4, w: W - 2 * M, h: innerH - mh - G * 1.4 };
      } else {
        MR = bleed ? { x: 0, y: bot - mh, w: W, h: H - bot + mh } : { x: M, y: bot - mh, w: W - 2 * M, h: mh };
        TR = { x: M, y: top, w: W - 2 * M, h: innerH - mh - G * 1.4 };
      }
    }
    if (tilt) for (const B of [MR, panel]) { if (!B) continue; const l = B.x <= 0, r_ = B.x + B.w >= W - 1, t_ = B.y <= 0, b_ = B.y + B.h >= H - 1;
      if (l) { B.x -= W; B.w += W; } if (r_) B.w += W; if (t_) { B.y -= H; B.h += H; } if (b_) B.h += H; }
    // motif
    const invert = motif === 'topo' ? rm() < 0.45 : false;
    ctx.save(); ctx.beginPath(); ctx.rect(MR.x, MR.y, MR.w, MR.h); ctx.clip();
    if (invert) { ctx.fillStyle = P.a; ctx.fillRect(MR.x, MR.y, MR.w, MR.h); }
    const C = motif === 'topo'
      ? (invert ? { line: P.bg, hi: P.bg } : { line: P.ink, hi: P.a })
      : { a: P.a, b: P.b, ink: P.ink, bg: P.bg };
    MOTIF_FN[motif](ctx, MR, rm, C, T, W, mod);
    if (spec.combo !== false && rm() < 0.62) {          // a second approach cut into the first
      const m2 = pick(rm, MOTIFS.filter(m => m !== motif)), shape = Math.floor(rm() * 3), plate = pick(rm, [P.a, P.ink, P.bg]);
      const vx = Math.max(MR.x, 0), vy = Math.max(MR.y, 0), vw = Math.min(MR.x + MR.w, W) - vx, vh = Math.min(MR.y + MR.h, H) - vy, mm = Math.min(vw, vh);
      let R2; ctx.save(); ctx.beginPath();
      if (shape === 0) { const r = mm * (0.24 + rm() * 0.22), cx = vx + vw * (0.25 + rm() * 0.5), cy = vy + vh * (0.3 + rm() * 0.4); ctx.arc(cx, cy, r, 0, TAU); R2 = { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }; }
      else if (shape === 1) { const c0 = Math.floor(rm() * 4), cw = 1 + Math.floor(rm() * 3); R2 = { x: M + c0 * mod, y: MR.y, w: cw * mod, h: MR.h }; ctx.rect(R2.x, R2.y, R2.w, R2.h); }
      else { R2 = { x: MR.x, y: vy + vh * (0.2 + rm() * 0.4), w: MR.w, h: Math.max(mod, Math.round(vh * (0.2 + rm() * 0.2) / mod) * mod) }; ctx.rect(R2.x, R2.y, R2.w, R2.h); }
      ctx.clip(); ctx.fillStyle = plate; ctx.fillRect(R2.x, R2.y, R2.w, R2.h);
      const C2 = m2 === 'topo' ? { line: plate === P.bg ? P.ink : P.bg, hi: plate === P.a ? P.ink : P.a }
        : { a: plate === P.a ? P.ink : P.a, b: P.b, ink: plate === P.ink ? P.bg : P.ink, bg: plate };
      MOTIF_FN[m2](ctx, R2, rm, C2, T, W, mod); ctx.restore();
    }
    ctx.restore();
    if (!any) return P;
    if (panel) { ctx.fillStyle = P.bg; ctx.fillRect(panel.x, panel.y, panel.w, panel.h); }

    // text: title+subtitle from the top of TR, info/caption anchored to its bottom
    const ax = TR.x + (panel ? 0 : axis * mod), aw = TR.w - (panel ? 0 : axis * mod);
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.ink;
    let yb = TR.y + TR.h;
    const capS = Math.round(W * 0.0185), infS = Math.round(W * 0.026), labS = Math.round(W * 0.017);
    if (tx.caption.on) {
      const e = T.rev(4); ctx.globalAlpha = e;
      font(ctx, F.sans, capS, 500); ctx.fillStyle = P.ink;
      spaced(ctx, tx.caption.v.toUpperCase(), TR.x, yb, capS * 0.12);
      ctx.globalAlpha = 1; yb -= capS + G * 0.55;
      ctx.fillRect(TR.x, yb - W * 0.003, TR.w * T.rev(3.5), Math.max(2, W * 0.003)); yb -= G * 0.9;
    }
    if (tx.info.on) {
      const items = tx.info.v.slice(0, 3), cw = (TR.w - (ax - TR.x)) / Math.max(items.length, panel ? 2 : 3);
      items.forEach((it, i) => {
        const e = T.rev(3 + i * 0.4), x = ax + i * cw; ctx.globalAlpha = e;
        const v = fit(ctx, it.v, F.sans, 400, cw - G * 0.5, infS * 2.4, infS, 14, 1.2, 2);
        const vy = yb - (v.lines.length - 1) * v.size * 1.2;
        ctx.fillStyle = P.ink; v.lines.forEach((l, j) => ctx.fillText(l, x, vy + j * v.size * 1.2));
        font(ctx, F.sans, labS, 700); ctx.fillStyle = P.a === P.bg ? P.ink : P.a;
        spaced(ctx, it.k.toUpperCase(), x, vy - v.size - labS * 0.35, labS * 0.14);
        it._top = vy - v.size - labS * 1.35;
      });
      ctx.globalAlpha = 1; yb = Math.min.apply(null, items.map(i => i._top)) - G;
    }
    let y = TR.y; const room = yb - TR.y;
    const subS = Math.round(W * 0.036);
    if (tx.title.on) {
      const maxH = room - (tx.subtitle.on ? subS * 1.3 + G : 0);
      const t = fit(ctx, tx.title.v, F.sans, 800, aw, maxH, Math.round(W * 0.15 * big), 30, 0.94, big < 1 ? 2 : 4);
      t.lines.forEach((l, i) => {
        const e = T.rev(0.6 + i * 0.5), ly = y + t.size * 0.76 + i * t.size * 0.94;
        ctx.save(); ctx.beginPath(); ctx.rect(0, ly - t.size * 0.8, W, t.size * 1.02); ctx.clip();
        ctx.fillStyle = P.ink; font(ctx, F.sans, t.size, 800);
        spaced(ctx, l, ax - t.size * 0.045, ly + (1 - e) * t.size, -t.size * 0.028); ctx.restore();
      });
      y += t.size * 0.76 + (t.lines.length - 1) * t.size * 0.94 + G;
    }
    if (tx.subtitle.on) {
      const s = fit(ctx, tx.subtitle.v, F.sans, 400, aw, yb - y, subS, 16, 1.18, 2);
      ctx.globalAlpha = T.rev(2); ctx.fillStyle = P.ink;
      s.lines.forEach((l, i) => ctx.fillText(l, ax, y + s.size * 0.8 + i * s.size * 1.18));
      ctx.globalAlpha = 1;
    }
    return P;
  }

  /* ---------- POSTMODERN ---------- */
  function shadowed(ctx, d, ink, draw) { ctx.save(); ctx.translate(d, d); draw(ink, true); ctx.restore(); draw(null, false); }
  const SHAPES = {
    stripes(ctx, s, P, r) {
      const n = 6 + Math.floor(r() * 4), c1 = pick(r, [P.a, P.b, P.c]), c2 = pick(r, [P.ink, P.bg]);
      return (ov) => { for (let i = 0; i < n; i++) { ctx.fillStyle = ov || (i % 2 ? c2 : c1); ctx.fillRect(-s / 2, -s * 0.36 + i * s * 0.72 / n, s, s * 0.72 / n + 1); if (ov) break; } if (ov) ctx.fillRect(-s / 2, -s * 0.36, s, s * 0.72); };
    },
    half(ctx, s, P, r) { const c = pick(r, [P.a, P.b, P.c]); return (ov) => { ctx.fillStyle = ov || c; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, Math.PI, 0); ctx.closePath(); ctx.fill(); }; },
    tri(ctx, s, P, r) { const c = pick(r, [P.a, P.b, P.c]); return (ov) => { ctx.fillStyle = ov || c; ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.4); ctx.lineTo(s * 0.45, s * 0.4); ctx.lineTo(-s * 0.45, -s * 0.45); ctx.closePath(); ctx.fill(); }; },
    squiggle(ctx, s, P, r) {
      const c = pick(r, [P.a, P.b, P.ink]), n = 5 + Math.floor(r() * 3);
      return (ov) => { ctx.strokeStyle = ov || c; ctx.lineWidth = s * 0.075; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= n; i++) { const x = -s * 0.5 + s * i / n, y = (i % 2 ? -1 : 1) * s * 0.12; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
    },
    dotsq(ctx, s, P, r) {
      const c = pick(r, [P.c, P.b, P.a]), n = 6;
      return (ov) => { ctx.fillStyle = ov || c; ctx.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8); if (ov) return; ctx.fillStyle = P.ink; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.beginPath(); ctx.arc(-s * 0.4 + s * 0.8 * (i + 0.5) / n, -s * 0.4 + s * 0.8 * (j + 0.5) / n, s * 0.022, 0, TAU); ctx.fill(); } };
    },
    stairs(ctx, s, P, r) { const c = pick(r, [P.a, P.b, P.c]), n = 4; return (ov) => { ctx.fillStyle = ov || c; ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.45); for (let i = 0; i < n; i++) { ctx.lineTo(-s * 0.45 + s * 0.9 * i / n, s * 0.45 - s * 0.9 * (i + 1) / n); ctx.lineTo(-s * 0.45 + s * 0.9 * (i + 1) / n, s * 0.45 - s * 0.9 * (i + 1) / n); } ctx.lineTo(s * 0.45, s * 0.45); ctx.closePath(); ctx.fill(); }; },
    ring(ctx, s, P, r) { const c = pick(r, [P.a, P.b, P.ink]); return (ov) => { ctx.strokeStyle = ov || c; ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU); ctx.stroke(); }; }
  };
  function pomo(ctx, W, H, spec, T) {
    const rl = rng(spec.seeds.layout), rc = rng(spec.seeds.colour), rm = rng(spec.seeds.motif);
    const P = PAL.pomo[spec.palette != null ? spec.palette : Math.floor(rc() * PAL.pomo.length)];
    const story = spec.format === '9:16', M = Math.round(W * 0.0667);
    const top = M + (story ? H * 0.085 : 0), bot = H - M - (story ? H * 0.1 : 0);
    const d = W * 0.013, tx = spec.text;
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    // ground pattern
    const gp = Math.floor(rm() * 3), st = W / 18;
    ctx.globalAlpha = 0.16; ctx.fillStyle = P.ink; ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, W * 0.0016);
    if (gp === 0) for (let y = st / 2; y < H; y += st) for (let x = st / 2; x < W; x += st) { ctx.beginPath(); ctx.arc(x, y, W * 0.0045, 0, TAU); ctx.fill(); }
    else if (gp === 1) { ctx.beginPath(); for (let x = st; x < W; x += st) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = st; y < H; y += st) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); }
    else for (let i = 0; i < 90; i++) { const x = rm() * W, y = rm() * H, a = rm() * TAU; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-W * 0.012, -W * 0.003, W * 0.024, W * 0.006); ctx.restore(); }
    ctx.globalAlpha = 1;
    // shapes on a jittered lattice, biased away from the title half
    const titleTop = spec.layout != null ? spec.layout % 2 === 0 : rl() < 0.5;
    const names = Object.keys(SHAPES), gx = 3, gy = story ? 5 : spec.format === '3:4' ? 4 : 3, cells = [];
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) cells.push([i, j]);
    cells.sort(() => rm() - 0.5);
    const count = Math.min(cells.length, story ? 8 : 6);
    let k = 0;
    for (const c of cells.slice(0, count)) {
      const cw = W / gx, ch = H / gy, s = Math.min(cw, ch) * (0.7 + rm() * 0.55);
      const x = (c[0] + 0.5 + (rm() - 0.5) * 0.5) * cw, y = (c[1] + 0.5 + (rm() - 0.5) * 0.5) * ch;
      const rot = (rm() - 0.5) * 1.4 + (T.on ? 0.07 * Math.sin(TAU * T.ph + k) : 0);
      const draw = SHAPES[names[(Math.floor(rm() * names.length) + k) % names.length]](ctx, s, P, rm);
      const e = T.rev(k * 0.25);
      ctx.save(); ctx.translate(x, y + (T.on ? s * 0.03 * Math.cos(TAU * T.ph + k * 1.7) : 0)); ctx.rotate(rot); ctx.scale(e, e);
      if (e > 0.01) shadowed(ctx, d, P.ink, (ov) => draw(ov));
      ctx.restore(); k++;
    }
    // title: one tilted strip per line
    ctx.textBaseline = 'alphabetic';
    const ang = (spec.layout != null ? [-5, 4, -3][spec.layout % 3] : pick(rl, [-6, -4, 3, 5])) * Math.PI / 180;
    const tt = tx.title.on ? fit(ctx, tx.title.v.toUpperCase(), F.disp, 800, W - 2 * M - W * 0.1, W * 0.5, Math.round(W * 0.15), 30, 1.18, 3) : null;
    const ss = tx.subtitle.on ? fit(ctx, tx.subtitle.v, F.serif, 400, W - 2 * M - W * 0.14, W * 0.16, Math.round(W * 0.066), 18, 1.15, 2, true) : null;
    const titleH = tt ? tt.lines.length * tt.size * 1.2 + W * 0.09 : 0, subH = ss ? ss.lines.length * ss.size * 1.15 + W * 0.05 : 0;
    let ty = titleTop ? top + W * 0.04 : bot - titleH - subH - W * 0.04, blockBottom = ty;
    if (tt) {
      const t = tt, fills = [P.ink, P.a, P.b];
      ctx.save(); ctx.translate(M, ty); ctx.rotate(ang);
      t.lines.forEach((l, i) => {
        font(ctx, F.disp, t.size, 800);
        const w = ctx.measureText(l).width, padX = t.size * 0.16, h = t.size * 1.06, y = i * t.size * 1.2 + (ang < 0 ? W * 0.07 : 0);
        const x = i * t.size * 0.22, e = T.rev(1 + i * 0.5), fc = fills[i % 3];
        ctx.fillStyle = P.ink; ctx.fillRect(x + d, y + d, (w + padX * 2) * e, h);
        ctx.fillStyle = fc; ctx.fillRect(x, y, (w + padX * 2) * e, h);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, (w + padX * 2) * e, h); ctx.clip();
        ctx.fillStyle = fc === P.ink ? P.bg : (fc === P.a ? P.bg : P.ink);
        ctx.fillText(l, x + padX, y + t.size * 0.86); ctx.restore();
      });
      ctx.restore(); blockBottom = ty + titleH;
    }
    if (ss) {
      const s = ss;
      ctx.save(); ctx.translate(M + W * 0.04, blockBottom); ctx.rotate(-ang * 0.5); ctx.globalAlpha = T.rev(2.4);
      s.lines.forEach((l, i) => {
        font(ctx, F.serif, s.size, 400, true);
        const w = ctx.measureText(l).width;
        ctx.fillStyle = P.ink; ctx.fillRect(-s.size * 0.2 + d * 0.6, i * s.size * 1.15 + d * 0.6, w + s.size * 0.4, s.size * 1.12);
        ctx.fillStyle = P.c; ctx.fillRect(-s.size * 0.2, i * s.size * 1.15, w + s.size * 0.4, s.size * 1.12);
        ctx.fillStyle = '#141414'; ctx.fillText(l, 0, i * s.size * 1.15 + s.size * 0.82);
      });
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (tx.info.on) {
      const items = tx.info.v.slice(0, 3), fs = Math.round(W * 0.024), lh = fs * 1.55, pad = fs * 0.9;
      font(ctx, F.mono, fs, 400);
      const bw = Math.max.apply(null, items.map(i => ctx.measureText(i.k.toUpperCase() + '  ' + i.v).width)) + pad * 2, bh = items.length * lh + pad * 1.5;
      const bx = W - M - bw, by = titleTop ? bot - bh - (tx.caption.on ? W * 0.02 : 0) : top + W * 0.02, e = T.rev(3.2);
      ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.rotate(ang * 0.4); ctx.scale(e, e); ctx.translate(-bw / 2, -bh / 2);
      ctx.fillStyle = P.ink; ctx.fillRect(d, d, bw, bh);
      ctx.fillStyle = P.bg; ctx.fillRect(0, 0, bw, bh); ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(2, W * 0.004); ctx.strokeRect(0, 0, bw, bh);
      items.forEach((it, i) => { ctx.fillStyle = P.ink; font(ctx, F.mono, fs, 400); ctx.fillText(it.k.toUpperCase() + '  ' + it.v, pad, pad * 0.6 + (i + 0.72) * lh); });
      ctx.restore();
    }
    if (tx.caption.on) {
      const fs = Math.round(W * 0.019); font(ctx, F.mono, fs, 400);
      const str = tx.caption.v.toUpperCase(), w = spacedW(ctx, str, fs * 0.18) + fs * 1.2;
      ctx.save(); ctx.translate(M * 0.42, bot); ctx.rotate(-Math.PI / 2); ctx.globalAlpha = T.rev(4);
      ctx.fillStyle = P.bg; ctx.fillRect(-fs * 0.5, -fs * 0.2, w, fs * 1.5);
      ctx.fillStyle = P.ink; spaced(ctx, str, 0, fs * 0.9, fs * 0.18);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    return P;
  }

  /* ---------- BRUTALIST: the title is the graphic ---------- */
  function brutal(ctx, W, H, spec, T) {
    const rl = rng(spec.seeds.layout), rc = rng(spec.seeds.colour), rm = rng(spec.seeds.motif);
    const P = PAL.brutal[spec.palette != null ? spec.palette : Math.floor(rc() * PAL.brutal.length)];
    const story = spec.format === '9:16', M = Math.round(W * 0.045), tx = spec.text;
    const top = M + (story ? H * 0.1 : 0), bot = H - M - (story ? H * 0.125 : 0), iw = W - 2 * M;
    const R = Math.max(6, Math.round(W * 0.012)), fam = rl() < 0.5 ? F.heavy : F.black, hot = Math.floor(rl() * 3), flip = rl() < 0.4;
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'alphabetic';
    let y = top, yb = bot;
    const ms = Math.round(W * 0.023);
    if (tx.caption.on) {
      ctx.fillStyle = P.ink; ctx.fillRect(M, y, iw * T.rev(0), R); font(ctx, F.mono, ms, 400);
      ctx.globalAlpha = T.rev(0.5); spaced(ctx, tx.caption.v.toUpperCase(), M, y + R + ms * 1.45, ms * 0.08);
      const tag = 'RSTR/' + spec.format; ctx.fillText(tag, W - M - ctx.measureText(tag).width, y + R + ms * 1.45); ctx.globalAlpha = 1;
      y += R + ms * 2.1; ctx.fillRect(M, y, iw * T.rev(0.3), R / 2); y += R / 2;
    }
    if (tx.info.on) {
      const items = tx.info.v.slice(0, 3), rh = Math.round(W * 0.066);
      yb -= items.length * rh;
      items.forEach((it, i) => {
        const ry = yb + i * rh, e = T.rev(3 + i * 0.4);
        ctx.fillStyle = P.ink; ctx.fillRect(M, ry, iw * e, i ? R / 2 : R); ctx.globalAlpha = e;
        font(ctx, F.mono, ms, 400); spaced(ctx, it.k.toUpperCase(), M, ry + rh * 0.66, ms * 0.08);
        const v = fit(ctx, it.v.toUpperCase(), fam, 400, iw * 0.7, rh, Math.round(rh * 0.62), 14, 1, 1);
        ctx.fillText(v.lines[0], W - M - ctx.measureText(v.lines[0]).width, ry + rh * 0.74); ctx.globalAlpha = 1;
      });
      ctx.fillRect(M, bot - R / 2, iw, R / 2);
    }
    if (tx.subtitle.on) {
      const bh = Math.round(W * 0.078); yb -= bh + (tx.info.on ? R * 1.4 : 0);
      const s = fit(ctx, tx.subtitle.v.toUpperCase(), F.mono, 400, iw - bh * 0.6, bh, Math.round(bh * 0.4), 12, 1, 1), e = T.rev(2.4);
      ctx.fillStyle = P.ink; ctx.fillRect(M, yb, iw * e, bh);
      ctx.fillStyle = P.bg; ctx.globalAlpha = e; spaced(ctx, s.lines[0], M + bh * 0.3, yb + bh * 0.5 + s.size * 0.36, s.size * 0.1); ctx.globalAlpha = 1;
    }
    if (!tx.title.on) return P;
    const gap = Math.round(W * 0.02), avail = yb - y - gap * 2;
    let words = tx.title.v.toUpperCase().split(/\s+/), lines = words;
    if (words.length > 4) { const n = Math.ceil(words.length / 3); lines = [0, 1, 2].map(i => words.slice(i * n, i * n + n).join(' ')).filter(Boolean); }
    font(ctx, fam, 200, 400);
    const m = lines.map(l => { const t = ctx.measureText(l); return { l, w: t.actualBoundingBoxLeft + t.actualBoundingBoxRight, left: t.actualBoundingBoxLeft, cap: t.actualBoundingBoxAscent }; });
    m.forEach(o => { o.s = iw / o.w; o.h = o.cap * o.s; });           // every line fills the width
    let natural = m.reduce((a, o) => a + o.h, 0) + gap * (m.length - 1);
    const ky = clamp(avail / natural, 0.55, 1.9), kx = Math.min(1, avail / natural / 0.55);
    if (kx < 1) m.forEach(o => { o.s *= kx; o.h *= kx; });
    natural = m.reduce((a, o) => a + o.h, 0) + gap * (m.length - 1);                    // then the block is stretched to fill the height
    let ty = flip ? yb - gap - (natural - gap * (m.length - 1)) * ky - gap * (m.length - 1) : y + gap;
    m.forEach((o, i) => {
      const h = o.h * ky, e = T.rev(0.8 + i * 0.5), on = i === hot % m.length;
      if (on) { ctx.fillStyle = P.a; ctx.fillRect(0, ty - gap / 2, W * e, h + gap); }
      ctx.save(); ctx.beginPath(); ctx.rect(0, ty - 2, W, h + 4); ctx.clip();
      ctx.translate(M + o.left * o.s, ty + h + (1 - e) * h); ctx.scale(o.s, o.s * ky);
      ctx.fillStyle = on && P.a === P.ink ? P.bg : P.ink; font(ctx, fam, 200, 400); ctx.fillText(o.l, 0, 0); ctx.restore();
      ty += h + gap;
    });
    const left = flip ? (ty - gap - (yb - gap)) : 0, free = flip ? (yb - gap - natural * ky) - y - gap : yb - gap - ty;
    if (free > W * 0.12) {                                             // leftover space gets one blunt graphic
      const gy = flip ? y + gap : ty, k = Math.floor(rm() * 3); ctx.fillStyle = P.ink;
      if (k === 0) { let x = M; while (x < W - M) { const w = (1 + Math.floor(rm() * 5)) * W * 0.006; ctx.fillRect(x, gy, Math.min(w, W - M - x), free * T.rev(2)); x += w + (1 + Math.floor(rm() * 3)) * W * 0.006; } }
      else if (k === 1) { ctx.fillStyle = P.a; ctx.fillRect(M, gy, iw * T.rev(2), free); ctx.fillStyle = P.ink; const d = Math.min(free * 0.8, iw * 0.3); ctx.beginPath(); ctx.arc(W - M - d * 0.75, gy + free / 2, d / 2, 0, TAU); ctx.fill(); }
      else { const n = Math.max(3, Math.round(iw / (free * 1.2))); for (let i = 0; i < n; i++) { const cx = M + iw * (i + 0.5) / n, cy = gy + free / 2, r = Math.min(free, iw / n) * 0.42 * T.rev(2); ctx.save(); ctx.translate(cx, cy); ctx.rotate(TAU * T.ph * (T.on ? 1 : 0)); for (let a = 0; a < 3; a++) { ctx.rotate(Math.PI / 3); ctx.fillRect(-r, -r * 0.16, r * 2, r * 0.32); } ctx.restore(); } }
    }
    return P;
  }

  /* ---------- VAPORWAVE ---------- */
  function vapor(ctx, W, H, spec, T) {
    const rl = rng(spec.seeds.layout), rc = rng(spec.seeds.colour), rm = rng(spec.seeds.motif);
    const P = PAL.vapor[spec.palette != null ? spec.palette : Math.floor(rc() * PAL.vapor.length)];
    const story = spec.format === '9:16', M = Math.round(W * 0.0667), tx = spec.text;
    const top = M + (story ? H * 0.085 : 0), bot = H - M - (story ? H * 0.1 : 0);
    const hz = Math.round(H * (0.56 + rl() * 0.08)), sunX = W * pick(rl, [0.5, 0.5, 0.3, 0.7]), sunR = W * (0.24 + rl() * 0.1);
    let g = ctx.createLinearGradient(0, 0, 0, hz); P.g.forEach((c, i) => g.addColorStop(i / (P.g.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz);
    // stars
    ctx.fillStyle = P.ink; for (let i = 0; i < 46; i++) { const x = rm() * W, y = rm() * hz * 0.7, s = W * (0.0015 + rm() * 0.003) * (T.on ? 0.6 + 0.4 * Math.sin(TAU * T.ph * 2 + i) : 1); ctx.globalAlpha = P.dark ? 0.85 : 0.5; ctx.fillRect(x - s * 3, y - s / 2, s * 6, s); ctx.fillRect(x - s / 2, y - s * 3, s, s * 6); } ctx.globalAlpha = 1;
    // sun with slits
    const sy = hz - sunR * (0.25 + rl() * 0.3), e0 = T.rev(0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hz); ctx.clip(); ctx.beginPath(); ctx.arc(sunX, sy + (1 - e0) * sunR, sunR, 0, TAU); ctx.clip();
    g = ctx.createLinearGradient(0, sy - sunR, 0, sy + sunR); g.addColorStop(0, P.c); g.addColorStop(0.55, P.a); g.addColorStop(1, P.g[1]);
    ctx.fillStyle = g; ctx.fillRect(sunX - sunR, sy - sunR, sunR * 2, sunR * 2.5);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) { const yy = sy - sunR * 0.05 + ((i + (T.on ? T.ph * 4 % 1 : 0)) * sunR * 0.145); ctx.fillRect(sunX - sunR, yy, sunR * 2, sunR * (0.012 + i * 0.011)); }
    ctx.restore(); ctx.globalCompositeOperation = 'destination-over';
    g = ctx.createLinearGradient(0, 0, 0, hz); P.g.forEach((c, i) => g.addColorStop(i / (P.g.length - 1), c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz);
    ctx.globalCompositeOperation = 'source-over';
    // floor grid
    ctx.fillStyle = P.floor; ctx.fillRect(0, hz, W, H - hz);
    ctx.save(); ctx.beginPath(); ctx.rect(0, hz, W, H - hz); ctx.clip();
    ctx.strokeStyle = P.b; ctx.lineWidth = Math.max(2, W * 0.003); ctx.shadowColor = P.b; ctx.shadowBlur = W * 0.012;
    ctx.beginPath(); for (let i = -14; i <= 14; i++) { ctx.moveTo(W / 2 + i * W * 0.035, hz); ctx.lineTo(W / 2 + i * W * 0.42, H); }
    const off = T.on ? (T.ph * 6) % 1 : 0; for (let k = 0; k < 14; k++) { const z = (k + off) / 14, yy = hz + (H - hz) * Math.pow(z, 2.2); ctx.moveTo(0, yy); ctx.lineTo(W, yy); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = P.a; ctx.shadowColor = P.a; ctx.shadowBlur = W * 0.02; ctx.fillRect(0, hz - W * 0.002, W, W * 0.004); ctx.shadowBlur = 0;
    // title: gradient type with outline and offset
    ctx.textBaseline = 'alphabetic';
    const upper = rl() < 0.5; let ty = upper ? top + W * 0.02 : hz + W * 0.07;
    if (tx.title.on) {
      const t = fit(ctx, tx.title.v.toUpperCase(), F.wide, 800, W - 2 * M, upper ? (hz - top) * 0.42 : (bot - hz) * 0.5, Math.round(W * 0.14), 28, 1.08, 3);
      t.lines.forEach((l, i) => {
        font(ctx, F.wide, t.size, 800); const w = ctx.measureText(l).width, x = (W - w) / 2, y = ty + t.size * 0.86 + i * t.size * 1.08, e = T.rev(1 + i * 0.4), d = t.size * 0.055;
        ctx.globalAlpha = e; ctx.fillStyle = P.a; ctx.fillText(l, x + d, y + d); ctx.fillStyle = P.b; ctx.fillText(l, x - d * 0.5, y - d * 0.5);
        const tg = ctx.createLinearGradient(0, y - t.size * 0.75, 0, y); tg.addColorStop(0, '#FFFFFF'); tg.addColorStop(0.48, P.c); tg.addColorStop(0.52, P.g[1]); tg.addColorStop(1, P.a);
        ctx.fillStyle = tg; ctx.fillText(l, x, y); ctx.lineWidth = Math.max(2, t.size * 0.022); ctx.strokeStyle = P.dark ? '#FFFFFF' : P.ink; ctx.strokeText(l, x, y); ctx.globalAlpha = 1;
      });
      ty += t.lines.length * t.size * 1.08 + W * 0.03;
    }
    if (tx.subtitle.on) {
      const str = tx.subtitle.v.toUpperCase(); let fs = Math.round(W * 0.03); font(ctx, F.sans, fs, 500);
      while (fs > 12 && spacedW(ctx, str, fs * 0.42) > W - 2 * M) { fs -= 1; font(ctx, F.sans, fs, 500); }
      const w = spacedW(ctx, str, fs * 0.42); ctx.globalAlpha = T.rev(2.4); ctx.fillStyle = upper ? P.ink : (P.dark ? '#FFFFFF' : P.ink);
      if (upper && !P.dark) ctx.fillStyle = P.ink; spaced(ctx, str, (W - w) / 2 + fs * 0.21, ty + fs, fs * 0.42); ctx.globalAlpha = 1;
    }
    if (tx.info.on) {   // a plain window with a title bar
      const items = tx.info.v.slice(0, 3), fs = Math.round(W * 0.021), lh = fs * 1.7, pad = fs, bar = fs * 1.8; font(ctx, F.pixel, fs, 400);
      const bw = Math.max(W * 0.34, Math.max.apply(null, items.map(i => ctx.measureText(i.k.toUpperCase() + ': ' + i.v).width)) + pad * 2), bh = bar + items.length * lh + pad;
      const right = rl() < 0.5, bx = right ? W - M - bw : M, by = upper ? hz + (bot - hz - bh) * 0.45 : top + W * 0.03, e = T.rev(3);
      ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(e, e); ctx.translate(-bw / 2, -bh / 2);
      ctx.fillStyle = P.a; ctx.fillRect(fs * 0.5, fs * 0.5, bw, bh); ctx.fillStyle = '#F4F0FF'; ctx.fillRect(0, 0, bw, bh);
      ctx.fillStyle = P.g[1]; ctx.fillRect(0, 0, bw, bar); ctx.strokeStyle = '#1A0B3B'; ctx.lineWidth = Math.max(2, W * 0.003); ctx.strokeRect(0, 0, bw, bh);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText('INFO.TXT', pad * 0.7, bar * 0.72); for (let i = 0; i < 3; i++) ctx.fillRect(bw - (i + 1) * bar * 0.62 - pad * 0.2, bar * 0.28, bar * 0.42, bar * 0.42);
      ctx.fillStyle = '#1A0B3B'; items.forEach((it, i) => ctx.fillText(it.k.toUpperCase() + ': ' + it.v, pad, bar + (i + 0.95) * lh));
      ctx.restore();
    }
    if (tx.caption.on) {
      const fs = Math.round(W * 0.019); font(ctx, F.mono, fs, 400); const str = tx.caption.v.toUpperCase(), w = spacedW(ctx, str, fs * 0.2);
      ctx.globalAlpha = T.rev(4) * 0.95; ctx.fillStyle = P.dark ? '#FFFFFF' : P.ink; spaced(ctx, str, (W - w) / 2, bot, fs * 0.2); ctx.globalAlpha = 1;
    }
    return P;
  }

  /* ---------- GRUNGE POSTMODERN: cut, paste, photocopy ---------- */
  function photocopy(ctx, W, H, r, amt) {
    const im = ctx.getImageData(0, 0, W, H), d = im.data, streak = new Float32Array(H);
    for (let y = 0; y < H; y++) streak[y] = r() < 0.03 ? -(8 + r() * 46) : 0;
    const eL = r() < 0.55 ? W * (0.02 + r() * 0.06) : 0, eR = r() < 0.55 ? W * (0.02 + r() * 0.06) : 0, eT = r() < 0.4 ? H * (0.012 + r() * 0.03) : 0;
    let s = ((r() * 4294967296) >>> 0) || 1;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n = (s >>> 0) / 4294967296;
      let v = (n - 0.5) * 78 * amt + streak[y];
      if (n > 0.9986) v += 150; else if (n < 0.0012) v -= 180;
      if (x < eL) v -= 255 * Math.pow(1 - x / eL, 1.4) * (0.5 + n); if (x > W - eR) v -= 255 * Math.pow(1 - (W - x) / eR, 1.4) * (0.5 + n); if (y < eT) v -= 255 * Math.pow(1 - y / eT, 1.4) * (0.5 + n);
      for (let c = 0; c < 3; c++) { const p = (d[i + c] - 128) * 1.14 + 128 + v; d[i + c] = p < 0 ? 0 : p > 255 ? 255 : p; }
    }
    ctx.putImageData(im, 0, 0);
  }
  function grunge(ctx, W, H, spec, T) {
    const rl = rng(spec.seeds.layout), rc = rng(spec.seeds.colour), rm = rng(spec.seeds.motif);
    const P = PAL.grunge[spec.palette != null ? spec.palette : Math.floor(rc() * PAL.grunge.length)];
    const story = spec.format === '9:16', M = Math.round(W * 0.05), tx = spec.text, iw = W - 2 * M;
    const top = M + (story ? H * 0.1 : 0), bot = H - M - (story ? H * 0.125 : 0);
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'alphabetic';
    // layer 1: found graphics
    const kinds = ['slab', 'half', 'topo', 'scribble', 'tape', 'x', 'lines', 'half', 'topo'].sort(() => rm() - 0.5).slice(0, 4 + Math.floor(rm() * 2));
    for (const k of kinds) {
      ctx.save();
      if (k === 'slab') { ctx.translate(rm() * W, rm() * H); ctx.rotate((rm() - 0.5) * 0.5); ctx.fillStyle = rm() < 0.3 ? P.a : P.ink; const w = W * (0.4 + rm() * 0.6), h = H * (0.06 + rm() * 0.2); ctx.fillRect(-w / 2, -h / 2, w, h); }
      else if (k === 'half') { const r = W * (0.2 + rm() * 0.3), cx = rm() * W, cy = top + rm() * (bot - top); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); dots(ctx, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }, rm, { a: rm() < 0.3 ? P.a : P.ink }, T, W, W / 7); }
      else if (k === 'topo') { ctx.globalAlpha = 0.55; topo(ctx, { x: 0, y: rm() * H * 0.5, w: W, h: H * 0.6 }, rm, { line: P.ink, hi: P.ink }, T, W); }
      else if (k === 'scribble') { ctx.strokeStyle = rm() < 0.4 ? P.a : P.ink; ctx.lineWidth = W * (0.004 + rm() * 0.008); ctx.lineJoin = 'round'; ctx.beginPath(); let x = rm() * W, y = rm() * H; ctx.moveTo(x, y); for (let i = 0; i < 46; i++) { x += (rm() - 0.5) * W * 0.3; y += (rm() - 0.5) * W * 0.12; ctx.lineTo(x, y); } ctx.stroke(); }
      else if (k === 'tape') { for (let i = 0; i < 2; i++) { ctx.save(); ctx.translate(rm() * W, rm() * H); ctx.rotate((rm() - 0.5) * 1.6); ctx.globalAlpha = 0.8; ctx.fillStyle = '#D8C98A'; ctx.fillRect(-W * 0.16, -W * 0.035, W * 0.32, W * 0.07); ctx.restore(); } }
      else if (k === 'x') { ctx.strokeStyle = P.ink; ctx.lineCap = 'square'; for (let i = 0; i < 5; i++) { const x = rm() * W, y = rm() * H, q = W * (0.02 + rm() * 0.05); ctx.lineWidth = q * 0.3; ctx.beginPath(); ctx.moveTo(x - q, y - q); ctx.lineTo(x + q, y + q); ctx.moveTo(x + q, y - q); ctx.lineTo(x - q, y + q); ctx.stroke(); } }
      else { ctx.translate(W / 2, H / 2); ctx.rotate((rm() - 0.5) * 0.3); ctx.translate(-W / 2, -H / 2); lines(ctx, { x: rm() * W * 0.5, y: rm() * H * 0.6, w: W * (0.3 + rm() * 0.5), h: H * (0.15 + rm() * 0.25) }, rm, { a: P.ink, ink: P.a }, T, W); }
      ctx.restore();
    }
    // title: every word its own face, size and attitude
    const reserve = (tx.subtitle.on ? W * 0.15 : 0) + (tx.info.on ? W * 0.17 : 0) + W * 0.02;
    let y = top + W * 0.02;
    if (tx.title.on) {
      const words = tx.title.v.split(/\s+/), Ht = bot - top - reserve, fams = [[F.heavy, 400, 0], [F.black, 400, 0], [F.serif, 400, 1], [F.disp, 800, 0], [F.heavy, 400, 0]];
      const s0 = clamp(Ht / (words.length * 0.8), W * 0.11, W * 0.46), hot = Math.floor(rl() * words.length), boxed = Math.floor(rl() * words.length), cut = Math.floor(rl() * words.length);
      const plan = words.map(w0 => { const f = pick(rl, fams), up = f[2] ? w0 : (rl() < 0.75 ? w0.toUpperCase() : w0.toLowerCase()); let size = s0 * pick(rl, [0.62, 0.85, 1, 1.25, 1.6]); font(ctx, f[0], size, f[1], f[2]); let w = ctx.measureText(up).width; if (w > W * 1.06) { size *= W * 1.06 / w; w = W * 1.06; } return { f, up, size, w }; });
      const natural = plan.reduce((a, p) => a + p.size * 0.74, 0), kf = Math.min(1, Ht / natural);
      plan.forEach((p, i) => {
        const size = p.size * kf, w = p.w * kf, x = w < iw ? M + rl() * (iw - w) : (W - w) / 2, rot = (rl() - 0.5) * 0.11, e = T.rev(0.6 + i * 0.4);
        y += size * 0.74; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = e; font(ctx, p.f[0], size, p.f[1], p.f[2]);
        if (i === boxed && i !== hot) { ctx.fillStyle = P.ink; ctx.fillRect(-size * 0.08, -size * 0.8, w + size * 0.16, size * 0.96); ctx.fillStyle = P.bg; ctx.fillText(p.up, 0, 0); }
        else {
          if (i === hot) { ctx.fillStyle = P.a; ctx.globalAlpha = 0.75 * e; ctx.fillText(p.up, size * 0.05, size * 0.045); ctx.globalAlpha = e; }
          ctx.lineJoin = 'round'; ctx.strokeStyle = P.bg; ctx.lineWidth = size * 0.075; ctx.strokeText(p.up, 0, 0);
          ctx.fillStyle = P.ink;
          if (i === cut) { const sh = size * (0.05 + rl() * 0.07); ctx.save(); ctx.beginPath(); ctx.rect(-W, -size, W * 3, size * 0.58); ctx.clip(); ctx.fillText(p.up, 0, 0); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.rect(-W, -size * 0.4, W * 3, size); ctx.clip(); ctx.fillText(p.up, sh, size * 0.02); ctx.restore(); }
          else ctx.fillText(p.up, 0, 0);
        }
        ctx.restore();
      });
      y += W * 0.035;
    }
    if (tx.subtitle.on) {   // cut-out strips, two words each
      const w2 = tx.subtitle.v.toUpperCase().split(/\s+/), fs = Math.round(W * 0.034); let sx = M + rl() * W * 0.12;
      for (let i = 0; i < w2.length; i += 2) {
        const str = w2.slice(i, i + 2).join(' '); font(ctx, F.mono, fs, 400); const w = spacedW(ctx, str, fs * 0.06) + fs;
        if (sx + w > W - M) sx = M; ctx.save(); ctx.translate(sx, y + (i / 2) * fs * 1.5); ctx.rotate((rl() - 0.5) * 0.08); ctx.globalAlpha = T.rev(2.5 + i * 0.2);
        ctx.fillStyle = i === 0 && P.a !== P.ink ? P.a : '#F4F1E8'; ctx.fillRect(0, -fs * 1.05, w, fs * 1.45); ctx.fillStyle = '#0E0E0E'; spaced(ctx, str, fs * 0.5, 0, fs * 0.06); ctx.restore();
        sx += W * 0.09;
      }
    }
    if (tx.info.on) {
      const items = tx.info.v.slice(0, 3), fs = Math.round(W * 0.024); font(ctx, F.mono, fs, 400);
      const bw = Math.max.apply(null, items.map(i => ctx.measureText(i.k.toUpperCase() + ' ' + i.v).width)) + fs * 1.4, bh = items.length * fs * 1.25 + fs * 1.1;
      ctx.save(); ctx.translate(W - M - bw - rl() * W * 0.06, bot - bh - (tx.caption.on ? fs * 1.2 : 0)); ctx.rotate((rl() - 0.5) * 0.07); ctx.globalAlpha = T.rev(3.2);
      ctx.fillStyle = '#F4F1E8'; ctx.fillRect(0, 0, bw, bh); ctx.fillStyle = '#0E0E0E'; ctx.fillRect(0, 0, bw, fs * 0.28);
      items.forEach((it, i) => ctx.fillText(it.k.toUpperCase() + ' ' + it.v, fs * 0.7, fs * 1.5 + i * fs * 1.25)); ctx.restore();
    }
    if (tx.caption.on) {
      const fs = Math.round(W * 0.018); font(ctx, F.mono, fs, 400); const str = tx.caption.v.toUpperCase();
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = T.rev(4) * (1 - i * 0.3); ctx.fillStyle = P.ink; ctx.fillText(str, M + i * fs * 0.5, bot - i * fs * 1.15); }
      ctx.globalAlpha = 1;
    }
    photocopy(ctx, W, H, rm, 1);
    return P;
  }

  function render(ctx, spec, t) {
    const d = FORMATS[spec.format];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    return ({ pomo, brutal, vapor, grunge }[spec.style] || swiss)(ctx, d[0], d[1], spec, clock(t));
  }
  function randomSeeds(prev, locks) {
    const n = () => (Math.random() * 0xFFFFFFFF) >>> 0, p = prev || {}, l = locks || {};
    return { layout: l.layout ? p.layout : n(), colour: l.colour ? p.colour : n(), motif: l.motif ? p.motif : n() };
  }
  g.IDK = { FORMATS, PAL, MOTIFS, render, randomSeeds };
})(typeof window !== 'undefined' ? window : globalThis);
