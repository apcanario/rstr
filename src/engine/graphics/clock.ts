/** Time for motion. t null means a still (phase 1 always passes null). */
export interface Time { s: number; dur: number; }
export interface Clock { on: boolean; ph: number; rev: (i: number) => number; }
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
export function clock(t: Time | null): Clock {
  if (!t) return { on: false, ph: 0.3, rev: () => 1 };
  return { on: true, ph: t.s / t.dur, rev: (i) => ease((t.s - 0.15 - i * 0.12) / 0.7) * (1 - ease((t.s - (t.dur - 0.5)) / 0.4)) };
}
export const TAU = Math.PI * 2;
export { clamp };
