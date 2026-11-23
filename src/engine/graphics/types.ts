import type { Rng } from '../rng';
import type { GraphicItem } from '../scene';
import type { Clock } from './clock';
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** A graphic draws inside its item's box (already clipped), from its own seeded stream, at time T. */
export type Draw = (ctx: Ctx, g: GraphicItem, r: Rng, T: Clock) => void;

/** One ranged parameter (spec 8.0): its ends, its value when nothing chose one, integer or not, drawn on a log scale or not. */
export interface Range { min: number; max: number; def: number; int?: boolean; log?: boolean; }

/** A graphic of the shared library: a name, at least three ranged parameters, and a draw that takes t. */
export interface Graphic { name: string; params: Record<string, Range>; draw: Draw; }
