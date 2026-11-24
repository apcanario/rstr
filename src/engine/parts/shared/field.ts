/** The colour of a field of colour text sits on (Plan boxes.field), and the ink that reads on it. Pure on the palette form. */
import type { Form } from '../../../data/palettes/types';
import { contrast, firstInk } from '../../colour';

/** The accent if the ink or the ground reaches 4.5:1 on it (small text can sit there), else the ink. */
export function fieldColour(P: Form): string {
  return Math.max(contrast(P.ink, P.accent), contrast(P.ground, P.accent)) >= 4.5 - 1e-9 ? P.accent : P.ink;
}
/** The ink for text on a background: the palette's ink if it reaches the ratio, else its ground, else the better. */
export const inkOn = (P: Form, bg: string, ratio: number) => (bg === P.ground ? P.ink : firstInk([P.ink, P.ground], [bg], ratio));
