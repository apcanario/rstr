/**
 * Advanced controls (spec 10.3), as data. Each part lists the controls it has (`controls` on the part), the finish
 * and the marks layer list theirs, and this module gathers them per tab for the design on screen, so the app draws
 * them without knowing any style: a style shows only the controls it has. Every control writes a `pick`, a `params`
 * value or a slot's position; a value set by hand belongs to one facet (or none) and Shuffle clears it unless that
 * facet is locked (spec 10.3, `facetOfParam`).
 *
 * Nothing here draws or chooses at random; reading and writing a control are pure functions of the spec.
 */
import { leadsOf } from './spec';
import { PAIRINGS } from '../data/pairings';
import type { Form } from '../data/palettes';
import { GRAPHICS } from './graphics';
import { paramKey } from './graphics/params';
import type { Scene } from './scene';
import { COLOUR_ROLES, type ColourRole, type Facet, type Slot, type Spec } from './spec';
import { isTreatment, paletteColours, TREAT_PARAMS, TREAT_RANGE, TREATMENT_LABEL, treatOffered, TREATMENTS, treatPairs, TWO_COLOUR, type Treatment } from './treat';

const paletteCount = (P: Form) => paletteColours(P).length;

/** The Advanced tabs (spec 10.3). */
export const ADV_TABS = ['style', 'layout', 'graphic', 'type', 'colour', 'text', 'photo'] as const;
export type AdvTab = (typeof ADV_TABS)[number];

/** Where a control's value lives in the spec. */
export type Where =
  | { at: 'params'; key: string }
  | { at: 'pick'; key: 'layout' | 'motif' | 'palette' | 'pairing' | 'dialect' }
  | { at: 'pos'; slot: Slot }
  /** A text layer's place beyond the slots (spec 8.6, 10.3): `pos` of the layer with this id. */
  | { at: 'layer'; id: string }
  /** Where the photo sits (spec 8.9, 10.3 Photo): a field of `photo.place`. */
  | { at: 'photo'; key: 'role' | 'scale' | 'x' | 'y' }
  /** The photo's treatment (spec 8.9, R15): `photo.treatment`, the graphic stream's while unset. */
  | { at: 'treatment' };
/** A control's value: null is unset (the seed decides). */
export type Value = string | number | boolean | null;

interface Base {
  /** Unique within the design's controls; the app's test hook. */
  id: string;
  label: string;
  where: Where;
  /** The facet whose Shuffle clears it (null: kept through Shuffle, like the finish and marks themselves, spec 3). */
  facet: Facet | null;
  /** A write with more to it than setting the value (Dialect drops a picked layout of the other dialect). */
  set?: (s: Spec, v: Value) => Spec;
}
/** One of a list; `null` among the options is Auto. `drawn`: the option the design draws while unset (review R10 M6). */
export interface Choice extends Base { kind: 'choice'; options: { v: Value; label: string }[]; drawn?: Value; }
/** A number between two ends; unset draws `shown` (what the design has now), if known. `log`: the slider runs in log space (scale-like parameters, review R10 M2). */
export interface Ranged extends Base { kind: 'range'; min: number; max: number; step: number; shown?: number; log?: boolean; }
/** On while unset; off writes `off`. */
export interface Switch extends Base { kind: 'switch'; off: Value; onLabel: string; offLabel: string; }
export type Control = Choice | Ranged | Switch;

/** One colour of the design on screen (spec 5): the roles that share it, the palette's value and the one drawn. */
export interface DesignColour { roles: ColourRole[]; base: string; now: string; label: string; }

/** What a part's control list is made from: the spec and the Scene drawn from it. */
export interface ControlQuery { spec: Spec; scene: Scene; }

// ---------------------------------------------------------------------------------------------------------------
// reading and writing

export function read(s: Spec, w: Where): Value {
  if (w.at === 'params') return w.key in s.params ? s.params[w.key] : null;
  if (w.at === 'pick') return s.pick[w.key] ?? null;
  if (w.at === 'photo') return s.photo?.place?.[w.key] ?? null;
  if (w.at === 'treatment') return s.photo?.treatment ?? null;
  if (w.at === 'layer') return s.text.find((l) => l.id === w.id)?.pos ?? null;
  return leadsOf(s.text)[w.slot]?.pos ?? null;
}

/** The spec with one control's value set; null clears it. Never touches anything else. */
export function write(s: Spec, w: Where, v: Value): Spec {
  if (w.at === 'params') {
    const params = { ...s.params };
    if (v === null) delete params[w.key]; else params[w.key] = v;
    return { ...s, params };
  }
  if (w.at === 'pick') return { ...s, pick: { ...s.pick, [w.key]: v === null ? null : String(v) } };
  if (w.at === 'photo') {
    if (!s.photo) return s;
    const place: Record<string, unknown> = { ...(s.photo.place ?? {}) };
    if (v === null) delete place[w.key]; else place[w.key] = v;
    return { ...s, photo: { ...s.photo, place: Object.keys(place).length ? (place as never) : null } };
  }
  if (w.at === 'treatment') return s.photo ? { ...s, photo: { ...s.photo, treatment: v === null ? null : String(v) } } : s;
  if (w.at === 'layer') return { ...s, text: s.text.map((l) => (l.id === w.id ? { ...l, pos: v === null ? null : String(v) } : l)) };
  // a position belongs to the lead layer of the slot's level (spec 8.6)
  const lead = leadsOf(s.text)[w.slot];
  if (!lead) return s;
  return { ...s, text: s.text.map((l) => (l.id === lead.id ? { ...l, pos: v === null ? null : String(v) } : l)) };
}

export const apply = (s: Spec, c: Control, v: Value): Spec => (c.set ? c.set(s, v) : write(s, c.where, v));

/**
 * The facet a params key belongs to (spec 10.3): layout.* to Layout; g.*, graphics.*, vapor.* and photo.* to Graphic; type.*
 * and the Paper edge to Type. Finish strengths and the marks allowed are settings outside the four facets, as the
 * finish and the marks level are (spec 3): Shuffle keeps them.
 */
export function facetOfParam(k: string): Facet | null {
  if (k.startsWith('layout.')) return 'layout';
  // the photo's treatment parameters (R15) are the graphic stream's, as the treatment is (spec 3)
  if (k.startsWith('g.') || k.startsWith('graphics.') || k.startsWith('vapor.') || k.startsWith('photo.')) return 'graphic';
  if (k.startsWith('type.') || k === 'pomo.paperEdge') return 'type';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// builders the parts use

export const human = (id: string) => (id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ') : '');

export function choice(id: string, label: string, where: Where, facet: Facet | null, values: readonly Value[], labels: (v: Value) => string = (v) => human(String(v)), auto = true): Choice {
  return { kind: 'choice', id, label, where, facet, options: [...(auto ? [{ v: null, label: 'Auto' }] : []), ...values.map((v) => ({ v, label: labels(v) }))] };
}
export const paramChoice = (key: string, label: string, values: readonly Value[], labels?: (v: Value) => string): Choice =>
  choice(key, label, { at: 'params', key }, facetOfParam(key), values, labels);

/** Shared by every layout part that reads them (spec 8.0): the transform and the title size class. */
export const transformControl = (options: readonly string[] = ['none', 'tilt', 'quarter']) => paramChoice('layout.transform', 'Turn', options, (v) => ({ none: 'None', tilt: 'Tilt', quarter: 'Quarter' })[String(v)] ?? String(v));
export const sizeControl = (options: readonly string[] = ['small', 'normal', 'oversize']) => paramChoice('layout.size', 'Title', options, (v) => ({ small: 'Small', normal: 'Normal', oversize: 'Over' })[String(v)] ?? String(v));
export const layoutPicker = (layouts: readonly string[]) => choice('pick.layout', 'Layout', { at: 'pick', key: 'layout' }, 'layout', layouts);
export const motifPicker = (motifs: readonly string[], label = 'First') => choice('pick.motif', label, { at: 'pick', key: 'motif' }, 'graphic', motifs);
/** How many graphics cut into the first (spec 8.0): `graphics.cut`, 0, 1 or 2. */
export const cutControl = () => paramChoice('graphics.cut', 'Cut in', [0, 1, 2], (v) => String(v));
/**
 * The Graphic tab of a style that cuts graphics into its first (spec 8.0, 10.3: first and second graphic pickers, how
 * the second is cut in): the first graphic; then, where the design draws a graphic, how many cut in, the second (the
 * first cut-in, never the first graphic) and its shape, unless Advanced set no cut-in; and the library parameters.
 * The first graphic is hidden only where a picked layout draws none: unpicked, a picked graphic can move the layout.
 */
export function cutControls(q: ControlQuery, list: readonly string[], cuts: readonly string[], shapesFor: (first: string) => readonly string[], labels: Record<string, string>): Control[] {
  const first = q.scene.graphics[0], drawn = !!first && list.includes(first);
  if (!drawn) return q.spec.pick.layout ? [] : [motifPicker(list, 'Graphic')];
  const none = q.spec.params['graphics.cut'] === 0;
  // the second shows the first cut-in the design draws while unset (spec 10.3; review bundle 4 S1)
  const cutIn = q.scene.items.find((g) => g.kind === 'graphic' && g.layer !== 'mark' && !!g.cut && g.name !== first);
  return [
    motifPicker(list, 'Graphic'), cutControl(),
    ...(none ? [] : [
      withDrawn(paramChoice('graphics.second', 'Second', list.filter((n) => n !== first)), cutIn?.kind === 'graphic' ? cutIn.name : undefined),
      paramChoice('graphics.cutShape', 'Cut as', shapesFor(first).filter((x) => cuts.includes(x)), (v) => labels[String(v)] ?? human(String(v))),
    ]),
    ...libraryControls(q, list),
  ];
}
/** A choice that shows `v` while unset (spec 10.3: a stepper shows what the design draws), where `v` is one of its options. */
export function withDrawn(c: Choice, v: Value | undefined): Choice {
  return v !== undefined && v !== null && c.options.some((o) => o.v === v) ? { ...c, drawn: v } : c;
}
/** How the type part scales its title's start size (1: the style's own; every later candidate tries smaller from it). */
export const TYPE_CAP = { min: 0.6, max: 1 };
export const capControl = (): Ranged => ({ kind: 'range', id: 'type.cap', label: 'Size cap', where: { at: 'params', key: 'type.cap' }, facet: 'type', min: TYPE_CAP.min, max: TYPE_CAP.max, step: 0.05, shown: 1 });
export const typeCap = (s: Spec): number => {
  const v = s.params['type.cap'];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(TYPE_CAP.min, Math.min(TYPE_CAP.max, v)) : 1;
};
/** Positions of each slot a layout part lists (spec 8.5): Text tab. */
/** The place of a text layer beyond the slots (spec 8.6, 10.3), from its level's places in the style: Auto, Head, Foot. */
export const layerPlaceControl = (id: string, places: readonly string[]): Choice => choice('layer.' + id, 'Place', { at: 'layer', id }, 'layout', places);

export function positionControls(pos: Partial<Record<Slot, string[]>>): Choice[] {
  return (Object.entries(pos) as [Slot, string[]][]).map(([slot, list]) => choice('pos.' + slot, 'Place', { at: 'pos', slot }, 'layout', list));
}

/** Labels for the library's parameter names that do not read as words. */
const PARAM_LABEL: Record<string, string> = { fx: 'Centre x', fy: 'Centre y', cx: 'Centre x', cy: 'Centre y', inv: 'Invert', sat: 'Fill', prog: 'Progress', arms: 'Arms', kind: 'Pattern' };
const paramLabel = (k: string) => PARAM_LABEL[k] ?? human(k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());

/**
 * The library parameters of the graphics a part draws (spec 10.3: density, scale, line weight, angle): one range per
 * parameter of each graphic drawn in the design on screen, writing `g.<graphic>.<param>` (every placement of that
 * graphic takes it). `uses` is the part's list; a graphic it does not draw has no control.
 */
export function libraryControls(q: ControlQuery, uses: readonly string[]): Ranged[] {
  const out: Ranged[] = [], seen = new Set<string>();
  for (const it of q.scene.items) {
    if (it.kind !== 'graphic' || it.layer === 'mark' || !uses.includes(it.name) || seen.has(it.name) || !GRAPHICS[it.name]) continue;
    seen.add(it.name);
    for (const [k, R] of Object.entries(GRAPHICS[it.name].params)) {
      const key = paramKey(it.name, k), v = it.params[k];
      out.push({ kind: 'range', id: key, label: paramLabel(k), where: { at: 'params', key }, facet: 'graphic', min: R.min, max: R.max,
        step: R.int ? 1 : (R.max - R.min) / 100, shown: typeof v === 'number' ? v : R.def, ...(R.log && R.min > 0 && !R.int ? { log: true } : {}) });
    }
  }
  return out;
}

/**
 * The treatment (spec 8.9, 10.2 Treatment tiles, R15): Auto and the seven, any of them by hand (the style's list is
 * what the graphic stream draws from). Graphic's facet: the graphic stream picks it (spec 3). `drawn`: the one drawn.
 * `form`: the palette form drawn; a treatment it cannot draw (posterise with fewer than three colours, review R15 S1)
 * is not offered.
 */
export function treatmentControl(drawn?: string, form?: Form): Choice {
  const list = form ? TREATMENTS.filter((t) => treatOffered(t, form)) : TREATMENTS;
  return withDrawn(choice('photo.treatment', 'Treatment', { at: 'treatment' }, 'graphic', list, (v) => TREATMENT_LABEL[v as Treatment] ?? String(v)), drawn);
}

/**
 * The treatment's parameters (spec 10.3 Photo: duotone roles, halftone screen, threshold level; and the rest), for the
 * treatment drawn: `photo.<name>` params, Graphic's facet. Each shows what the design draws while unset.
 */
export function treatControls(g: { params: Record<string, unknown> }, P: Form): Control[] {
  const t = g.params.treat;
  if (!isTreatment(t)) return [];
  const out: Control[] = [];
  if (TWO_COLOUR.includes(t)) {
    const pairs = treatPairs(P);
    if (pairs.length > 1) out.push(withDrawn(choice('photo.duo', 'Colours', { at: 'params', key: 'photo.duo' }, 'graphic', pairs, (v) => String(v).split('+').map((r) => ROLE_LABEL[r as ColourRole] ?? human(r)).join(' + ')), g.params.duo as string | undefined));
  }
  const LABEL: Record<string, string> = { contrast: 'Contrast', screen: 'Screen', angle: 'Angle', level: 'Level', levels: 'Colours', dot: 'Pixel' };
  for (const k of TREAT_PARAMS[t]) {
    const R = TREAT_RANGE[k], key = 'photo.' + k;
    // sizes are recorded in scene px; the control speaks px at 1080 wide
    const v = Number(g.params[k]), shown = k === 'screen' || k === 'dot' ? v / (Number(g.params.k) || 1) : v;
    if (k === 'levels') {
      const n = paletteCount(P), opts = [3, 4, 5].filter((x) => x <= n);
      if (opts.length > 1) out.push(withDrawn(choice(key, LABEL[k], { at: 'params', key }, 'graphic', opts, (x) => String(x)), Number.isFinite(v) ? v : undefined));
      continue;
    }
    out.push({ kind: 'range', id: key, label: LABEL[k], where: { at: 'params', key }, facet: 'graphic', min: R.min, max: R.max, step: k === 'angle' ? 1 : (R.max - R.min) / 100,
      ...(Number.isFinite(shown) ? { shown: Math.max(R.min, Math.min(R.max, shown)) } : {}), ...(k === 'screen' ? { log: true } : {}) });
  }
  return out;
}

/**
 * The Photo tab (spec 10.3: role, scale, offset; the treatment and its parameters, R15). Role, scale and offset are
 * Layout's facet: the layout stream places the photo (spec 3), so Shuffle clears them unless Layout is locked; the
 * treatment and its parameters are Graphic's. Only on a design that draws a photo; unset, each shows what the design
 * draws. `form`: the palette form the design is drawn with (the treatment's colour pairs).
 */
export function photoControls(q: ControlQuery, form?: Form): Control[] {
  const g = q.scene.items.find((i) => i.kind === 'graphic' && i.name === 'photo');
  if (!q.spec.photo || !g || g.kind !== 'graphic') return [];
  const P = g.params as Record<string, number | string>, b = g.box;
  // the offset as a share of the room the scale leaves, per axis (review R14 S6: a square box read x for both)
  const room = (axis: 'x' | 'y') => {
    const d = axis === 'x' ? b.w : b.h, size = Number(axis === 'x' ? P.w : P.h), at = axis === 'x' ? b.x : b.y;
    return size - d > 0.5 ? (at - Number(P[axis])) / (size - d) : 0.5;
  };
  const sx = room('x'), sy = room('y');
  const role = withDrawn(choice('photo.role', 'Role', { at: 'photo', key: 'role' }, 'layout', ['ground', 'box', 'disc', 'column', 'band'],
    (v) => ({ ground: 'Ground', box: 'In box', disc: 'Disc', column: 'Column', band: 'Band' })[String(v)] ?? String(v)), String(P.role));
  const range = (key: 'scale' | 'x' | 'y', label: string, min: number, max: number, shown: number | undefined, log = false): Ranged =>
    ({ kind: 'range', id: 'photo.' + key, label, where: { at: 'photo', key }, facet: 'layout', min, max, step: (max - min) / 100, ...(shown !== undefined && Number.isFinite(shown) ? { shown: Math.max(min, Math.min(max, shown)) } : {}), ...(log ? { log: true } : {}) });
  return [role, range('scale', 'Scale', 1, 2.5, Number(P.scale), true), range('x', 'Across', 0, 1, sx), range('y', 'Down', 0, 1, sy),
    treatmentControl(String(P.treat), form), ...(form ? treatControls(g, form) : [])];
}

/** The style's pairings by full name (spec 6; the Type lock shows only the display family, review R4 M6). */
export const pairingPicker = (s: Spec) => choice('pick.pairing', 'Pairing', { at: 'pick', key: 'pairing' }, 'type', PAIRINGS[s.style].map((p) => p.id), (v) => PAIRINGS[s.style].find((p) => p.id === v)?.name ?? String(v));

// ---------------------------------------------------------------------------------------------------------------
// colours (spec 5, edit for this design)

// the second and third accents are short: 'Accent 2' was cut to 'Accent…' on a 360 px swatch (review bundle 4 M7)
const ROLE_LABEL: Record<ColourRole, string> = { ground: 'Ground', ink: 'Ink', accent: 'Accent', accent2: 'Acc 2', accent3: 'Acc 3', paper: 'Paper', toner: 'Toner', spot: 'Spot', window: 'Window', windowInk: 'Window ink', chrome: 'Chrome' };
/** At most this many colours are listed (spec 5: the three to five colours of the design). */
export const MAX_COLOURS = 5;

/** The palette's form with this design's edits for its mode. */
export function editedForm(P: Form, s: Spec): Form {
  const e = s.pick.colours?.[P.mode];
  return e ? { ...P, ...e } : P;
}

/** Every colour string an item can paint with, lower case, with how many items paint with it (the ground counts once). */
export function colourUse(sc: Scene): Map<string, number> {
  const out = new Map<string, number>();
  const one = (set: Set<string>) => { for (const c of set) out.set(c, (out.get(c) ?? 0) + 1); };
  const add = (set: Set<string>, p: unknown) => {
    if (typeof p === 'string') set.add(p.toLowerCase());
    else if (p && typeof p === 'object' && 'stops' in p) for (const [, c] of (p as { stops: [number, string][] }).stops) set.add(c.toLowerCase());
  };
  one(new Set([sc.ground.toLowerCase()]));
  for (const it of sc.items) {
    const set = new Set<string>();
    if (it.kind === 'text') { add(set, it.fill); add(set, it.stroke?.paint); it.echoes?.forEach((e) => { add(set, e.paint); add(set, e.halo); }); }
    else if (it.kind === 'rect') { add(set, it.fill); add(set, it.shadow?.fill); add(set, it.stroke?.colour); }
    else { Object.values(it.colours).forEach((c) => add(set, c)); it.fills.forEach((c) => add(set, c)); add(set, it.plate); }
    one(set);
  }
  return out;
}
export const sceneColours = (sc: Scene): Set<string> => new Set(colourUse(sc).keys());

/**
 * The colours of a design (spec 5: three to five), read off the Scene drawn with the palette's own colours: the
 * palette roles it paints with, roles of one colour together, the most used first, at most MAX_COLOURS, listed in role
 * order. Layout records them on the Scene (`designRoles`) before any edit, so the list does not move as colours change.
 */
export function designRoles(P: Form, sc: Scene): ColourRole[][] {
  const use = colourUse(sc), groups: { roles: ColourRole[]; n: number; at: number }[] = [];
  COLOUR_ROLES.forEach((r, at) => {
    const hex = P[r]?.toLowerCase();
    if (!hex || !use.has(hex)) return;
    const g = groups.find((x) => P[x.roles[0]]?.toLowerCase() === hex);
    if (g) g.roles.push(r); else groups.push({ roles: [r], n: use.get(hex)!, at });
  });
  return groups.sort((a, b) => b.n - a.n || a.at - b.at).slice(0, MAX_COLOURS).sort((a, b) => a.at - b.at).map((g) => g.roles);
}

/** The colours of the design on screen (spec 5): each group of `designRoles`, the palette's value and the one drawn. */
export function designColours(P: Form, s: Spec, sc: Scene): DesignColour[] {
  const E = editedForm(P, s);
  // a Scene of another palette (the stage not yet redrawn) says nothing of this one
  const groups = sc.palette === P.id && sc.designRoles ? sc.designRoles : designRoles(P, sc);
  return groups.map((g) => g.filter((r) => P[r] && E[r])).filter((g) => g.length)
    .map((roles) => ({ roles, base: P[roles[0]]!.toLowerCase(), now: E[roles[0]]!.toLowerCase(), label: ROLE_LABEL[roles[0]] }));
}

/** The spec with the roles of one design colour set to hex in the spec's mode (null: back to the palette's). */
export function setColour(s: Spec, roles: readonly ColourRole[], hex: string | null): Spec {
  const all = { ...(s.pick.colours ?? {}) }, one = { ...(all[s.mode] ?? {}) };
  for (const r of roles) { if (hex) one[r] = hex.toLowerCase(); else delete one[r]; }
  if (Object.keys(one).length) all[s.mode] = one; else delete all[s.mode];
  return { ...s, pick: { ...s.pick, colours: Object.keys(all).length ? all : null } };
}

/** The palette picker of the style's palette part (spec 10.3 Colour); a new palette drops this design's colour edits. */
export function palettePicker(list: { id: string; name: string }[]): Choice {
  const c = choice('pick.palette', 'Palette', { at: 'pick', key: 'palette' }, 'colour', list.map((p) => p.id), (v) => list.find((p) => p.id === v)?.name ?? String(v));
  c.set = (s, v) => ({ ...s, pick: { ...s.pick, palette: v === null ? null : String(v), colours: null } });
  return c;
}

