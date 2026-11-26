/**
 * Advanced mode's controls for the design on screen (spec 10.3), gathered per tab from the parts' own lists, the
 * finish's and the marks layer's, and the photo's (R14): the app draws whatever this returns. Mix (R18) comes later.
 */
import { choosePalette } from './layout';
import { apply, designColours, photoControls, pairingPicker, palettePicker, positionControls, read, type AdvTab, type Control, type DesignColour, type Value } from './controls';
import { finishControls } from './finish';
import { marksControls } from './marks';
import type { Scene } from './scene';
import type { Slot, Spec } from './spec';
import { STYLES } from './styles';

export interface Advanced {
  /** The generated controls of each tab (the app adds the style tiles, Finish, Marks, Light/Dark, rerolls and text fields). */
  tabs: Record<AdvTab, Control[]>;
  /** Text tab: each slot's position control, where the style's layout reads one. */
  positions: Partial<Record<Slot, Control>>;
  /** Colour tab: the design's colours (spec 5). */
  colours: DesignColour[];
}

/** The Scene of a spec as the app would draw it (the measure and pairing in use): Advanced's trial of a control. */
export type Trial = (s: Spec) => Scene;
/**
 * Controls whose effect hangs on how the text fits (a title already bound by the width or the room ignores its size
 * class and size cap, and a start size can land on the same step), so no rule can tell: they are tried, each of their
 * other values solved, and shown only where one changes the design (review R10 S1). A few solves per change.
 */
export const TRIED = ['layout.size', 'type.cap'];

const round = (_k: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
/** What a person sees of a Scene: its frame, transform, ground and every item. */
export const designSig = (sc: Scene) => JSON.stringify([sc.frame, sc.transform, sc.ground, sc.items], round);

/** The values a control can write, unset first: every option of a choice, both ends of a range, a switch off. */
export function valuesOf(c: Control): Value[] {
  if (c.kind === 'choice') return c.options.map((o) => o.v);
  if (c.kind === 'range') return [null, c.min, c.max];
  return [null, c.off];
}

/** True where some other value of the control draws a different design from `mine` (read with `trial`). */
export function changes(spec: Spec, mine: string, c: Control, trial: Trial): boolean {
  const cur = read(spec, c.where);
  return valuesOf(c).some((v) => v !== cur && designSig(trial(apply(spec, c, v))) !== mine);
}

export function advancedOf(spec: Spec, scene: Scene, trial?: Trial): Advanced {
  const P = STYLES[spec.style].parts, q = { spec, scene };
  // a control the design ignores is not shown (review R10 S1): what the parts record on the Scene, the position of a
  // slot with nothing in it, and a tried control that no value moves
  const inert = new Set(scene.inert ?? []);
  // the trial's own Scene of the spec is the base (the Scene given may be one the stage has not redrawn yet)
  let mine: string | null = null;
  const base = () => (mine ??= designSig(trial!(spec)));
  const live = (c: Control) => !inert.has(c.id) && !(trial && TRIED.includes(c.id) && !changes(spec, base(), c, trial));
  const positions: Partial<Record<Slot, Control>> = {};
  for (const c of positionControls(P.layout.positions ?? {})) if (c.where.at === 'pos' && hasText(spec, c.where.slot) && live(c)) positions[c.where.slot] = c;
  // a long list unset shows what the design draws, muted, and steps from it (review R10 M6)
  const drawn: Partial<Record<string, string | undefined>> = { 'pick.layout': scene.frame, 'pick.pairing': scene.pairing, 'pick.palette': scene.palette, 'pick.motif': scene.graphics[0] };
  const mark = (c: Control): Control => {
    const d = drawn[c.id];
    return c.kind === 'choice' && d !== undefined && c.options.some((o) => o.v === d) ? { ...c, drawn: d } : c;
  };
  return {
    tabs: {
      style: [...finishControls(spec), ...(spec.marks === 'off' ? [] : marksControls(spec))],
      layout: (P.layout.controls?.(q) ?? []).filter(live).map(mark),
      graphic: [...(P.graphics.controls?.(q) ?? []), ...(P.ground.controls?.(q) ?? [])].filter(live).map(mark),
      type: [pairingPicker(spec), ...(P.type.controls?.(q) ?? [])].filter(live).map(mark),
      colour: [palettePicker(P.palette.list)].map(mark),
      text: Object.values(positions) as Control[],
      photo: photoControls(q, choosePalette(spec)),
    },
    positions,
    colours: designColours(choosePalette(spec), spec, scene),
  };
}

/** A slot that is on and has something in it. */
function hasText(s: Spec, slot: Slot): boolean {
  if (!s.text[slot].on) return false;
  return slot === 'info' ? s.text.info.v.slice(0, 3).some((p) => p.k.trim() || p.v.trim()) : !!s.text[slot as Exclude<Slot, 'info'>].v.trim();
}

/** Every generated control of the design, all tabs. */
export const allControls = (a: Advanced): Control[] => Object.values(a.tabs).flat();
