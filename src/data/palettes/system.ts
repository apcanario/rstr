/**
 * Colours that are not part of any design: the mask the knock-outs cut with, the marker colour the
 * knock-out proof paints graphics in, and the mid grey the colour-edit checks set a design colour to. Kept here so no colour literal lives outside src/data/palettes/.
 */
export const MASK = '#000000';
export const MARKER = '#13F7A9';
export const EDIT_GREY = '#808080';
/** What a photo can show anywhere (spec 8.9), for every check that does not measure it: no ink passes against all three. */
export const PHOTO_ANY = ['#000000', '#767676', '#FFFFFF'];
/** What a photo with transparency is flattened on when it is kept (spec 8.9). */
export const PHOTO_FLAT = '#ffffff';
/** The two flat pictures the photo-shows proof paints the photo as (review R14 S1): pixels that differ are the photo's. */
export const PHOTO_PROBE = ['#000000', '#ffffff'] as const;
