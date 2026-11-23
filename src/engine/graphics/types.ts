import type { Rng } from '../rng';
import type { GraphicItem } from '../scene';
import type { Clock } from './clock';
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** A graphic draws inside its item's box (already clipped), from its own seeded stream, at time T. */
export type Draw = (ctx: Ctx, g: GraphicItem, r: Rng, T: Clock) => void;
