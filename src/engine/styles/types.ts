import type { Palette } from '../../data/palettes/types';
import type { Pairing } from '../../data/pairings';
import type { Measure } from '../measure';
import type { Rng } from '../rng';
import type { Item } from '../scene';
import type { Slot, Spec, StyleId } from '../spec';

export interface BuildCtx {
  spec: Spec;
  W: number;
  H: number;
  story: boolean;
  top: number;         // text area, y
  bot: number;
  m: Measure;
  P: Palette;
  T: Pairing;
  /** The layout stream from its start, read in a fixed order (the spike's) whatever the candidate. */
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
}

export interface Style {
  id: StyleId;
  name: string;
  blurb: string;
  layouts: string[];
  motifs: string[];
  min: Record<Slot, number>;
  /** Margin at 1080 wide. */
  margin: number;
  /** Items in paint order, or null if this candidate cannot hold the text. */
  build(b: BuildCtx): Item[] | null;
}

export const textArea = (story: boolean, H: number, M: number) => ({ top: story ? 260 : M, bot: story ? 1600 : H - M });
