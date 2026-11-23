/** Ground part for styles whose ground is the palette's ground colour alone (the Scene's ground fill). */
import type { GroundPart } from '../types';

export const plainGround: GroundPart = { id: 'plain', uses: [], ground: () => [] };
