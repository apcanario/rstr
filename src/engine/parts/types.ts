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

/** What layout decides: which of its layouts, the composition transform, and named boxes in the local page. */
export interface Plan {
  frame: string;
  transform: Transform;
  /** Local page -> world. Absent: the page is the canvas. Ground items are never transformed. */
  xf?: Xf;
  /** The local page: where layout put things. */
  page: Rect;
  boxes: Record<string, Rect>;
  vals: Record<string, number | string | boolean>;
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
