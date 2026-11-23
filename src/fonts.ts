/** Loads the bundled core fonts and the UI face. Layout never runs before they are in. */
import { CORE_FONTS, UI_FONTS } from './data/pairings';

export function loadCoreFonts(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const all = [...CORE_FONTS, ...UI_FONTS].map((f) => {
    const face = new FontFace(f.family, `url(${base}fonts/${f.file}) format('woff2')`, { weight: String(f.weight), style: (f as { italic?: boolean }).italic ? 'italic' : 'normal' });
    document.fonts.add(face);
    return face.load();
  });
  return Promise.all(all).then(() => undefined);
}
