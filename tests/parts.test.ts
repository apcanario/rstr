import { FORMAT_LIST } from '../src/engine/formats';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { choosePairing, choosePalette, partCtx } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { PART_KINDS, type Parts } from '../src/engine/parts/types';
import { specs } from '../src/engine/proof';
import { STYLES } from '../src/engine/styles';
import { compose5 } from '../src/engine/styles/compose';
import { STYLE_IDS } from '../src/engine/spec';

const ENGINE = join(__dirname, '..', 'src', 'engine');
const PARTS = join(ENGINE, 'parts'), STYLE_DIR = join(ENGINE, 'styles');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
const importsOf = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
/** Which part kind a path belongs to: one of the five, or null (shared code under parts/, or not a part). */
function kindOf(path: string): string | null {
  const r = relative(PARTS, path);
  if (r.startsWith('..')) return null;
  const top = r.split(sep)[0];
  return (PART_KINDS as readonly string[]).includes(top) ? top : null;
}
const inside = (path: string, dir: string) => !relative(dir, path).startsWith('..');

/**
 * The import rule of spec 8.7: a part never reads another part's internals. A file of one part kind imports no
 * file of another kind and no style; shared code under parts/ imports no part; a style file imports only its
 * five parts and the style constructor, and holds no logic of its own.
 */
export function violations(file: string, src: string): string[] {
  const out: string[] = [];
  const own = kindOf(file);
  for (const spec of importsOf(src)) {
    if (!spec.startsWith('.')) continue;
    const to = resolve(dirname(file), spec);
    const k = kindOf(to);
    if (inside(file, PARTS)) {
      if (k && k !== own) out.push(`${relative(ENGINE, file)} imports ${spec} (part ${k})`);
      if (inside(to, STYLE_DIR)) out.push(`${relative(ENGINE, file)} imports a style: ${spec}`);
    } else if (inside(file, STYLE_DIR) && !/(types|compose|index)\.ts$/.test(file)) {
      if (!k && !/[/\\]styles[/\\]types$/.test(to)) out.push(`${relative(ENGINE, file)} imports ${spec}, not a part`);
    } else if (k) out.push(`${relative(ENGINE, file)} reaches into part ${k}: ${spec}`);
  }
  if (inside(file, STYLE_DIR) && !/(types|compose|index)\.ts$/.test(file) && /=>|\bfunction\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')))
    out.push(`${relative(ENGINE, file)} holds logic; a style is a named set of parts`);
  return out;
}

describe('parts (spec 8.7)', () => {
  test('no file reaches into another part kind; styles only name their parts', () => {
    const all = walk(ENGINE).flatMap((f) => violations(f, readFileSync(f, 'utf8')));
    expect(all).toEqual([]);
  });
  test('the rule catches each kind of breach', () => {
    const f = (p: string) => join(ENGINE, ...p.split('/'));
    expect(violations(f('parts/type/swiss.ts'), "import { x } from '../layout/swiss';")).toHaveLength(1);
    expect(violations(f('parts/type/swiss.ts'), "import { x } from '../../styles/swiss';")).toHaveLength(1);
    expect(violations(f('parts/shared/text.ts'), "import { x } from '../graphics/swiss';")).toHaveLength(1);
    expect(violations(f('styles/swiss.ts'), "import { fit } from '../text';")).toHaveLength(1);
    expect(violations(f('styles/swiss.ts'), "export const x = () => 1;")).toHaveLength(1);
    expect(violations(f('layout.ts'), "import { swissType } from './parts/type/swiss';")).toHaveLength(1);
    // re-exports and dynamic imports count as imports (review R13 M3)
    expect(violations(f('parts/type/swiss.ts'), "export { x } from '../layout/swiss';")).toHaveLength(1);
    expect(violations(f('parts/type/swiss.ts'), "const x = await import('../graphics/swiss');")).toHaveLength(1);
    expect(violations(f('parts/type/swiss.ts'), "import type { X } from '../ground/vapor';")).toHaveLength(1);
    // allowed: shared code, the library, the engine core, the parts' own types
    expect(violations(f('parts/type/swiss.ts'), "import { fit } from '../../text';\nimport { upper } from '../shared/text';\nimport type { TypePart } from '../types';\nimport { GRAPHICS } from '../../graphics';")).toEqual([]);
    expect(violations(f('parts/graphics/swiss.ts'), "import { GRAPHICS } from '../../graphics';")).toEqual([]);
  });
  test('shared code under parts/ owned by one style is only the named exception', () => {
    // parts/shared/ is neutral ground for the import rule, so a style must not grow a private channel there
    // (review R13 M2). The one exception: shared/brutal.ts holds the Brutalist title lines and stretched block,
    // which its layout needs to size the band from the bundled faces (so the type seed never moves it, 9.3)
    // and its type needs to set the title. It is pure and reads nothing of either part.
    const owned = readdirSync(join(PARTS, 'shared')).filter((f) => (STYLE_IDS as readonly string[]).includes(f.replace(/\.tsx?$/, '')));
    expect(owned).toEqual(['brutal.ts']);
  });
  test('every layout composes with every type, ground and graphics part (spec 8.8)', () => {
    // parts meet only through the Plan's shared vocabulary and the Scene (review R13 S1): any mix runs, and
    // type either sets text or says it cannot (null); it never throws or silently drops every slot
    let ran = 0, set = 0;
    for (const spec of specs({ styles: ['swiss'], n: 2, start: 3, variants: 'cycle', modes: ['light'] })) for (const kl of STYLE_IDS) for (const kt of STYLE_IDS) for (const kg of STYLE_IDS) for (const kx of STYLE_IDS) {
      const parts: Parts = { layout: STYLES[kl].parts.layout, type: STYLES[kt].parts.type, ground: STYLES[kg].parts.ground, graphics: STYLES[kx].parts.graphics, palette: STYLES[kt].parts.palette };
      const s = { ...spec, style: kt };
      for (const k of [0, -1]) {
        const label = `layout ${kl}, type ${kt}, ground ${kg}, graphics ${kx}, ${spec.format}, k ${k}`;
        const run = () => compose5(parts, partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), k, STYLES[kl].parts.layout.margin));
        expect(run, label).not.toThrow();
        ran++;
        const r = run();
        if (!r) continue;
        set++;
        const { items } = r;
        const on = Object.values(s.text).some((t) => t.on);
        if (on) expect(items.some((i) => i.kind === 'text'), label + ': all text dropped').toBe(true);
      }
    }
    expect(ran).toBe(4 ** 4 * 2 * FORMAT_LIST.length * 2);
    console.log(`mixed parts: ${ran} compositions, ${set} set text, the rest returned null`);
    expect(set, 'mixes that set text').toBeGreaterThan(ran / 4);
  });
  test('every style is the five parts', () => {
    for (const id of STYLE_IDS) {
      const st = STYLES[id];
      expect(Object.keys(st.parts).sort()).toEqual([...PART_KINDS].sort());
      expect(st.layouts).toBe(st.parts.layout.layouts);
      expect(st.parts.palette.list.length).toBeGreaterThanOrEqual(8);
    }
  });
});
