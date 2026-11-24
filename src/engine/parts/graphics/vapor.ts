/**
 * Vaporwave graphics (spec 8.0, 8.4). Each design has a first graphic and a second, counted by the variety tests
 * in that order: with a horizon, the thing in the sky (the slit sun, a wire sphere, rings in a disc) and the floor
 * (the grid, a checker floor, waves, dots); without one, the layout's own graphic (a window stack, the tunnel, the
 * huge sun, the orb) and a second from its list. Stars, the horizon glow, horizon mountains and gradient bars come
 * on top; about six rolls in ten cut a further graphic into the disc the composition centres on, on a plate.
 *
 * Every graphic but the sun keeps a halo off every glyph (knock-out, marked when placed and filled in after type),
 * so type may cross it; the sun's colours do not hold against either ink, so layout keeps type off the sun.
 * Everything here comes from the graphic stream and the plan, so it never moves text.
 */
import type { Form } from '../../../data/palettes/types';
import { bounds, pad, rectQuad, type Rect } from '../../geom';
import { GRAPHICS } from '../../graphics';
import { chooseParams } from '../../graphics/params';
import { mkGraphic } from '../../items';
import { mix, pick } from '../../rng';
import type { GraphicItem } from '../../scene';
import type { GraphicsPart } from '../types';

export const VAPOR_GRAPHICS = ['sun', 'grid', 'stars', 'horizon', 'sphere', 'checker', 'windows', 'gradbars', 'mountains', 'tunnel', 'rings', 'dots', 'waves'];
/** The first graphic with a horizon, and the floor. */
export const SKY_OBJECTS = ['sun', 'sun', 'sphere', 'rings', 'dots', 'gradbars', 'checker', 'waves'];
export const FLOORS = ['grid', 'checker', 'waves', 'dots', 'rings'];
/** The second graphic of each layout without a horizon (its first is fixed). */
export const SECOND: Record<string, { first: string; list: string[] }> = {
  windows: { first: 'windows', list: ['sun', 'sphere', 'gradbars', 'dots', 'rings', 'stars'] },
  tunnel: { first: 'tunnel', list: ['stars', 'sphere', 'gradbars', 'dots', 'rings', 'checker', 'waves'] },
  'sun-huge': { first: 'sun', list: ['stars', 'gradbars', 'waves', 'dots', 'mountains', 'grid'] },
  orb: { first: 'sphere', list: ['stars', 'grid', 'checker', 'rings', 'gradbars', 'dots'] },
};
/** What may be cut into the focus disc (spec 8.0 combination). */
export const VAPOR_CUTS = ['dots', 'waves', 'gradbars', 'checker', 'rings'];

const A3of = (P: Form) => P.accent3 ?? P.accent;

/** Colours of each graphic, from the palette's roles; `on` is the plate it sits on, if any. */
function coloursOf(name: string, P: Form, on?: string): Record<string, string> {
  const sky = P.gradient ?? [P.ground, P.ground], A2 = P.accent2 ?? P.accent, A3 = P.accent3 ?? P.accent;
  const hot = on ? [A3, P.accent, A2, P.ink].find((x) => x !== on) ?? A3 : A2;
  switch (name) {
    case 'sun': return { accent3: A3, accent: P.accent, sky1: sky[1] ?? sky[0] };
    case 'stars': return { ink: P.ink, ground: P.ground };
    case 'horizon': return { accent: P.accent };
    case 'grid': case 'tunnel': case 'sphere': return { line: on ? hot : name === 'sphere' ? P.accent : A2 };
    case 'checker': return { a: hot, b: on ?? P.ground };
    case 'windows': return { window: P.window ?? P.ground, bar: sky[1] ?? sky[0], ink: P.windowInk ?? P.ink, shadow: P.accent };
    case 'gradbars': return { a: P.accent, b: on ? hot : A3 };
    case 'mountains': return { fill: P.ground, line: A2 };
    default: return { a: hot, ink: on ? (P.accent !== on ? P.accent : A3) : P.accent };   // rings, dots, waves
  }
}

export const vaporGraphics: GraphicsPart = {
  id: 'vapor', uses: VAPOR_GRAPHICS, vocab: VAPOR_GRAPHICS, motifs: VAPOR_GRAPHICS,
  // a picked graphic is drawn in a layout that carries it (the tests force each graphic this way)
  pickFor: (name) => ({ motif: name, layout: name === 'tunnel' ? 'tunnel' : name === 'windows' ? 'windows' : 'title-floor' }),
  place(c, plan) {
    const { P, W, spec, rg } = c, pg = plan.page, f = plan.focus;
    const horizonL = !!plan.boxes.sky, hz = horizonL ? plan.horizon : pg.h;
    const motif = spec.pick.motif && VAPOR_GRAPHICS.includes(spec.pick.motif) ? spec.pick.motif : null;
    const out: GraphicItem[] = [];
    let n = 0;
    const seed = () => mix(spec.seeds.graphic, 211 + n++);
    const prm = (name: string) => chooseParams(GRAPHICS[name], spec.params, rg);
    const add = (name: string, box: Rect, extra: Record<string, number> = {}, o: { extent?: Rect; on?: string; cut?: boolean; lead?: boolean; knock?: boolean } = {}) => {
      const C = coloursOf(name, P, o.on);
      const g = mkGraphic(name, box, seed(), 0, C, [...new Set(Object.values(C))], { W: pg.w, ...prm(name), ...extra }, { extent: o.extent });
      g.layer = o.cut ? 'front' : 'back';
      if (o.cut) { g.cut = 'disc'; g.plate = o.on; g.fills = [...new Set([...g.fills, o.on!])]; }
      if (o.lead) g.lead = true;
      // marked here, filled in after type: this graphic keeps a halo off every glyph
      if (o.knock !== false) g.knock = { glyphs: [], boxes: [], pad: 0 };
      out.push(g);
      return g;
    };
    const clip = (r: Rect, to: Rect): Rect => { const x = Math.max(r.x, to.x), y = Math.max(r.y, to.y); return { x, y, w: Math.max(0, Math.min(r.x + r.w, to.x + to.w) - x), h: Math.max(0, Math.min(r.y + r.h, to.y + to.h) - y) }; };
    const sq = (x: number, y: number, r: number): Rect => ({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });

    // the decisions, in stream order: first, second, the extras, the cut-in
    const sec = SECOND[plan.frame];
    const um = rg(), ub = rg(), uc = rg();
    let first = sec ? sec.first : pick(rg, SKY_OBJECTS);
    let second = pick(rg, sec ? sec.list : FLOORS);
    if (!sec && second === first) second = first === 'grid' ? 'checker' : 'grid';
    // Advanced (and the refs): the first and second graphic by name, the extras off, how many cut-ins
    const setFirst = spec.params['vapor.first'], setSecond = spec.params['vapor.second'], extras = spec.params['vapor.extras'], cutSet = spec.params['graphics.cut'];
    if (!sec && typeof setFirst === 'string' && SKY_OBJECTS.includes(setFirst)) first = setFirst;
    if (typeof setSecond === 'string' && (sec ? sec.list : FLOORS).includes(setSecond)) second = setSecond;
    if (motif && !sec && SKY_OBJECTS.includes(motif)) first = motif;
    else if (motif && sec && sec.list.includes(motif)) second = motif;
    else if (motif && !sec && FLOORS.includes(motif)) second = motif;
    const mountainsOn = horizonL && ((um < 0.35 && extras !== 0) || motif === 'mountains');
    const barsOn = horizonL && ((ub < 0.3 && extras !== 0) || motif === 'gradbars');
    const cutName = pick(rg, VAPOR_CUTS.filter((x) => x !== first && x !== second));
    const cutOn = !!f && cutSet !== 0 && (uc < 0.6 || (typeof cutSet === 'number' && cutSet >= 1) || motif === cutName || (motif !== null && VAPOR_CUTS.includes(motif) && ![first, second].includes(motif)));
    const cutK = 0.45 + 0.3 * rg();
    const cutWhat = motif && VAPOR_CUTS.includes(motif) && ![first, second].includes(motif) ? motif : cutName;

    // stars at the back, over the sky (or the whole field)
    const st = prm('stars'), spread = st.spread ?? GRAPHICS.stars.params.spread.def, starH = hz * spread + W * 0.0135 * (st.size ?? 1);
    if (horizonL || second !== 'stars') add('stars', { x: 0, y: 0, w: pg.w, h: hz }, { ...st, hz }, { extent: { x: 0, y: 0, w: pg.w, h: Math.min(hz, starH) } });

    if (horizonL && f) {
      const sky = plan.boxes.sky!, floor = plan.boxes.floor!;
      // gradient bars stand behind the sun only, as wide as it and a little more
      if (barsOn) { const y = Math.max(0, f.y - f.r * 0.5), x = Math.max(0, f.x - f.r * 1.35); add('gradbars', { x, y, w: Math.min(pg.w, f.x + f.r * 1.35) - x, h: hz - y }); }
      // the thing in the sky, on the focus, clipped by the horizon
      if (first === 'sun') add('sun', sky, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), sky), lead: true, knock: false });
      else if (first === 'sphere') add('sphere', sky, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), sky), lead: true });
      else { const cy = Math.min(f.y, hz - f.r - 2); add(first, sq(f.x, cy, f.r), {}, { on: first === 'rings' ? P.accent : A3of(P), cut: true, lead: true }).layer = 'back'; }
      if (cutOn) {
        const cy = first !== 'sun' && first !== 'sphere' ? Math.min(f.y, hz - f.r - 2) : f.y, rc = Math.min(f.r * cutK, hz - cy - 3);
        if (rc > f.r * 0.25) add(cutWhat, sq(f.x, cy, rc), { W: pg.w }, { on: P.ground, cut: true });
      }
      if (mountainsOn) { const mh = Math.round(W * 0.16); add('mountains', { x: 0, y: hz - mh, w: pg.w, h: mh }); }
      add(second, floor, {}, { lead: true });
      add('horizon', { x: 0, y: hz - W * 0.03, w: W, h: W * 0.06 }, { hz });
    } else if (f) {
      const page: Rect = { x: 0, y: 0, w: pg.w, h: pg.h };
      const topSun = f.y < pg.h / 2;
      // the part of the page the focus does not take, for a second graphic that fills
      const rest: Rect = plan.frame === 'sun-huge' ? (topSun ? { x: 0, y: f.y + f.r, w: pg.w, h: Math.max(1, pg.h - f.y - f.r) } : { x: 0, y: 0, w: pg.w, h: Math.max(1, f.y - f.r) })
        : plan.frame === 'orb' ? { x: 0, y: f.y, w: pg.w, h: pg.h - f.y } : page;
      const placeFirst = () => {
        if (first === 'windows') add('windows', { x: plan.margin * 0.5, y: plan.margin, w: pg.w - plan.margin, h: pg.h - 2 * plan.margin }, {}, { lead: true });
        else if (first === 'tunnel') add('tunnel', page, {}, { lead: true });
        else if (first === 'sun') add('sun', page, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), page), lead: true, knock: false });
        else add('sphere', page, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), page), lead: true });
      };
      const placeSecond = () => {
        const g2 = (name: string, box: Rect, extra: Record<string, number> = {}, o: Parameters<typeof add>[3] = {}) => add(name, box, extra, { lead: true, ...o });
        if (second === 'stars') g2('stars', page, { ...st, hz: pg.h }, { extent: { x: 0, y: 0, w: pg.w, h: Math.min(pg.h, pg.h * spread + W * 0.0135 * (st.size ?? 1)) } });
        else if (second === 'sun') g2('sun', page, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), page), knock: false });
        else if (second === 'sphere') g2('sphere', page, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), page) });
        else if (second === 'rings') g2('rings', sq(f.x, f.y, f.r * (plan.frame === 'orb' ? 0.5 : 1)), {}, { on: P.accent, cut: true }).layer = 'back';
        else if (second === 'gradbars') g2('gradbars', plan.frame === 'tunnel' ? { x: 0, y: 0, w: pg.w, h: Math.round(pg.h * 0.2) } : plan.frame === 'windows' ? { x: 0, y: Math.max(0, f.y - f.r), w: pg.w, h: 2 * f.r } : rest);
        else if (second === 'mountains') { const mh = Math.round(W * 0.2); g2('mountains', topSun ? { x: 0, y: pg.h - mh, w: pg.w, h: mh } : { x: 0, y: Math.max(0, f.y - f.r - mh), w: pg.w, h: mh }); }
        else g2(second, rest);
      };
      // the field's second graphic goes behind the first where it is a backdrop
      // the window stack stands in front of its backdrop, which is counted first; elsewhere the layout's own graphic is
      if (plan.frame === 'windows') { placeSecond(); placeFirst(); }
      else { placeFirst(); placeSecond(); }
      if (cutOn) add(cutWhat, sq(f.x, f.y, f.r * cutK), { W: pg.w }, { on: P.ground, cut: true });
    }
    return out;
  },
  after(c, _plan, items) {
    // every marked graphic keeps a halo off every glyph, so nothing it draws lies directly behind the type
    const knockPad = Math.round(c.W * 0.012);
    const holes: ReturnType<typeof rectQuad>[] = [], glyphs: number[] = [], boxes: ReturnType<typeof rectQuad>[] = [];
    items.forEach((t, i) => {
      if (t.kind !== 'text') return;
      const box = rectQuad(pad(bounds(t.quad), knockPad));
      holes.push(box);
      if (t.px >= 60) glyphs.push(i); else boxes.push(box);
    });
    // the holes never overlap one another: where the platform has no offscreen layer, paint cuts them with an
    // even-odd clip, and two overlapping holes would cancel where they cross (padded title and subtitle boxes)
    const merged = mergeRects(holes.map(bounds)).map(rectQuad);
    for (const g of items) if (g.kind === 'graphic' && g.knock && g.layer !== 'mark') { (g as GraphicItem).avoid = merged; g.knock = { glyphs, boxes, pad: knockPad }; }
  },
};


/** Overlapping rects joined into their bounding rects until none overlap. */
function mergeRects(rs: Rect[]): Rect[] {
  const out = rs.map((r) => ({ ...r }));
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) for (let j = i + 1; j < out.length && !changed; j++) {
      const a = out[i], b = out[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        out[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
        out.splice(j, 1);
        changed = true;
      }
    }
  }
  return out;
}
