/** The shared graphics library (spec 8.0): every graphic by name, each with its ranged parameters and a draw that takes t. */
import { asterisks } from './asterisks';
import { barcode } from './barcode';
import { bars } from './bars';
import { blocks } from './blocks';
import { disc } from './disc';
import { crosshairs } from './crosshairs';
import { dots } from './dots';
import { grid } from './grid';
import { horizon } from './horizon';
import { lattice } from './lattice';
import { lines } from './lines';
import { numeral } from './numeral';
import { pattern } from './pattern';
import { copier } from './copier';
import { redact } from './redact';
import { register } from './register';
import { scribble } from './scribble';
import { tape } from './tape';
import { torn } from './torn';
import { xmarks } from './xmarks';
import { rings } from './rings';
import { rules } from './rules';
import { shape } from './shape';
import { slab } from './slab';
import { stars } from './stars';
import { sun } from './sun';
import { topo } from './topo';
import { waves } from './waves';
import type { Graphic } from './types';

export const GRAPHICS: Record<string, Graphic> = Object.fromEntries(
  [topo, blocks, bars, dots, disc, lines, rules, numeral, crosshairs, lattice, rings, waves, barcode, slab, asterisks, pattern, shape, stars, sun, grid, horizon, scribble, tape, xmarks, torn, register, redact, copier].map((g) => [g.name, g]),
);
export type { Graphic, Range } from './types';
