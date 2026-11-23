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
  stroke?: { paint: Paint; width: number };
  echoes?: { dx: number; dy: number; paint: Paint }[];   // offset copies drawn under the text
  quad: Quad;                // world ink bounds, including echoes and stroke
  ink: string[];             // the colours that carry legibility, checked for contrast
  px: number;                // effective size: size times the smallest run scale
  min: number;               // the style's minimum for this text
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
  ground: string;
  items: Item[];
  fonts: string[];           // families the layout measured with or drew
  faces: string[];           // faces (faceKey) the layout measured with or drew: what the font check tests
}
