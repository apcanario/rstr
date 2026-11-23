/** Brutalist (spec 8.3): heavy type, the title is the graphic. */
import { brutalGraphics } from '../parts/graphics/brutal';
import { plainGround } from '../parts/ground/plain';
import { brutalLayout } from '../parts/layout/brutal';
import { brutalPalette } from '../parts/palette/brutal';
import { brutalType } from '../parts/type/brutal';
import { style } from './types';

export const brutal = style('brutal', 'Brutalist', 'Heavy type, hard rules', { ground: plainGround, layout: brutalLayout, type: brutalType, graphics: brutalGraphics, palette: brutalPalette });
