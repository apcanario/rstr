export type Format = '1:1' | '3:4' | '9:16' | 'A';
/** The formats on screen, 1080 wide (spec 3). A is the paper ratio, 1 to root 2, at 1080 x 1527. */
export const FORMATS: Record<Format, [number, number]> = {
  '1:1': [1080, 1080],
  '3:4': [1080, 1440],
  '9:16': [1080, 1920],
  A: [1080, 1527],
};
export const FORMAT_LIST: Format[] = ['1:1', '3:4', '9:16', 'A'];
/** In 9:16, text stays between these lines (spec 3): the rest belongs to the story interface. */
export const STORY_TEXT_TOP = 260;
export const STORY_TEXT_BOTTOM = 1600;

/** Export sizes (spec 10.1): 1x, 2x, 3x of the 1080 width, and for A also Print (A3 at 300 dpi). */
export type Size = '1x' | '2x' | '3x' | 'print';
export const SIZE_LIST: Size[] = ['1x', '2x', '3x', 'print'];
/** A3 at 300 dpi: 297 x 420 mm, which prints A4 and A5 too. */
export const PRINT: [number, number] = [3508, 4961];
/** The bleed of spec 10.1: 3 mm each side at 300 dpi; the spec's 3579 x 5032 is 71 px more each way, so 35 on the
 *  left and top and 36 on the right and bottom. */
export const BLEED: [number, number, number, number] = [35, 35, 36, 36];

/** Sizes a format offers: Print only for A. */
export const sizesOf = (f: Format): Size[] => (f === 'A' ? SIZE_LIST : SIZE_LIST.filter((s) => s !== 'print'));

/** What an export of a format at a size is: the trim it is drawn at, and the file's pixels (trim plus any bleed). */
export interface ExportDims { trimW: number; trimH: number; w: number; h: number; bleed: [number, number, number, number]; }
export function exportDims(f: Format, size: Size, bleed = false): ExportDims {
  const [W, H] = FORMATS[f];
  if (size === 'print') {
    if (f !== 'A') throw new Error(`Print is for the A format only, not ${f}`);
    const b: [number, number, number, number] = bleed ? BLEED : [0, 0, 0, 0];
    return { trimW: PRINT[0], trimH: PRINT[1], w: PRINT[0] + b[0] + b[2], h: PRINT[1] + b[1] + b[3], bleed: b };
  }
  const k = Number(size[0]);
  return { trimW: W * k, trimH: H * k, w: W * k, h: H * k, bleed: [0, 0, 0, 0] };
}
