/** Swiss (spec 8.1): after Müller-Brockmann, the grid is the design. */
import { plainGround } from '../parts/ground/plain';
import { swissGraphics } from '../parts/graphics/swiss';
import { swissLayout } from '../parts/layout/swiss';
import { swissPalette } from '../parts/palette/swiss';
import { swissType } from '../parts/type/swiss';
import { style } from './types';

export const swiss = style('swiss', 'Swiss', 'Grid, one accent', { ground: plainGround, layout: swissLayout, type: swissType, graphics: swissGraphics, palette: swissPalette });
