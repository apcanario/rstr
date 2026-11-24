/** The tuning rules of row R5 (proof.clumsyOf, coverOf) on hand-built Scenes (review R5 S5). */
import { describe, expect, test } from 'vitest';
import { rectQuad, type Rect } from '../src/engine/geom';
import { mkGraphic, mkRect } from '../src/engine/items';
import { clumsyOf, coverOf } from '../src/engine/proof';
import type { Item, Scene, TextItem } from '../src/engine/scene';
import { defaultSpec } from '../src/engine/spec';

const spec = defaultSpec({ layout: 1, colour: 2, graphic: 3, type: 4 });
const text = (r: Rect, px = 120, slot: TextItem['slot'] = 'title'): TextItem => ({
  kind: 'text', slot, part: 'block', font: { family: 'Inter', weight: 700 }, size: px, tracking: 0, runs: [], fill: '#000', quad: rectQuad(r), ink: ['#000'], px, min: 40,
});
const scene = (items: Item[], o: Partial<Scene> = {}): Scene => ({
  w: 1080, h: 1080, style: 'swiss', format: '1:1', palette: 'paper', pairing: 'x', layout: 'c0', frame: 'graphic-above', transform: 'none', graphics: [], ground: '#fff', items, fonts: [], faces: [], ...o,
});
const g = (name: string, r: Rect, params: Record<string, number> = {}) => mkGraphic(name, r, 1, 0, { a: '#f00', ink: '#000', bg: '#fff' }, ['#f00'], { W: 1080, mod: 156, ...params });
const rule = (why: string[], k: string) => why.some((w) => w.startsWith(k));

describe('tuning rules (spec 9.5 candidates, review R5 S2 and S5)', () => {
  test('a page of bare ground is empty; a page the text and a dense graphic cover is not', () => {
    expect(rule(clumsyOf(scene([]), spec), 'empty')).toBe(true);
    const full = scene([g('lines', { x: 0, y: 0, w: 1080, h: 600 }, { weight: 0.9, prog: 0 }), text({ x: 72, y: 640, w: 936, h: 360 })]);
    expect(clumsyOf(full, spec)).toEqual([]);
  });
  test('in 9:16 the story zones do not count: text over the band between them is enough', () => {
    const sc = scene([text({ x: 0, y: 260, w: 1080, h: 1340 })], { h: 1920, format: '9:16' });
    expect(rule(clumsyOf(sc, spec), 'empty')).toBe(false);
    // the same text on a 1:1 canvas of that height share would leave the rest bare
    expect(rule(clumsyOf(scene([text({ x: 0, y: 0, w: 1080, h: 300 })]), spec), 'empty')).toBe(true);
  });
  test('a full field of colour is not cover: a small graphic on it flags empty and small graphic', () => {
    const sc = scene([mkRect({ x: 0, y: 0, w: 1080, h: 1080 }, '#ff0'), g('disc', { x: 400, y: 100, w: 200, h: 200 }), text({ x: 72, y: 800, w: 600, h: 150 })], { frame: 'centred-low' });
    const why = clumsyOf(sc, spec);
    expect(rule(why, 'empty')).toBe(true);
    expect(rule(why, 'small graphic')).toBe(true);
  });
  test('a sparse graphic covers its box only by its ink; a plate covers it all', () => {
    const box = { x: 0, y: 0, w: 1080, h: 640 };
    const sparse = g('lattice', box, { cols: 6, weight: 0.003, filled: 0 }), dense = g('lattice', box, { cols: 6, weight: 0.03, filled: 0.5 });
    expect(coverOf(sparse)).toBeLessThan(0.4);
    expect(coverOf(dense)).toBe(1);
    expect(rule(clumsyOf(scene([sparse, text({ x: 72, y: 700, w: 936, h: 300 })]), spec), 'empty')).toBe(true);
    expect(rule(clumsyOf(scene([dense, text({ x: 72, y: 700, w: 936, h: 300 })]), spec), 'empty')).toBe(false);
    const plated = { ...sparse, plate: '#00f' };
    expect(coverOf(plated)).toBe(1);
    // crosshairs at the top of their count are never weighted as a full box
    expect(coverOf(g('crosshairs', box, { count: 16, size: 0.45 }))).toBeLessThan(1);
  });
  test('type only has its own threshold', () => {
    // about 58% bare: over the 55% of other layouts, under type only's 60%
    const items = [text({ x: 0, y: 0, w: 1080, h: 410 })];
    expect(rule(clumsyOf(scene(items, { frame: 'graphic-above' }), spec), 'empty')).toBe(true);
    expect(rule(clumsyOf(scene(items, { frame: 'type-only' }), spec), 'empty')).toBe(false);
  });
  test('a title of three words or fewer under 6% of the width is tiny; a fallback flags', () => {
    expect(rule(clumsyOf(scene([text({ x: 72, y: 72, w: 300, h: 60 }, 60)]), spec), 'tiny title')).toBe(true);
    expect(rule(clumsyOf(scene([text({ x: 72, y: 72, w: 300, h: 60 }, 70)]), spec), 'tiny title')).toBe(false);
    expect(clumsyOf(scene([], { layout: 'fallback' }), spec)).toContain('fallback');
  });
});
