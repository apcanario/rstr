import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

test('Math.random appears only in seed creation (newSeed in src/engine/spec.ts)', () => {
  const hits: string[] = [];
  for (const f of files(join(__dirname, '..', 'src'))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('Math.random')) hits.push(`${f.split('src')[1]}:${i + 1}`);
    });
  }
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatch(/engine[\\/]spec\.ts:/);
  const src = readFileSync(join(__dirname, '..', 'src', 'engine', 'spec.ts'), 'utf8');
  const fn = src.slice(src.indexOf('export function newSeed'), src.indexOf('export function newSeeds'));
  expect(fn).toContain('Math.random');
});
