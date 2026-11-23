/**
 * A palette is roles, not colours in fixed places (spec 5). Every palette has a light and a dark form,
 * both written by hand; the spec's mode picks the form. Styles read the roles of a Form, never a literal.
 */
export interface Roles {
  ground: string;
  ink: string;
  accent: string;
  accent2?: string;
  accent3?: string;
  /** Vaporwave: the sky, top to horizon. */
  gradient?: string[];
  /** Vaporwave: the window, its ink, and the light stop of the chrome title. */
  window?: string;
  windowInk?: string;
  chrome?: string;
}
export type Mode = 'light' | 'dark';
export interface Palette {
  id: string;
  name: string;
  light: Roles;
  dark: Roles;
}
/** One form of a palette, the roles a style reads. */
export interface Form extends Roles {
  id: string;
  name: string;
  mode: Mode;
}
export const formOf = (p: Palette, mode: Mode): Form => ({ id: p.id, name: p.name, mode, ...p[mode] });
