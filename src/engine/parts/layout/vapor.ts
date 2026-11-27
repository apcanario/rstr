/**
 * Vaporwave layout (spec 8.0, 8.4): eight layouts. Four have a horizon (between 56% and 64% of the height): the
 * title in the sky over the sun, on the floor, inside a window, or on a band across the horizon. Four have none:
 * windows on a gradient field, a grid tunnel, the sun huge and cropped, a wire orb. The layouts without a horizon
 * take a tilt or a quarter turn on about one roll in six each; a horizon stays level.
 *
 * What makes the sky title legible for every palette (Carried R9): the sky's dark end. For every form of every
 * Vaporwave palette, ink or window ink holds 3:1 over the top 60% of the sky and 4.5:1 over the top 48% (the worst
 * is Sunset dark), so the title and subtitle are kept above 47% of the horizon height and the sun is sized to sit
 * under them, never behind them (the sun's colours do not hold against either ink in the dark forms).
 *
 * Every box a graphic is drawn in comes from the layout stream (c.rf, read in a fixed order) and the text that is
 * on, never from the pairing: the info window's area is reserved at its widest, so the sun keeps clear of it.
 */
import type { Rect } from '../../geom';
import { frameFor } from '../frame';
import { basePlan, SIZE_CLASSES, TRANSFORMS, type LayoutPart, type SizeClass, type Transform } from '../types';
import { layoutPicker, sizeControl, transformControl, type Ranged } from '../../controls';

export const VAPOR_LAYOUTS = ['title-sky', 'title-floor', 'title-window', 'title-band', 'windows', 'tunnel', 'sun-huge', 'orb'];
/** The layouts with a horizon: the sky gradient above it, the floor below. */
export const HORIZON = ['title-sky', 'title-floor', 'title-window', 'title-band'];
/** Title start size per class, as a share of the normal one. */
export const VAPOR_SIZE: Record<SizeClass, number> = { small: 0.72, normal: 1, oversize: 1.3 };
/** The share of the horizon height the sky text keeps above (see the header). */
export const SKY_TEXT = 0.47;

/** The horizon's range, as a share of the height (spec 8.4): `layout.horizon`. */
export const HORIZON_AT = { min: 0.56, max: 0.64 };
const horizonControl = (): Ranged => ({ kind: 'range', id: 'layout.horizon', label: 'Horizon', where: { at: 'params', key: 'layout.horizon' }, facet: 'layout', min: HORIZON_AT.min, max: HORIZON_AT.max, step: 0.005 });

export const vaporLayout: LayoutPart = {
  id: 'vapor', layouts: VAPOR_LAYOUTS, margin: 72,
  // spec 10.3 Layout: the layout, the transform (only a layout without a horizon takes one, spec 8.4), the title size
  // class, and the horizon where there is one (between 56% and 64% of the height; a 9:16 sky title maps it onto the
  // upper part of that range, 60% to 64%, for the story zone above it)
  controls: ({ scene }) => [layoutPicker(VAPOR_LAYOUTS), ...(HORIZON.includes(scene.frame) ? [horizonControl()] : [transformControl()]), sizeControl()],
  plan(c) {
    const { W, H, spec, story } = c, tx = c.tx, prm = spec.params;
    // the layout stream, in a fixed order: layout, transform, tilt angle, size class, horizon, sun x, sun radius,
    // sun height, sun end; then the window side as a candidate decision
    const ul = c.rf(), ut = c.rf(), ua = c.rf(), us = c.rf(), uh = c.rf(), ux = c.rf(), ur = c.rf(), uk = c.rf(), ue = c.rf();
    const li = VAPOR_LAYOUTS.indexOf(spec.pick.layout ?? '');
    let name = li >= 0 ? VAPOR_LAYOUTS[li] : VAPOR_LAYOUTS[Math.floor(ul * VAPOR_LAYOUTS.length)];
    // a picked tunnel or orb needs its own layout; a picked windows stack its field (the rest go anywhere)
    const motif = spec.pick.motif;
    if (li < 0 && motif === 'tunnel') name = 'tunnel';
    if (li < 0 && motif === 'windows' && name !== 'windows') name = 'windows';
    // the horizon glow and mountains need a horizon; the grid a floor (the orb and the huge sun have one too)
    if (li < 0 && (motif === 'horizon' || motif === 'mountains') && !HORIZON.includes(name)) name = HORIZON[Math.floor(ul * 32) % 4];
    if (li < 0 && motif === 'grid' && (name === 'windows' || name === 'tunnel')) name = 'title-floor';
    const horizonL = HORIZON.includes(name);
    let transform: Transform = horizonL ? 'none' : (['none', 'none', 'none', 'none', 'tilt', 'quarter'] as Transform[])[Math.floor(ut * 6)];
    if (!horizonL && TRANSFORMS.includes(prm['layout.transform'] as Transform)) transform = prm['layout.transform'] as Transform;
    let size: SizeClass = (['small', 'normal', 'normal', 'normal', 'oversize', 'oversize'] as SizeClass[])[Math.floor(us * 6)];
    if (SIZE_CLASSES.includes(prm['layout.size'] as SizeClass)) size = prm['layout.size'] as SizeClass;
    const sideU = c.cand([0, 1]);
    const deg = (ua < 0.5 ? -1 : 1) * (9 + 5 * ((ua * 2) % 1));
    const fr = frameFor(transform, deg, W, H, story), pg = fr.page;
    const M = 72, gap = Math.round(W * 0.025);
    const up0 = transform === 'none' ? c.top : M, dn0 = transform === 'none' ? c.bot : pg.h - M - c.keep;
    const plan = basePlan(name, pg, M);
    plan.transform = transform; plan.xf = fr.xf; plan.size = size; plan.gutter = gap;
    const B = plan.boxes = { text: { x: M, y: up0, w: pg.w - 2 * M, h: dn0 - up0 } } as typeof plan.boxes;
    const pos: NonNullable<typeof plan.pos> = (plan.pos = {});

    // the text that is on, and the room each block wants
    const cOn = tx.caption.on && !!tx.caption.v.trim();
    const pairs = tx.info.on ? tx.info.v.slice(0, 3).filter((p) => p.k.trim() || p.v.trim()).length : 0;
    const fs0 = Math.round(W * 0.021), winH = pairs ? Math.ceil(fs0 * (2.8 + 1.7 * pairs)) + 2 : 0, winW = Math.round(W * 0.46);
    const capH = cOn ? Math.round(W * 0.032) : 0;
    const textW = pg.w - 2 * M;
    const infoAt = (y: number, right: boolean): Rect => ({ x: right ? pg.w - M - winW : M, y, w: winW, h: winH });
    const caption = () => { if (cOn) B.caption = { x: M, y: dn0 - capH, w: textW, h: capH }; return cOn ? capH + gap : 0; };

    if (horizonL) {
      // the horizon; a sky title in 9:16 takes the upper half of the range, for the story zone above it
      // an Advanced horizon (spec 10.3, 0.56 to 0.64) takes the place of the stream's draw, over the same range
      const ph = prm['layout.horizon'], vh = typeof ph === 'number' && Number.isFinite(ph) ? Math.max(0, Math.min(1, (ph - HORIZON_AT.min) / (HORIZON_AT.max - HORIZON_AT.min))) : uh;
      const hz = Math.round(H * (name === 'title-sky' && story ? 0.6 + vh * 0.04 : 0.56 + vh * 0.08));
      plan.horizon = hz;
      B.sky = { x: 0, y: 0, w: W, h: hz };
      B.floor = { x: 0, y: hz, w: W, h: H - hz };
      B.graphic = B.sky;
      let sunX = W * [0.5, 0.5, 0.3, 0.7][Math.floor(ux * 4)], sunR = W * (0.24 + ur * 0.1);
      const k = 0.25 + uk * 0.3;
      // the window goes on the side away from the sun; with the sun centred, the candidate decides
      const right = sunX < W * 0.5 ? true : sunX > W * 0.5 ? false : sideU === 0;
      plan.side = right ? 'right' : 'left';
      const capRoom = caption();
      // the sun keeps under a box above it: its top (centre less radius) at least a gap below
      const sunUnder = (bottom: number) => { sunR = Math.max(W * 0.12, Math.min(sunR, (hz - bottom - gap) / (1 + k))); };
      const floorTop = hz + Math.round(W * 0.05);
      if (name === 'title-sky') {
        B.title = { x: M, y: up0, w: textW, h: Math.round(hz * SKY_TEXT) - up0 };
        sunUnder(B.title.y + B.title.h);
        // and close under it: a small sun left a dead band of sky between the text and the sun (R9 S5); the sun's top
        // comes within W * 0.04 (radius) of the box's foot, its size still varying with uk
        const fill = (hz - (B.title.y + B.title.h) - gap) / (1 + k);
        sunR = Math.min(fill, Math.max(sunR, fill - W * 0.04));
        if (pairs) B.info = infoAt(Math.round(floorTop + (dn0 - capRoom - floorTop - winH) * 0.45), right);
        // the block sits at the foot of its box, just over the sun; the spare sky goes above it, under the stars (R9 S5:
        // at the top of the box a 9:16 title left a dead band of sky between the subtitle and the sun)
        pos.title = 'bottom';
      } else if (name === 'title-window') {
        // the title in a window across the sky; the sun behind it shows where it is lower than the window
        const ph = Math.round((hz - up0) * 0.62);
        B.panel = { x: M, y: up0 + Math.round(W * 0.02), w: textW, h: ph };
        B.title = { ...B.panel };
        if (pairs) B.info = infoAt(Math.round(floorTop + (dn0 - capRoom - floorTop - winH) * 0.45), right);
        pos.title = 'middle';
      } else {
        // title on the floor, or on a band across the horizon; the window goes in the sky, clear of the sun
        if (pairs) {
          const I = B.info = infoAt(up0 + Math.round(W * 0.02), right);
          // only where the sun reaches under the window's side does it shrink to keep under it
          if (sunX + sunR > I.x - gap && sunX - sunR < I.x + I.w + gap) sunUnder(I.y + I.h);
        }
        if (name === 'title-band') {
          const bh = Math.round(Math.min(W * 0.4, (dn0 - up0) * 0.3));
          B.panel = { x: 0, y: Math.round(hz - bh * 0.45), w: W, h: bh };
          B.title = { x: M, y: B.panel.y, w: textW, h: bh };
          pos.title = 'middle';
        } else {
          B.title = { x: M, y: floorTop, w: textW, h: dn0 - capRoom - floorTop };
          pos.title = 'top';
        }
      }
      // the sun never runs off the side of the canvas by more than a third of itself
      sunX = Math.max((sunR * 2) / 3, Math.min(W - (sunR * 2) / 3, sunX));
      plan.focus = { x: sunX, y: hz - sunR * k, r: sunR };
      return plan;
    }

    // no horizon: the page is a field; everything is laid out on the (possibly turned) page
    plan.horizon = pg.h;
    const area: Rect = { x: M, y: up0, w: textW, h: dn0 - up0 };
    const capRoom = caption();
    const right = sideU === 0;
    plan.side = right ? 'right' : 'left';
    const bottom = dn0 - capRoom;
    if (name === 'windows') {
      // the front window holds the title; a stack of empty windows behind; the caption on a bar
      pos.caption = 'bar';
      const ph = Math.round(Math.max(area.h * 0.4, Math.min(area.h * 0.55, area.h - winH - capRoom - 3 * gap))), py = Math.round(up0 + (area.h - ph - winH - gap - capRoom) * (0.25 + uh * 0.5));
      B.panel = { x: M, y: py, w: textW, h: ph };
      B.title = { ...B.panel };
      pos.title = 'middle';
      if (pairs) B.info = infoAt(py + ph + gap, right);
      B.graphic = { x: 0, y: 0, w: pg.w, h: pg.h };
      plan.focus = { x: pg.w * (right ? 0.28 : 0.72), y: up0 + area.h * (0.12 + uk * 0.2), r: pg.w * (0.16 + ur * 0.12) };
      return plan;
    }
    if (name === 'tunnel') {
      const th = Math.round(area.h * 0.42);
      B.title = { x: M, y: Math.round(up0 + (bottom - up0 - th) * 0.5 - (pairs ? winH * 0.4 : 0)), w: textW, h: th };
      pos.title = 'middle';
      if (pairs) B.info = infoAt(Math.max(B.title.y + th + gap, bottom - winH), right);
      B.graphic = { x: 0, y: 0, w: pg.w, h: pg.h };
      plan.focus = { x: pg.w / 2, y: up0 + area.h * 0.16, r: Math.min(pg.w, area.h) * (0.1 + ur * 0.06) };
      return plan;
    }
    if (name === 'sun-huge') {
      // the sun huge and cropped by the top or the bottom edge; the text in what it leaves
      const R = Math.min(pg.w, pg.h) * (0.5 + ur * 0.2), atTop = ue < 0.6;
      const cx = pg.w * [0.5, 0.5, 0.35, 0.65][Math.floor(ux * 4)];
      const cy = atTop ? -R * (0.1 + uk * 0.3) : pg.h + R * (0.1 + uk * 0.3);
      plan.focus = { x: cx, y: cy, r: R };
      B.graphic = { x: 0, y: 0, w: pg.w, h: pg.h };
      // a sun rising from the bottom takes the foot: the caption moves to the head
      if (!atTop && B.caption) B.caption = { ...B.caption, y: up0 };
      const head = atTop ? up0 : up0 + capRoom, foot = atTop ? bottom : dn0;
      const free = atTop ? { y0: Math.max(head, cy + R + gap), y1: foot } : { y0: head, y1: Math.min(foot, cy - R - gap) };
      // too little room under or over the sun: the sun gives way (smaller), never the text
      const want = Math.min(area.h * 0.55, Math.max(W * 0.3, (winH ? winH + gap : 0) + W * 0.28));
      if (free.y1 - free.y0 < want) {
        const r2 = atTop ? Math.max(W * 0.2, foot - want - gap - cy) : Math.max(W * 0.2, cy - (head + want + gap));
        plan.focus.r = Math.min(R, r2);
        if (atTop) free.y0 = Math.max(head, cy + plan.focus.r + gap); else free.y1 = Math.min(foot, cy - plan.focus.r - gap);
      }
      const infoH = pairs ? winH + gap : 0;
      B.title = { x: M, y: free.y0, w: textW, h: Math.max(0, free.y1 - free.y0 - infoH) };
      pos.title = atTop ? 'top' : 'bottom';
      if (pairs) B.info = infoAt(atTop ? free.y1 - winH : free.y0, right);
      if (!atTop && pairs) B.title = { ...B.title, y: free.y0 + infoH };
      return plan;
    }
    // orb: a wire sphere above, the title under it (the sphere keeps off the type's glyphs)
    const s = Math.round(Math.min(textW * 0.9, area.h * 0.5) * (0.75 + ur * 0.25));
    const sy = up0 + Math.round(area.h * 0.02);
    plan.focus = { x: pg.w / 2, y: sy + s / 2, r: s / 2 };
    B.graphic = { x: 0, y: 0, w: pg.w, h: pg.h };
    const ty = sy + Math.round(s * 0.8);
    const infoH = pairs ? winH + gap : 0;
    B.title = { x: M, y: ty, w: textW, h: Math.max(0, bottom - infoH - ty) };
    pos.title = 'middle';
    if (pairs) B.info = infoAt(bottom - winH, right);
    return plan;
  },
};
