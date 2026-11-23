import { asterisks, barcode, slab } from './brutal';
import { pattern, shape } from './pomo';
import { bars, blocks, disc, dots, topo } from './swiss';
import type { Draw } from './types';
import { grid, horizon, stars, sun } from './vapor';

/** Every graphic by name. A graphic's draw takes t through the clock from the first row on. */
export const GRAPHICS: Record<string, Draw> = { topo, blocks, bars, dots, disc, pattern, shape, barcode, slab, asterisks, stars, sun, grid, horizon };
