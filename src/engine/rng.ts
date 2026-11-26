/** Seeded generators. Every random choice in the engine comes from here. */
export type Rng = () => number;

/** mulberry32: small, fast, good enough for layout decisions. Same as the spike. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a seed with a salt into a new 32-bit seed (for derived streams). */
export function mix(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

export const pick = <T>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];

export function shuffle<T>(r: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Advance a generator n draws. */
export function skip(r: Rng, n: number): Rng {
  for (let i = 0; i < n; i++) r();
  return r;
}

/** Wrap a generator so it counts its draws. */
export function counted(r: Rng): Rng & { n: number } {
  const f = (() => {
    f.n++;
    return r();
  }) as Rng & { n: number };
  f.n = 0;
  return f;
}

/**
 * Per-pixel noise by position (R16): a hash of a seed and an index, in [0, 1). Unlike a running generator, any pixel
 * can be read on its own, so a strip of a big render draws exactly the noise of the same rows of the whole.
 */
export function noiseAt(seed: number, i: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
