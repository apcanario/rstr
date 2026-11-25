/**
 * Advanced mode's controls for the design on screen (spec 10.3), gathered per tab from the parts' own lists, the
 * finish's and the marks layer's: the app draws whatever this returns. Photo (R14) and Mix (R18) come later.
 */
import { choosePalette } from './layout';
import { designColours, pairingPicker, palettePicker, positionControls, type AdvTab, type Control, type DesignColour } from './controls';
import { finishControls } from './finish';
import { marksControls } from './marks';
import type { Scene } from './scene';
import type { Slot, Spec } from './spec';
import { STYLES } from './styles';

export interface Advanced {
  /** The generated controls of each tab (the app adds the style tiles, Finish, Marks, Light/Dark, rerolls and text fields). */
  tabs: Record<AdvTab, Control[]>;
  /** Text tab: each slot's position control, where the style's layout reads one. */
  positions: Partial<Record<Slot, Control>>;
  /** Colour tab: the design's colours (spec 5). */
  colours: DesignColour[];
}

export function advancedOf(spec: Spec, scene: Scene): Advanced {
  const P = STYLES[spec.style].parts, q = { spec, scene };
  const positions: Partial<Record<Slot, Control>> = {};
  for (const c of positionControls(P.layout.positions ?? {})) if (c.where.at === 'pos') positions[c.where.slot] = c;
  return {
    tabs: {
      style: [...finishControls(spec), ...(spec.marks === 'off' ? [] : marksControls(spec))],
      layout: P.layout.controls?.(q) ?? [],
      graphic: [...(P.graphics.controls?.(q) ?? []), ...(P.ground.controls?.(q) ?? [])],
      type: [pairingPicker(spec), ...(P.type.controls?.(q) ?? [])],
      colour: [palettePicker(P.palette.list)],
      text: Object.values(positions) as Control[],
    },
    positions,
    colours: designColours(choosePalette(spec), spec, scene),
  };
}

/** Every generated control of the design, all tabs. */
export const allControls = (a: Advanced): Control[] => Object.values(a.tabs).flat();
