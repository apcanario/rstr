import { describe, expect, test } from 'vitest';
import { BACK_STEPS, infoText, NO_LOCKS, parseInfo, pushBack, reroll, restore, serialize, shuffle, withStyle, type Locks } from '../src/app/state';
import { choosePalette, choosePairing, layout } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { defaultSpec, FACETS, migrate, type Spec } from '../src/engine/spec';

/** A seeded seed source, so the tests are reproducible. */
function counter(start = 1000) {
  let n = start;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0);
}

describe('Shuffle and locks (spec 10.1)', () => {
  test('a locked facet survives 50 shuffles: seed, pick and what it draws; unlocked facets change', () => {
    for (const style of ['swiss', 'pomo', 'brutal', 'vapor'] as const) {
      for (const f of FACETS) {
        const seed = counter(f.length * 7 + style.length);
        const locks: Locks = { ...NO_LOCKS, [f]: true };
        let s: Spec = { ...defaultSpec({ layout: 11, colour: 22, graphic: 33, type: 44 }), style };
        // a hand-set pick on the locked facet must survive too
        if (f === 'colour') s.pick.palette = choosePalette({ ...s, seeds: { ...s.seeds, colour: 99 } }).id;
        if (f === 'type') s.pick.pairing = choosePairing({ ...s, seeds: { ...s.seeds, type: 99 } }).id;
        const first = s, palette = choosePalette(s).id, pairing = choosePairing(s).id;
        const changed = new Set<string>();
        for (let i = 0; i < 50; i++) {
          const prev = s;
          s = shuffle(s, locks, seed);
          expect(s.seeds[f]).toBe(first.seeds[f]);
          expect(s.pick).toEqual({ ...{ palette: null, pairing: null, motif: null, layout: null }, ...(f === 'colour' ? { palette: first.pick.palette } : f === 'type' ? { pairing: first.pick.pairing } : {}) });
          if (f === 'colour') expect(choosePalette(s).id).toBe(palette);
          if (f === 'type') expect(choosePairing(s).id).toBe(pairing);
          for (const g of FACETS) if (s.seeds[g] !== prev.seeds[g]) changed.add(g);
          expect(s.style).toBe(first.style);
          expect(s.format).toBe(first.format);
          expect(s.text).toEqual(first.text);
        }
        expect([...changed].sort()).toEqual(FACETS.filter((g) => g !== f).sort());
      }
    }
  });
  test('a locked colour facet keeps its palette on the laid-out Scene over 50 shuffles', () => {
    const seed = counter(5);
    let s = defaultSpec({ colour: 77 });
    const want = layout(s, stubMeasure).palette;
    for (let i = 0; i < 50; i++) {
      s = shuffle(s, { ...NO_LOCKS, colour: true }, seed);
      expect(layout(s, stubMeasure).palette).toBe(want);
    }
  });
  test('Shuffle with nothing locked clears every pick; format, mode, finish and marks stay (spec 3)', () => {
    const s: Spec = { ...defaultSpec(), format: '9:16', mode: 'dark', finish: 'grain', marks: 'full', pick: { palette: 'paper', pairing: 'x', motif: 'topo', layout: 'full-bleed' } };
    const n = shuffle(s, NO_LOCKS, counter());
    expect(n.pick).toEqual({ palette: null, pairing: null, motif: null, layout: null });
    expect([n.format, n.mode, n.finish, n.marks]).toEqual(['9:16', 'dark', 'grain', 'full']);
    for (const f of FACETS) expect(n.seeds[f]).not.toBe(s.seeds[f]);
  });
  test('a reroll changes one facet and clears its pick only', () => {
    const s: Spec = { ...defaultSpec(), pick: { palette: 'paper', pairing: 'p', motif: 'topo', layout: 'l' } };
    const n = reroll(s, 'colour', counter());
    expect(n.seeds.colour).not.toBe(s.seeds.colour);
    expect({ ...n.seeds, colour: 0 }).toEqual({ ...s.seeds, colour: 0 });
    expect(n.pick).toEqual({ ...s.pick, palette: null });
  });
  test('a style change keeps seeds and clears picks', () => {
    const s: Spec = { ...defaultSpec(), pick: { palette: 'paper', pairing: 'p', motif: 'topo', layout: 'l' } };
    const n = withStyle(s, 'brutal');
    expect(n.style).toBe('brutal');
    expect(n.seeds).toEqual(s.seeds);
    expect(n.pick).toEqual({ palette: null, pairing: null, motif: null, layout: null });
  });
});

describe('Back (spec 10.1)', () => {
  test('Back restores every previous design exactly, newest first', () => {
    const seed = counter(9);
    let cur = defaultSpec();
    let back: Spec[] = [];
    const seen: string[] = [];
    const steps: ((s: Spec) => Spec)[] = [
      (s) => shuffle(s, NO_LOCKS, seed),
      (s) => withStyle(s, 'pomo'),
      (s) => ({ ...s, format: '9:16' }),
      (s) => ({ ...s, mode: 'dark' }),
      (s) => ({ ...s, text: { ...s.text, title: { ...s.text.title, v: 'Changed\ntitle' } } }),
      (s) => ({ ...s, text: { ...s.text, info: { ...s.text.info, on: false } } }),
      (s) => reroll(s, 'type', seed),
      (s) => shuffle(s, { ...NO_LOCKS, colour: true }, seed),
    ];
    for (const f of steps) {
      seen.push(JSON.stringify(cur));
      back = pushBack(back, cur);
      cur = f(cur);
    }
    while (back.length) {
      cur = back[back.length - 1];
      back = back.slice(0, -1);
      expect(JSON.stringify(cur)).toBe(seen.pop());
    }
    expect(JSON.stringify(cur)).toBe(JSON.stringify(defaultSpec()));
  });
  test(`Back keeps the newest ${BACK_STEPS} steps`, () => {
    let back: Spec[] = [];
    for (let i = 0; i < 45; i++) back = pushBack(back, defaultSpec({ layout: i }));
    expect(back).toHaveLength(BACK_STEPS);
    expect(back[0].seeds.layout).toBe(45 - BACK_STEPS);
    expect(back[BACK_STEPS - 1].seeds.layout).toBe(44);
  });
});

describe('saved on the phone (spec 10.1)', () => {
  test('the design, Back steps, Kept, locks and the Simple/Advanced switch come back exactly', () => {
    const spec: Spec = { ...defaultSpec({ layout: 5 }), style: 'vapor', format: '1:1', mode: 'dark' };
    const back = [defaultSpec({ layout: 1 }), defaultSpec({ layout: 2 })];
    const kept = [defaultSpec({ colour: 8 }), { ...defaultSpec({ colour: 9 }), style: 'brutal' as const }];
    const saved = { spec, back, kept, locks: { ...NO_LOCKS, type: true }, advanced: true };
    const r = restore(serialize(saved), () => defaultSpec());
    expect(r).toEqual(saved);
  });
  test('nothing saved, broken JSON or junk give the defaults and never throw', () => {
    for (const raw of [null, '', '{', '[]', '42', JSON.stringify({ spec: 'x', back: 'y', kept: [null, 5], locks: 3, advanced: 'yes' })]) {
      const r = restore(raw, () => defaultSpec({ layout: 123 }));
      expect(r.back.every((s) => s.v === 1)).toBe(true);
      expect(r.kept.every((s) => s.v === 1)).toBe(true);
      expect(r.advanced).toBe(false);
      expect(r.locks).toEqual(NO_LOCKS);
      expect(r.spec.v).toBe(1);
    }
    expect(restore(null, () => defaultSpec({ layout: 123 })).spec.seeds.layout).toBe(123);
  });
  test('saved specs are migrated, and Back keeps at most its step count', () => {
    const r = restore(JSON.stringify({ spec: { style: 'pomo', palette: 'x' }, back: Array.from({ length: 40 }, (_, i) => ({ v: 1, seeds: { layout: i } })), kept: [] }), () => defaultSpec());
    expect(r.spec).toEqual(migrate({ style: 'pomo', palette: 'x' }));
    expect(r.back).toHaveLength(BACK_STEPS);
    expect(r.back[BACK_STEPS - 1].seeds.layout).toBe(39);
  });
});

describe('the Info field', () => {
  test('round trip of label: value pairs, at most three', () => {
    const v = defaultSpec().text.info.v;
    expect(parseInfo(infoText(v))).toEqual(v);
    expect(parseInfo('Where: Lisboa · When: Today · A: 1 · B: 2')).toHaveLength(3);
    expect(parseInfo('Just a value')).toEqual([{ k: '', v: 'Just a value' }]);
    expect(parseInfo('')).toEqual([]);
  });
});
