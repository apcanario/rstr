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
import type { Slot, Spec } from '../spec';

/** What every part is called with for one candidate. */
export interface PartCtx {
  spec: Spec;
  W: number;
  H: number;
  story: boolean;
  top: number;         // text area, y (world, untransformed)
  bot: number;
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
  /** Where the slot goes, when the layout gives it its own row. */
  subtitle?: Rect;
  info?: Rect;
  caption?: Rect;
  /** Where the main graphic goes. */
  graphic?: Rect;
  /** A plate of ground the text sits on. */
  panel?: Rect;
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
}

/** A plan with every shared value at its neutral setting, for a layout to fill in. */
export function basePlan(frame: string, page: Rect, margin: number): Plan {
  return {
    frame, transform: 'none', page, boxes: { text: { x: margin, y: margin, w: page.w - 2 * margin, h: page.h - 2 * margin } },
    margin, module: (page.w - 2 * margin) / 6, gutter: Math.round(page.w * 0.02), axis: 0, size: 'normal',
    titleSide: 'top', side: 'left', horizon: page.y + page.h, slant: 0, emphasis: 0,
  };
}

export interface GroundPart { id: string; /** library graphics it draws */ uses: string[]; ground(c: PartCtx, plan: Plan): Item[]; }
export interface LayoutPart { id: string; layouts: string[]; /** at 1080 wide */ margin: number; plan(c: PartCtx): Plan | null; }
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
}
export interface TypePart {
  id: string;
  min: Record<Slot, number>;
  /** Text items and their plates in the plan's local frame, or null if this candidate cannot hold the text. `below` is the Scene so far (world). */
  set(c: PartCtx, plan: Plan, below: Item[]): Item[] | null;
}
export interface PalettePart { id: string; list: Palette[]; }

export interface Parts { ground: GroundPart; layout: LayoutPart; type: TypePart; graphics: GraphicsPart; palette: PalettePart; }
export const PART_KINDS = ['ground', 'layout', 'type', 'graphics', 'palette'] as const;

export const textArea = (story: boolean, H: number, M: number) => ({ top: story ? 260 : M, bot: story ? 1600 : H - M });
