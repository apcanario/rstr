import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PART_KINDS } from '../src/engine/parts/types';
import { STYLES } from '../src/engine/styles';
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
    // allowed: shared code, the library, the engine core, the parts' own types
    expect(violations(f('parts/type/swiss.ts'), "import { fit } from '../../text';\nimport { upper } from '../shared/text';\nimport type { TypePart } from '../types';\nimport { GRAPHICS } from '../../graphics';")).toEqual([]);
    expect(violations(f('parts/graphics/swiss.ts'), "import { GRAPHICS } from '../../graphics';")).toEqual([]);
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
