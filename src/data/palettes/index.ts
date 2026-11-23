import type { StyleId } from '../../engine/spec';
import { BRUTAL } from './brutal';
import { POMO } from './pomo';
import { SWISS } from './swiss';
import type { Palette } from './types';
import { VAPOR } from './vapor';
export type { Palette } from './types';
export const PALETTES: Record<StyleId, Palette[]> = { swiss: SWISS, pomo: POMO, brutal: BRUTAL, vapor: VAPOR };
