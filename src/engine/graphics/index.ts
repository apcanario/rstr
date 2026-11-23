/** The shared graphics library (spec 8.0): every graphic by name, each with its ranged parameters and a draw that takes t. */
import { asterisks } from './asterisks';
import { barcode } from './barcode';
import { bars } from './bars';
import { blocks } from './blocks';
import { disc } from './disc';
import { dots } from './dots';
import { grid } from './grid';
import { horizon } from './horizon';
import { lines } from './lines';
import { pattern } from './pattern';
import { shape } from './shape';
import { slab } from './slab';
import { stars } from './stars';
import { sun } from './sun';
import { topo } from './topo';
import type { Graphic } from './types';

export const GRAPHICS: Record<string, Graphic> = Object.fromEntries(
  [topo, blocks, bars, dots, disc, lines, barcode, slab, asterisks, pattern, shape, stars, sun, grid, horizon].map((g) => [g.name, g]),
);
export type { Graphic, Range } from './types';
