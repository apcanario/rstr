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
/** The 148 CSS named colours (CSS Color 4), plus transparent and currentcolor. */
const NAMES = ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' ');
const NAMED = new RegExp(`['"\`](${[...NAMES, 'transparent', 'currentcolor'].join('|')})['"\`]`, 'i');
/** The only places a colour may be written (spec 5, row R2): the palette data and the app's own stylesheet. */
const allowed = (rel: string) => rel.startsWith(['data', 'palettes', ''].join(sep)) || rel === join('app', 'app.css');
/** index.html's theme-color is app chrome, like the stylesheet, and must match its background (review R2 M1). */
const INDEX = join(__dirname, '..', 'index.html');
const BG = /html, body \{[^}]*background: (#[0-9a-fA-F]{3,8})/;

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

test('index.html holds no colour but the theme-color, and that is the app background', () => {
  const html = readFileSync(INDEX, 'utf8');
  const hits = html.split('\n').filter((l) => (HEX.test(l) || FN.test(l)) && !/name="theme-color"/.test(l));
  expect(hits).toEqual([]);
  const theme = /name="theme-color" content="([^"]+)"/.exec(html)?.[1];
  const bg = BG.exec(readFileSync(join(SRC, 'app', 'app.css'), 'utf8'))?.[1];
  expect(theme?.toLowerCase()).toBe(bg?.toLowerCase());
});

test('the colour-name list is the full CSS list', () => expect(NAMES.length).toBe(148));

test('the literal finder catches each kind', () => {
  expect(HEX.test("fill: '#E4002B'")).toBe(true);
  expect(HEX.test("ctx.fillStyle = '#000'")).toBe(true);
  expect(FN.test("ctx.fillStyle = 'rgba(0,0,0,0.5)'")).toBe(true);
  expect(NAMED.test("ctx.fillStyle = 'white'")).toBe(true);
  for (const n of ['navy', 'teal', 'lime', 'gold', 'silver', 'maroon']) expect(NAMED.test(`fill: "${n}"`), n).toBe(true);
  expect(NAMED.test("const id = 'golden'")).toBe(false);
  expect(HEX.test('<div>#{seedCode(spec.seeds)}</div>')).toBe(false);
});
