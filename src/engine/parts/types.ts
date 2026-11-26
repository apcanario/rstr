/**
 * The five parts of a style (spec 8.7) and what they share. A style is a named set of five parts and nothing
 * else. Parts never import each other: they meet through the Plan (the boxes layout decided) and the Scene so far.
 */
import type { Form, Palette } from '../../data/palettes/types';
import type { Pairing } from '../../data/pairings';
import type { Rect, Xf } from '../geom';
import type { Measure } from '../measure';
import type { Rng } from '../rng';
import type { Item } from '../scene';
import type { Dialect, Level, Slot, SlotText, Spec } from '../spec';
import type { Control, ControlQuery } from '../controls';
import type { TreatList } from '../treat';

/** What every part is called with for one candidate. */
export interface PartCtx {
  spec: Spec;
  /** The four slots the type part sets: the lead layer of each slot's level (spec 8.6, `slotsOf`). Parts read text here, never spec.text. */
  tx: SlotText;
  W: number;
  H: number;
  story: boolean;
  top: number;         // text area, y (world, untransformed)
  bot: number;
  /** The text area before room was kept at its foot for the layers beyond the slots (spec 8.6); absent: top and bot. */
  top0?: number;
  bot0?: number;
  m: Measure;
  /** The palette's form for the spec's mode: roles only. */
  P: Form;
  T: Pairing;
  /** The layout stream from its start, read in a fixed order whatever the candidate. */
  rf: Rng;
  /**
   * A candidate decision. Always takes one draw from rf so the frame stays put; candidate 0 keeps
   * that draw's value, later candidates draw from their own stream, the fallback takes safe (or list[0]).
   */
  cand<T>(list: readonly T[], safe?: T): T;
  /** Title size cap for this candidate: 1 for the first, smaller for later ones. */
  cap: number;
  k: number;           // candidate index; -1 is the fallback
  fallback: boolean;
  /** The graphic stream, counted: ground draws first, graphics carry on from where it stopped. */
  rg: Rng & { n: number };
}

export type Transform = 'none' | 'tilt' | 'quarter';
export const TRANSFORMS: Transform[] = ['none', 'tilt', 'quarter'];
export type SizeClass = 'small' | 'normal' | 'oversize';
export const SIZE_CLASSES: SizeClass[] = ['small', 'normal', 'oversize'];

/**
 * Named boxes in the local page, a vocabulary every part may read. `text` (the whole text area) is always set;
 * the rest are set where the layout has them, and a part reading one that is absent must cope (draw nothing,
 * or return null from type).
 */
export interface Boxes {
  /** The area all text sits in. */
  text: Rect;
  /** The area the title may take: its own area where the layout gives it one, else the text area. Set whenever the title has text. */
  title?: Rect;
  /** The second part of a title split across the page (spec 8.3: title split across top and bottom); absent: one part. */
  title2?: Rect;
  /** Where the slot goes, when the layout gives it its own row. */
  subtitle?: Rect;
  info?: Rect;
  caption?: Rect;
  /** Where the main graphic goes. */
  graphic?: Rect;
  /** A plate of ground the text sits on. */
  panel?: Rect;
  /**
   * A full or split field of colour (spec 8.1): the accent where some ink reaches 4.5:1 on it, else the ink
   * (`fieldColour` in parts/shared/field.ts). Graphics draws it under everything; type sets text on it in an ink
   * that passes. Graphics in the field are drawn in colours that show on it.
   */
  field?: Rect;
  /** Above and below the horizon. */
  sky?: Rect;
  floor?: Rect;
}

/**
 * What layout decides (review R13 S1): the composition, named boxes, and a typed vocabulary every layout fills
 * and every part may read. Each value means the same thing whatever the style; numbers a single part needs for
 * itself (rule weights, row heights) live in that part.
 */
export interface Plan {
  frame: string;
  transform: Transform;
  /** Local page -> world. Absent: the page is the canvas. Ground items are never transformed. */
  xf?: Xf;
  /** The local page: where layout put things. */
  page: Rect;
  boxes: Boxes;
  /** The page margin, px. */
  margin: number;
  /** One grid column, px (the inner width over six where the layout has no grid of its own). */
  module: number;
  /** The gutter between blocks, px. */
  gutter: number;
  /** How many columns text is set in from the margin. */
  axis: number;
  /** The title size class. */
  size: SizeClass;
  /** Which end of the text area the title band sits at. */
  titleSide: 'top' | 'bottom';
  /** Which side secondary blocks (info) sit on. */
  side: 'left' | 'right';
  /** Where ground meets sky, y in px; the page's bottom edge where the layout has no horizon. */
  horizon: number;
  /** The angle (radians) the type is slanted at; 0 is upright. */
  slant: number;
  /** Which title line the type emphasises (taken modulo the line count). */
  emphasis: number;
  /** The disc the composition centres on (a sun), if any. */
  focus?: { x: number; y: number; r: number };
  /** The title is set reading up the page, in boxes.title (spec 8.1, title vertical up the left edge). */
  titleUp?: boolean;
  /** Where each text slot goes, from the style's own list of positions (spec 8.5); absent: the style's first. */
  pos?: Partial<Record<Slot, string>>;
  /** The style's dialect where it has more than one (Postmodern: ice cream or photocopy, spec 8.2); absent: its first. */
  dialect?: Dialect;
  /**
   * Advanced control ids this design ignores (spec 10.3: a control is shown only where it changes the design): the
   * parts add the ones only they can tell, such as a size class that leaves the band as it is.
   */
  inert?: string[];
}

/** A plan with every shared value at its neutral setting, for a layout to fill in. */
export function basePlan(frame: string, page: Rect, margin: number): Plan {
  return {
    frame, transform: 'none', page, boxes: { text: { x: margin, y: margin, w: page.w - 2 * margin, h: page.h - 2 * margin } },
    margin, module: (page.w - 2 * margin) / 6, gutter: Math.round(page.w * 0.02), axis: 0, size: 'normal',
    titleSide: 'top', side: 'left', horizon: page.y + page.h, slant: 0, emphasis: 0,
  };
}

/** Picks that make a part draw one of its library graphics (for the range-end proofs): absent, no pick is needed. */
export type PickFor = (graphic: string) => Partial<Spec['pick']>;
export interface GroundPart {
  id: string; /** library graphics it draws */ uses: string[]; ground(c: PartCtx, plan: Plan): Item[];
  /** A surface pass drawn over everything, type included (spec 8.7: the copier pass belongs to the ground). */
  pass?(c: PartCtx, plan: Plan, items: Item[]): Item[];
  pickFor?: PickFor;
  /** Its Advanced controls for the design on screen (spec 10.3), shown on the Graphic tab. */
  controls?(q: ControlQuery): Control[];
}
export interface LayoutPart {
  id: string; layouts: string[]; /** at 1080 wide */ margin: number; plan(c: PartCtx): Plan | null;
  /** The dialects it can lay out, where the style has more than one (spec 8.2). */
  dialects?: Dialect[];
  /** The layouts of each dialect. */
  layoutsOf?: Partial<Record<Dialect, string[]>>;
  /** The positions of each slot it reads from `text.<slot>.pos` (spec 8.5), the first the default; absent: none. */
  positions?: Partial<Record<Slot, string[]>>;
  /** Its Advanced controls (spec 10.3), shown on the Layout tab. */
  controls?(q: ControlQuery): Control[];
}
export interface GraphicsPart {
  id: string;
  /** Library graphics it draws (their parameters are tested at both ends). */
  uses: string[];
  /** What the variety tests count: every one must appear in 300 shuffles. */
  vocab: string[];
  /** Values pick.motif may take. */
  motifs: string[];
  /** Graphic items in the plan's local frame. */
  place(c: PartCtx, plan: Plan): Item[];
  /** After type: read the finished Scene (world) and adjust its own items (knock-outs). */
  after?(c: PartCtx, plan: Plan, items: Item[]): void;
  pickFor?: PickFor;
  /** What the variety tests count, per dialect, where the style has more than one. */
  vocabOf?: Partial<Record<Dialect, string[]>>;
  /** Its Advanced controls (spec 10.3), shown on the Graphic tab. */
  controls?(q: ControlQuery): Control[];
  /** The photo treatments it allows and its favourite (spec 8.9, R15): what the graphic stream draws from. */
  treatments: TreatList;
  /** The same per dialect, where the style has more than one (spec 8.2). */
  treatmentsOf?: Partial<Record<Dialect, TreatList>>;
}
/**
 * How a style sets a text layer of one level beyond the four slots (spec 8.6): face (a pairing role), case, start size
 * (share of the canvas width), minimum, line pitch, most lines, tracking (em), which end of the text area it is looked
 * for from, alignment, and the plate it sits on (a palette role; the ground where the form has none).
 */
export interface LevelSet {
  font: 'display' | 'text' | 'label' | 'serif' | 'mono' | 'pixel' | 'heavy';
  upper: boolean; size: number; min: number; lh: number; lines: number; track: number;
  from: 'top' | 'bottom'; align: 'left' | 'centre'; plate: 'ground' | 'paper' | 'window';
}
export type LevelSets = Record<Level, LevelSet>;

export interface TypePart {
  id: string;
  min: Record<Slot, number>;
  /** Every level's treatment and places for the layers it does not set itself (spec 8.6). */
  levels: LevelSets;
  /** The same per dialect, where the style has more than one. */
  levelsOf?: Partial<Record<Dialect, LevelSets>>;
  /** Text items and their plates in the plan's local frame, or null if this candidate cannot hold the text. `below` is the Scene so far (world). */
  set(c: PartCtx, plan: Plan, below: Item[]): Item[] | null;
  /** Its Advanced controls (spec 10.3), shown on the Type tab. */
  controls?(q: ControlQuery): Control[];
}
export interface PalettePart { id: string; list: Palette[]; }

export interface Parts { ground: GroundPart; layout: LayoutPart; type: TypePart; graphics: GraphicsPart; palette: PalettePart; }
export const PART_KINDS = ['ground', 'layout', 'type', 'graphics', 'palette'] as const;

export const textArea = (story: boolean, H: number, M: number) => ({ top: story ? 260 : M, bot: story ? 1600 : H - M });
