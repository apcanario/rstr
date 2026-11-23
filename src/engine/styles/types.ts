/** A style is a named set of five parts (spec 8.7) and nothing else. */
import type { Parts } from '../parts/types';
import type { Slot, StyleId } from '../spec';

export interface Style {
  id: StyleId;
  name: string;
  blurb: string;
  parts: Parts;
  /** Read from the parts, for pickers and tests. */
  layouts: string[];
  motifs: string[];
  min: Record<Slot, number>;
  margin: number;
}

export function style(id: StyleId, name: string, blurb: string, parts: Parts): Style {
  return { id, name, blurb, parts, layouts: parts.layout.layouts, motifs: parts.graphics.motifs, min: parts.type.min, margin: parts.layout.margin };
}
