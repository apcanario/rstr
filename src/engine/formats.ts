export type Format = '1:1' | '3:4' | '9:16';
export const FORMATS: Record<Format, [number, number]> = {
  '1:1': [1080, 1080],
  '3:4': [1080, 1440],
  '9:16': [1080, 1920],
};
export const FORMAT_LIST: Format[] = ['1:1', '3:4', '9:16'];
/** In 9:16, text stays between these lines (spec 3): the rest belongs to the story interface. */
export const STORY_TEXT_TOP = 260;
export const STORY_TEXT_BOTTOM = 1600;
