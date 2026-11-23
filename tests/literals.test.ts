import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test } from 'vitest';

const SRC = join(__dirname, '..', 'src');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css)$/.test(f) ? [p] : [];
  });
}
/** Hex colours, rgb()/hsl() calls and CSS colour names written as string literals. */
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FN = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const NAMED = /['"`](black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|transparent)['"`]/i;
/** The only places a colour may be written (spec 5, row R2): the palette data and the app's own stylesheet. */
const allowed = (rel: string) => rel.startsWith(['data', 'palettes', ''].join(sep)) || rel === join('app', 'app.css');

test('no colour literal outside src/data/palettes/ and the app stylesheet', () => {
  const hits: string[] = [];
  for (const f of files(SRC)) {
    const rel = relative(SRC, f);
    if (allowed(rel)) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      // a path's '#' (Material Symbols use none) and the seed chip's '#{' are not colours
      if (HEX.test(line) || FN.test(line) || NAMED.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(hits).toEqual([]);
});

test('the literal finder catches each kind', () => {
  expect(HEX.test("fill: '#E4002B'")).toBe(true);
  expect(HEX.test("ctx.fillStyle = '#000'")).toBe(true);
  expect(FN.test("ctx.fillStyle = 'rgba(0,0,0,0.5)'")).toBe(true);
  expect(NAMED.test("ctx.fillStyle = 'white'")).toBe(true);
  expect(HEX.test('<div>#{seedCode(spec.seeds)}</div>')).toBe(false);
});
