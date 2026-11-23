import type { StyleId } from '../spec';
import { brutal } from './brutal';
import { pomo } from './pomo';
import { swiss } from './swiss';
import type { Style } from './types';
import { vapor } from './vapor';
export const STYLES: Record<StyleId, Style> = { swiss, pomo, brutal, vapor };
export type { Style } from './types';
