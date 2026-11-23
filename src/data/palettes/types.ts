/** A palette is roles, not colours in fixed places (spec 5). R2 adds the light and dark forms. */
export interface Palette {
  id: string;
  name: string;
  ground: string;
  ink: string;
  accent: string;
  accent2?: string;
  accent3?: string;
  gradient?: string[];
  /** Vaporwave window, its ink, and the light stop of the chrome title. */
  window?: string;
  windowInk?: string;
  chrome?: string;
}
