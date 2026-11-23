/** Postmodern (spec 8.2): Memphis and new-wave energy. */
import { pomoGraphics } from '../parts/graphics/pomo';
import { pomoGround } from '../parts/ground/pomo';
import { pomoLayout } from '../parts/layout/pomo';
import { pomoPalette } from '../parts/palette/pomo';
import { pomoType } from '../parts/type/pomo';
import { style } from './types';

export const pomo = style('pomo', 'Postmodern', 'Tilt, pattern, shadow', { ground: pomoGround, layout: pomoLayout, type: pomoType, graphics: pomoGraphics, palette: pomoPalette });
