/**
 * Vaporwave graphics (spec 8.0, 8.4). Each design has a first graphic and a second, counted by the variety tests
 * in that order: with a horizon, the thing in the sky (the slit sun, a wire sphere, rings in a disc) and the floor
 * (the grid, a checker floor, waves, dots); without one, the layout's own graphic (a window stack, the tunnel, the
 * huge sun, the orb) and a second from its list. Stars, the horizon glow, horizon mountains and gradient bars come
 * on top; about six rolls in ten cut a further graphic into the disc the composition centres on, on a plate, and about
 * one in ten a third, a smaller disc inside that one (spec 8.0). Gradient bars behind a sun always run across (R9 S3);
 * a rings or dots floor is drawn flattened toward the horizon, as a ground plane (R9 M1).
 *
 * Every graphic but the sun keeps a halo off every glyph (knock-out, marked when placed and filled in after type),
 * so type may cross it; the sun's colours do not hold against either ink, so layout keeps type off the sun.
 * Everything here comes from the graphic stream and the plan, so it never moves text.
 */
import type { Form } from '../../../data/palettes/types';
import { bounds, pad, rectQuad, type Rect } from '../../geom';
import { GRAPHICS } from '../../graphics';
import { chooseParams, paramKey } from '../../graphics/params';
import { mkGraphic } from '../../items';
import { mix, pick } from '../../rng';
import type { GraphicItem } from '../../scene';
import type { GraphicsPart } from '../types';
import { cutControl, human, libraryControls, paramChoice, withDrawn } from '../../controls';

export const VAPOR_GRAPHICS = ['sun', 'grid', 'stars', 'horizon', 'sphere', 'checker', 'windows', 'gradbars', 'mountains', 'tunnel', 'rings', 'dots', 'waves'];
/** The first graphic with a horizon, and the floor. */
export const SKY_OBJECTS = ['sun', 'sun', 'sphere', 'rings', 'dots', 'gradbars', 'checker', 'waves'];
export const FLOORS = ['grid', 'checker', 'waves', 'dots', 'rings'];
/** The second graphic of each layout without a horizon (its first is fixed). */
// R9 S1: widened (windows +checker, grid, waves; sun-huge +checker; orb +waves, mountains): the field layouts were
// where the variety key repeated most. Not the sun in the tunnel (it would sit behind the title) nor rings on the
// huge sun (they are drawn on the focus disc, over it). Review bundle 4 M4: no mountains on the huge sun or the orb
// either; without a horizon they floated on a blank field as a stray zigzag (spec 8.4: horizon mountains)
export const SECOND: Record<string, { first: string; list: string[] }> = {
  windows: { first: 'windows', list: ['sun', 'sphere', 'gradbars', 'dots', 'rings', 'stars', 'checker', 'grid', 'waves'] },
  tunnel: { first: 'tunnel', list: ['stars', 'sphere', 'gradbars', 'dots', 'rings', 'checker', 'waves'] },
  'sun-huge': { first: 'sun', list: ['stars', 'gradbars', 'waves', 'dots', 'grid', 'checker'] },
  orb: { first: 'sphere', list: ['stars', 'grid', 'checker', 'rings', 'gradbars', 'dots', 'waves'] },
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
  // spec 8.4, 10.3 Graphic: the first graphic (with a horizon: the thing in the sky), the second (the floor, or the
  // layout's second), the extras off, how many cut in, and the parameters of each graphic drawn
  controls: (q) => {
    const sec = SECOND[q.scene.frame], uniq = (l: string[]) => [...new Set(l)];
    // what the design draws while unset (spec 10.3; review bundle 4 S1): the lead graphics in the order place() makes
    // them; with a horizon the sky object then the floor, else the layout's own graphic and its second
    const lead = q.scene.items.flatMap((g) => (g.kind === 'graphic' && g.lead && g.layer !== 'mark' ? [g.name] : []));
    const drawnFirst = sec ? undefined : lead[0], drawnSecond = sec ? lead.find((n) => n !== sec.first) : lead[1];
    return [
      ...(sec ? [] : [withDrawn(paramChoice('vapor.first', 'Sky', uniq(SKY_OBJECTS), (v) => human(String(v))), drawnFirst)]),
      withDrawn(paramChoice('vapor.second', sec ? 'Second' : 'Floor', uniq(sec ? sec.list : FLOORS), (v) => human(String(v))), drawnSecond),
      ...(sec ? [] : [paramChoice('vapor.extras', 'Extras', [0], () => 'Off')]),
      cutControl(),
      ...libraryControls(q, VAPOR_GRAPHICS),
    ];
  },
  place(c, plan) {
    const { P, W, spec, rg } = c, pg = plan.page, f = plan.focus;
    const horizonL = !!plan.boxes.sky, hz = horizonL ? plan.horizon : pg.h;
    const motif = spec.pick.motif && VAPOR_GRAPHICS.includes(spec.pick.motif) ? spec.pick.motif : null;
    const out: GraphicItem[] = [];
    let n = 0;
    const seed = () => mix(spec.seeds.graphic, 211 + n++);
    const prm = (name: string) => chooseParams(GRAPHICS[name], spec.params, rg);
    // a value this part sets for its own reasons, unless Advanced pinned that parameter (a pin always wins)
    const unpinned = (name: string, o: Record<string, number>) => Object.fromEntries(Object.entries(o).filter(([k]) => typeof spec.params[paramKey(name, k)] !== 'number'));
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

    // the decisions, in stream order: first, second, the extras, the cut-ins
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
    // not behind a sky object that is itself gradient bars (R9 M3: two sets of bars in one design)
    const barsOn = horizonL && first !== 'gradbars' && ((ub < 0.3 && extras !== 0) || motif === 'gradbars');
    // a cut-in is never the first or second graphic, nor gradient bars where they already stand behind the sun (R9 M3)
    const cuttable = (x: string) => x !== first && x !== second && !(barsOn && x === 'gradbars');
    const cutName = pick(rg, VAPOR_CUTS.filter(cuttable));
    const motifCut = motif && VAPOR_CUTS.includes(motif) && cuttable(motif) ? motif : null;
    const cutWhat = motifCut ?? cutName;
    // how many cut in (spec 8.0, the rule Swiss and Brutalist share): Advanced sets it, else about 6 in 10 one, 1 in 10
    // two; a picked cut-in graphic is drawn unless Advanced says none
    let cuts = typeof cutSet === 'number' ? Math.max(0, Math.min(2, Math.round(cutSet))) : uc < 0.1 ? 2 : uc < 0.62 ? 1 : 0;
    if (!cuts && motifCut && cutSet !== 0) cuts = 1;
    if (!f) cuts = 0;
    const cutK = 0.45 + 0.3 * rg();
    // the third: a smaller disc inside the cut-in, offset from its centre, of another cut graphic
    const cut3 = pick(rg, VAPOR_CUTS.filter((x) => cuttable(x) && x !== cutWhat)), u3a = rg(), u3k = rg();
    const third = (cx: number, cy: number, rc: number, floorY = Infinity) => {
      const r3 = rc * (0.38 + 0.17 * u3k), d = (rc - r3) * 0.7, a = u3a * Math.PI * 2;
      const y = Math.min(cy + d * Math.sin(a), floorY - r3 - 3);
      add(cut3, sq(cx + d * Math.cos(a), y, r3), { W: pg.w }, { on: A3of(P) !== P.ground ? A3of(P) : P.accent, cut: true });
    };

    // stars at the back, over the sky (or the whole field)
    const st = prm('stars'), spread = st.spread ?? GRAPHICS.stars.params.spread.def, starH = hz * spread + W * 0.0135 * (st.size ?? 1);
    if (horizonL || second !== 'stars') add('stars', { x: 0, y: 0, w: pg.w, h: hz }, { ...st, hz }, { extent: { x: 0, y: 0, w: pg.w, h: Math.min(hz, starH) } });

    if (horizonL && f) {
      const sky = plan.boxes.sky!, floor = plan.boxes.floor!;
      // gradient bars stand behind the sun only, as wide as it and a little more
      // they run across, thickest at the top and thinning toward the horizon: drawn down they stood as a fence (R9 S3)
      if (barsOn) { const y = Math.max(0, f.y - f.r * 0.5), x = Math.max(0, f.x - f.r * 1.35), gp = prm('gradbars'); add('gradbars', { x, y, w: Math.min(pg.w, f.x + f.r * 1.35) - x, h: hz - y }, unpinned('gradbars', { angle: 0, prog: Math.max(0.5, gp.prog ?? 0.7), grow: 0 })); }
      // the thing in the sky, on the focus, clipped by the horizon
      if (first === 'sun') add('sun', sky, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), sky), lead: true, knock: false });
      else if (first === 'sphere') add('sphere', sky, { x: f.x, y: f.y, r: f.r }, { extent: clip(sq(f.x, f.y, f.r), sky), lead: true });
      else { const cy = Math.min(f.y, hz - f.r - 2); add(first, sq(f.x, cy, f.r), {}, { on: first === 'rings' ? P.accent : A3of(P), cut: true, lead: true }).layer = 'back'; }
      if (cuts) {
        // a sun low on the horizon leaves little disc above it: the cut-in keeps at least 0.3 of the radius and rises
        // to clear the horizon, rather than being dropped (R9 S4: graphics.cut 1 always draws one)
        const cy0 = first !== 'sun' && first !== 'sphere' ? Math.min(f.y, hz - f.r - 2) : f.y, rc = Math.min(f.r * cutK, Math.max(f.r * 0.3, hz - cy0 - 3));
        const cy = Math.min(cy0, hz - rc - 3);
        add(cutWhat, sq(f.x, cy, rc), { W: pg.w }, { on: P.ground, cut: true });
        if (cuts > 1) third(f.x, cy, rc, hz);
      }
      if (mountainsOn) { const mh = Math.round(W * 0.16); add('mountains', { x: 0, y: hz - mh, w: pg.w, h: mh }); }
      // rings and dots as a floor: flattened toward the horizon, rings from the vanishing point below the sun, the dots
      // largest nearest the viewer (R9 M1: drawn flat they read as a target, not a ground)
      const flat: Record<string, number> = second === 'rings' ? { floor: 0.3, cx: f.x / pg.w, cy: 0 } : second === 'dots' ? { floor: 0.35, fx: f.x / pg.w, fy: 1, inv: 0 } : {};
      add(second, floor, unpinned(second, flat), { lead: true });
      add('horizon', { x: 0, y: hz - W * 0.03, w: W, h: W * 0.06 }, { hz });
    } else if (f) {
      const page: Rect = { x: 0, y: 0, w: pg.w, h: pg.h };
      const topSun = f.y < pg.h / 2;
      // the part of the page the focus does not take, for a second graphic that fills
      const rest: Rect = plan.frame === 'sun-huge' ? (topSun ? { x: 0, y: f.y + f.r, w: pg.w, h: Math.max(1, pg.h - f.y - f.r) } : { x: 0, y: 0, w: pg.w, h: Math.max(1, f.y - f.r) })
        // under the orb, from low on the sphere down: from its centre the second covered its lower half (R9 M4)
        : plan.frame === 'orb' ? { x: 0, y: f.y + f.r * 0.8, w: pg.w, h: Math.max(1, pg.h - f.y - f.r * 0.8) } : page;
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
        else g2(second, rest);
      };
      // the field's second graphic goes behind the first where it is a backdrop
      // the window stack stands in front of its backdrop, which is counted first; elsewhere the layout's own graphic is
      if (plan.frame === 'windows') { placeSecond(); placeFirst(); }
      else { placeFirst(); placeSecond(); }
      if (cuts) {
        add(cutWhat, sq(f.x, f.y, f.r * cutK), { W: pg.w }, { on: P.ground, cut: true });
        if (cuts > 1) third(f.x, f.y, f.r * cutK);
      }
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
