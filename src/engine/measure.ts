/** Text measurement. Layout is pure given a Measure; the browser gives real ink bounds, tests a stub. */
import { fontCss, type FontRef } from './scene';

export interface Metrics {
  width: number;    // advance
  left: number;     // ink extends this far left of the origin (canvas actualBoundingBoxLeft)
  right: number;    // ink extends this far right of the origin
  ascent: number;   // ink above the baseline
  descent: number;  // ink below the baseline
}
export type Measure = (s: string, font: FontRef, px: number, tracking?: number) => Metrics;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function canvasMeasure(ctx: Ctx2D): Measure {
  const cache = new Map<string, Metrics>();
  return (s, font, px, tracking = 0) => {
    const key = `${font.family}|${font.weight}|${font.italic ? 1 : 0}|${px}|${tracking}|${s}`;
    let m = cache.get(key);
    if (m) return m;
    ctx.font = fontCss(font, px);
    (ctx as any).letterSpacing = tracking + 'px';
    const t = ctx.measureText(s);
    (ctx as any).letterSpacing = '0px';
    m = {
      width: t.width,
      left: t.actualBoundingBoxLeft,
      right: t.actualBoundingBoxRight,
      ascent: s ? t.actualBoundingBoxAscent : 0,
      descent: s ? t.actualBoundingBoxDescent : 0,
    };
    if (cache.size > 200000) cache.clear();
    cache.set(key, m);
    return m;
  };
}

/** A font-free measure for unit tests: fixed advance per character, cap-height ascent. */
export const stubMeasure: Measure = (s, font, px, tracking = 0) => {
  const k = font.family.includes('Anton') || font.family.includes('Bebas') ? 0.42 : font.family.includes('Unbounded') ? 0.78 : 0.56;
  const width = s.length * (px * k + tracking);
  const desc = /[gjpqy,;Q]/.test(s) ? px * 0.2 : /[a-z]/.test(s) ? px * 0.01 : 0;
  return { width, left: s ? -px * 0.04 : 0, right: s ? width - px * 0.04 - tracking : 0, ascent: s ? px * 0.72 : 0, descent: s ? desc : 0 };
};
