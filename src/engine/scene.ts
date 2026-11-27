/** A Scene is plain data: what to draw and where. layout() makes it, paint() draws it. */
import type { Quad, Rect, Xf } from './geom';
import type { Slot } from './spec';

export interface FontRef { family: string; weight: number; italic?: boolean; }
export const fontCss = (f: FontRef, px: number) => `${f.italic ? 'italic ' : ''}${f.weight} ${px}px "${f.family}"`;

/** A vertical or angled linear gradient. With em: true the coordinates are in ems relative to each run's baseline origin. */
export interface Linear { kind: 'linear'; x0: number; y0: number; x1: number; y1: number; stops: [number, string][]; em?: boolean; }
export type Paint = string | Linear;

export interface Run { s: string; x: number; y: number; sx?: number; sy?: number; }

export interface TextItem {
  kind: 'text';
  slot: Slot;
  part: string;              // which piece of the slot: 'line0', 'label1', 'value1', ...
  font: FontRef;
  size: number;              // px before run scale
  tracking: number;          // px
  runs: Run[];
  xf?: Xf;
  clip?: Rect;               // local
  fill: Paint;
  /**
   * An outline drawn under the fill. With halo: true it is an edge in the paper colour round every glyph
   * (Postmodern photocopy, spec 8.2): the fill sits on it, so rule 4 checks the fill against the halo.
   */
  stroke?: { paint: Paint; width: number; halo?: boolean };
  /** Offset copies drawn under the text; `halo`: the copy gets its own outline at the text's stroke width, so it
   *  reads as its own copy over what is under it (the photocopy ghost, review R6 E1). */
  echoes?: { dx: number; dy: number; paint: Paint; halo?: Paint }[];
  /** Text items of one group may overlap each other (the photocopy title's colliding words, spec 8.2); never another item. */
  group?: string;
  /** Rules of 9.2 waived for this item, by number: only rule 4, only for photocopy title words with the paper edge off (spec 8.2). */
  waive?: number[];
  quad: Quad;                // world ink bounds, including echoes and stroke
  ink: string[];             // the colours that carry legibility, checked for contrast
  px: number;                // effective size: size times the smallest run scale
  min: number;               // the style's minimum for this text
  /** The text layer it draws (spec 8.6): its id. */
  lid?: string;
  /** Set by the shared layer placer (a layer beyond the four slots), not by the style's own slot rules. */
  extra?: boolean;
}

export interface RectItem {
  kind: 'rect';
  r: Rect;                   // local
  xf?: Xf;
  fill: Paint;
  plate?: boolean;           // sits under text on purpose
  shadow?: { dx: number; dy: number; fill: string };
  stroke?: { colour: string; width: number };
  quad: Quad;                // world, fill only (the shadow is in shadowQuad)
  shadowQuad?: Quad;
}

export interface GraphicItem {
  kind: 'graphic';
  name: string;              // graphics registry key
  box: Rect;                 // world clip box
  xf?: Xf;                   // for single placed shapes
  seed: number;              // graphic stream seed
  skip: number;              // draws to skip before drawing (keeps the spike's stream order)
  colours: Record<string, string>;
  params: Record<string, number | string | boolean>;
  fills: string[];           // every colour the graphic can show, for the contrast rule
  quad: Quad;                // world extent
  /** The composition transform (tilt, quarter turn): box, clip and xf are in its local frame. */
  frame?: Xf;
  /** The clip: the box (default) or the disc inscribed in it, for a graphic cut into another (spec 8.0). */
  cut?: 'rect' | 'disc';
  /** Filled inside the clip before the graphic draws: the plate a cut-in sits on. */
  plate?: string;
  /**
   * Colours mixed from two palette colours at layout time (photocopy contours and tape): colour key -> the two
   * colours and the share of the second. A colour edit mixes them again from the edited colours (recolour.ts).
   */
  mixed?: Record<string, { a: string; b: string; k: number }>;
  /** Depth (spec 8.0): ground, back graphics, front graphics. Text is the top layer. A mark (spec 7.2) sits in free space over all of them. */
  layer?: 'ground' | 'back' | 'front' | 'mark';
  /** The first graphic of the design when it is drawn after the graphics cut into it (Swiss shapes): counted first. */
  lead?: boolean;
  /** What the variety tests count this graphic as, if not its name (a Postmodern shape counts as its shape). */
  tag?: string;
  /**
   * A surface pass over everything drawn before it, type included (the photocopy copier pass, spec 8.2): texture
   * like a finish, so rule 3 does not count it as a graphic over text, and contrast is checked before it.
   */
  pass?: boolean;
  /** A surface pass's free distances from the left, right and top sides to the nearest text, as shares of the page:
   *  read from the finished text like `knock`, so the pass's dark edges keep off it (review R6 S3). */
  keep?: { l: number; r: number; t: number };
  /**
   * The photo (spec 8.9): what its pixels measured under text items, each quad wholly inside the photo's clip. Behind a
   * text item a region contains, the photo shows only these colours and nothing under it shows (it is opaque).
   */
  regions?: { quad: Quad; fills: string[] }[];
  avoid?: Quad[];            // text quads the graphic keeps off: nothing of it lies directly behind their ink
  knock?: { glyphs: number[]; boxes: Quad[]; pad: number };  // what paint cuts out: big text by its glyphs (padded), small text by its box
}

export type Item = TextItem | RectItem | GraphicItem;

export interface Scene {
  w: number;
  h: number;
  style: string;
  format: string;
  palette: string;
  pairing: string;
  layout: string;            // the candidate that passed, or 'fallback'
  frame: string;             // which of the style's layouts was drawn (title-top, graphic-above, ...)
  transform: string;         // none, tilt or quarter (spec 8.0)
  graphics: string[];        // the graphics drawn, first one first, as the variety tests count them (ground layer excluded)
  ground: string;
  items: Item[];
  fonts: string[];           // families the layout measured with or drew
  faces: string[];           // faces (faceKey) the layout measured with or drew: what the font check tests
  /** Text that could not reach the contrast of spec 5 with this design's edited colours: it keeps its plate (Advanced warns). */
  colourWarn?: string[];
  /** The design's colours as palette roles (spec 5), read before any edit: `designRoles` in controls.ts. */
  /** Advanced control ids the design ignores (Plan.inert): the Advanced tabs hide them. */
  inert?: string[];
  /** Text layers that are on and could not be drawn in full (spec 8.6): not drawn, or shortened. The Text tab flags their rows. */
  flagged?: string[];
  designRoles?: ('ground' | 'ink' | 'accent' | 'accent2' | 'accent3' | 'paper' | 'toner' | 'spot' | 'window' | 'windowInk' | 'chrome')[][];
}
