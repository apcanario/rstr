/** Vaporwave (spec 8.4): gradient sky, slit sun, grid floor, chrome title. */
import { vaporGraphics } from '../parts/graphics/vapor';
import { vaporGround } from '../parts/ground/vapor';
import { vaporLayout } from '../parts/layout/vapor';
import { vaporPalette } from '../parts/palette/vapor';
import { vaporType } from '../parts/type/vapor';
import { style } from './types';

export const vapor = style('vapor', 'Vaporwave', 'Sun, grid, chrome', { ground: vaporGround, layout: vaporLayout, type: vaporType, graphics: vaporGraphics, palette: vaporPalette });
