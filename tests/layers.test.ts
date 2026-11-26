/**
 * Row R17: text layers (spec 8.6). The four Done-when lines that are tested here: a v1 design from Kept draws the same
 * Scene after migration; 9.2 for 1 to 8 layers in every mix of levels, per style, over 200 seed sets; a layer that
 * cannot fit is flagged, never dropped; and the state functions the Text tab calls. (The Text tab fitting without
 * scrolling at 8 layers is tested in the browser by tools/appcheck.py, run by `npm run smoke`.)
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { layerMix, runLayers } from '../src/engine/proof';
import { registerPhoto, testPhoto } from '../src/engine/photo';
import { check } from '../src/engine/invariants';
import { defaultSpec, extrasOf, leadsOf, LEVELS, MAX_LAYERS, migrate, slotsOf, STYLE_IDS, type Spec, type TextLayer } from '../src/engine/spec';
import { addLayer, moveLayer, removeLayer, restore, serialize, setLayerText, setLevel, toggleLayer, NO_LOCKS } from '../src/app/state';
import type { TextItem } from '../src/engine/scene';

/**
 * The fixture: 672 v1 specs (every style x format x mode x text variant, 3 seed sets; a quarter with marks, some with
 * the test photo, Swiss and Postmodern with positions set) and a hash of the whole Scene each drew, written by the
 * engine at e510dbc, the commit before R17. The hash leaves out only what R17 adds to a Scene (`lid`, `flagged`).
 */
const FIX: { spec: Record<string, unknown>; fp: string; frame: string }[] = JSON.parse(readFileSync(new URL('./fixtures/v1-kept.json', import.meta.url), 'utf8'));
const strip = (k: string, v: unknown) => (k === 'lid' || k === 'flagged' ? undefined : v);
function fp(sc: unknown): string {
  const s = JSON.stringify(sc, strip);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16) + ':' + s.length;
}

beforeAll(() => { registerPhoto(testPhoto('test-portrait', 3000, 4000, 7)); });

describe('migration (spec 8.6): every v1 design in Kept opens and draws the same layout', () => {
  test('the fixture is v1 and covers every style, format and mode', () => {
    expect(FIX.length).toBe(672);
    expect(FIX.every((f) => f.spec.v === 1 && !Array.isArray(f.spec.text))).toBe(true);
    expect(new Set(FIX.map((f) => `${f.spec.style} ${f.spec.format} ${f.spec.mode}`)).size).toBe(32);
  });
  test('restored from the saved Kept list, each draws the same Scene as before R17 (tested on the Scene)', () => {
    const raw = JSON.stringify({ v: 1, spec: FIX[0].spec, back: [], kept: FIX.map((f) => f.spec), locks: NO_LOCKS, advanced: false });
    const saved = restore(raw, () => defaultSpec());
    expect(saved.kept).toHaveLength(Math.min(FIX.length, 500));
    const off: string[] = [];
    saved.kept.forEach((s, i) => {
      expect(s.v).toBe(2);
      expect(s.text.map((l) => [l.id, l.level])).toEqual([['t1', 'headline'], ['t2', 'subhead'], ['t3', 'data'], ['t4', 'caption']]);
      const sc = solve(s, stubMeasure).scene;
      if (fp(sc) !== FIX[i].fp) off.push(`${i} ${FIX[i].frame} -> ${sc.frame} ${JSON.stringify(FIX[i].spec)}`);
      expect(sc.flagged ?? []).toEqual([]);
    });
    expect(off, off.slice(0, 3).join('\n')).toEqual([]);
  }, 240000);
  test('the rest of the fixture (past Kept\'s 500) migrates the same way through migrate()', () => {
    const off = FIX.slice(500).filter((f) => fp(solve(migrate(f.spec), stubMeasure).scene) !== f.fp);
    expect(off.length).toBe(0);
  }, 240000);
  test('a migrated design saves and opens again unchanged; slots map to levels and keep on/off, words and position', () => {
    const v1 = FIX.find((f) => (f.spec.text as any).title.pos)!.spec;
    const s = migrate(v1);
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(restore(serialize({ spec: s, back: [s], kept: [s], locks: NO_LOCKS, advanced: false }), () => defaultSpec()).kept[0]).toEqual(s);
    const t = v1.text as any;
    expect(slotsOf(s.text)).toEqual({ title: t.title, subtitle: t.subtitle, info: t.info, caption: t.caption });
  });
});

describe('9.2 for 1 to 8 layers in every mix of levels, per style (tested over 200 seed sets)', () => {
  test('the mixes: every count 1 to 8, every level alone at every count, and mixed levels', () => {
    const ns = new Set<number>(), alone = new Set<string>();
    let mixed = 0;
    for (let i = 0; i < 200; i++) {
      const L = layerMix(i), lv = new Set(L.map((l) => l.level));
      ns.add(L.length);
      if (lv.size === 1) alone.add(`${[...lv][0]} ${L.length}`);
      if (lv.size > 2) mixed++;
    }
    expect([...ns].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const l of LEVELS) for (let n = 1; n <= 8; n++) expect(alone.has(`${l} ${n}`), `${l} x${n}`).toBe(true);
    expect(mixed).toBeGreaterThan(80);
  });
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runLayers(stubMeasure, { styles: [style], n: 200 });
      expect(r.count).toBe(200);
      expect(r.failures, r.failures.slice(0, 2).map((f) => JSON.stringify(f)).join('\n')).toEqual([]);
      expect(r.drawnOrFlagged, 'a layer neither drawn nor flagged').toEqual([]);
      // most layers find room: a run that flagged nearly everything would pass the two lines above
      expect(r.flagged / r.layers, `${r.flagged} of ${r.layers} flagged`).toBeLessThan(0.12);
    });
  }
});

describe('a layer that cannot fit is flagged, never dropped (spec 8.6)', () => {
  const crowd = (): TextLayer[] => Array.from({ length: 8 }, (_, i) => ({ id: 't' + (i + 1), level: 'headline' as const, v: 'Eight plain words make a long poster title and six more words of it', on: true, pos: null }));
  for (const style of STYLE_IDS) {
    test(`${style}: eight long headlines on a 1:1 flag what does not fit; it stays in the spec, every other layer is drawn, 9.2 holds`, () => {
      const s = defaultSpec({ layout: 31, colour: 32, graphic: 33, type: 34 });
      s.style = style; s.format = '1:1'; s.text = crowd();
      const before = JSON.stringify(s.text);
      const sc = solve(s, stubMeasure).scene;
      expect(JSON.stringify(s.text)).toBe(before);
      const drawn = new Set(sc.items.filter((i): i is TextItem => i.kind === 'text').map((i) => i.lid));
      expect(sc.flagged?.length ?? 0).toBeGreaterThan(0);
      for (const L of s.text) expect(drawn.has(L.id) !== !!sc.flagged?.includes(L.id), L.id).toBe(true);
      // the lead headline is never what gives way
      expect(sc.flagged).not.toContain('t1');
      expect(check(sc)).toEqual([]);
    });
  }
  test('the lowest levels shrink first: in every crowded design, a caption or label set by the placer is never larger than a second subhead it placed (t2 and t4 lead their slots)', () => {
    let seen = 0;
    for (const style of STYLE_IDS) for (let i = 0; i < 40; i++) {
      const s = defaultSpec({ layout: 900 + i, colour: 2, graphic: 3, type: 4 });
      s.style = style; s.format = '1:1';
      s.text = [{ id: 't1', level: 'headline', v: 'Signal', on: true, pos: null }, ...['subhead', 'subhead', 'caption', 'label', 'caption'].map((level, j) => ({ id: 't' + (j + 2), level: level as TextLayer['level'], v: 'A short line of words', on: true, pos: null }))];
      const sc = solve(s, stubMeasure).scene, px = (id: string) => (sc.items.find((it) => it.kind === 'text' && it.lid === id) as TextItem | undefined)?.px;
      const sub = px('t3'), low = [px('t5'), px('t6')].filter((v): v is number => v != null);
      if (sub == null) continue;
      seen++;
      for (const v of low) expect(v).toBeLessThanOrEqual(sub + 1e-6);
    }
    expect(seen).toBeGreaterThan(100);
  });
  test('a v1 design shortened in its fallback flags the slot\'s layer (nothing shortened in silence)', () => {
    const s = defaultSpec({ layout: 5, colour: 6, graphic: 7, type: 8 });
    s.format = '1:1';
    const long = Array.from({ length: 60 }, () => 'word').join(' ');
    s.text = s.text.map((l) => (l.level === 'subhead' ? { ...l, v: long } : l));
    const sc = solve(s, stubMeasure).scene;
    const sub = sc.items.filter((i): i is TextItem => i.kind === 'text' && i.lid === 't2');
    if (sub.some((i) => i.runs.some((r) => r.s.includes('…'))) || !sub.length) expect(sc.flagged).toContain('t2');
    else expect(sc.flagged ?? []).not.toContain('t2');
  });
});

describe('layers in the spec and the Text tab\'s state (spec 8.6, 10.2, 10.3)', () => {
  test('add up to eight, remove, reorder, change level, type, switch off', () => {
    let s: Spec = defaultSpec();
    s = { ...s, text: [] };
    for (const l of LEVELS) s = addLayer(s, l);
    s = addLayer(addLayer(addLayer(s, 'body'), 'body'), 'body');
    expect(s.text).toHaveLength(MAX_LAYERS);
    expect(new Set(s.text.map((l) => l.id)).size).toBe(MAX_LAYERS);
    s = removeLayer(s, s.text[2].id);
    expect(s.text).toHaveLength(7);
    const id = s.text[3].id;
    s = moveLayer(s, id, -1);
    expect(s.text[2].id).toBe(id);
    expect(moveLayer(s, s.text[0].id, -1)).toBe(s);
    s = setLayerText(s, id, 'Where: Lisboa · When: Today');
    s = setLevel(s, id, 'data');
    expect(s.text[2].v).toEqual([{ k: 'Where', v: 'Lisboa' }, { k: 'When', v: 'Today' }]);
    s = setLevel(s, id, 'body');
    expect(s.text[2].v).toBe('Where: Lisboa · When: Today');
    s = toggleLayer(s, id);
    expect(s.text[2].on).toBe(false);
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  test('no layers is a background plate: no text drawn, nothing flagged, 9.2 holds', () => {
    for (const style of STYLE_IDS) {
      const s = { ...defaultSpec(), style, text: [] };
      const sc = solve(s, stubMeasure).scene;
      expect(sc.items.some((i) => i.kind === 'text')).toBe(false);
      expect(sc.flagged).toBeUndefined();
      expect(check(sc)).toEqual([]);
    }
  });
  test('with two headlines the first in the list leads; reordering them swaps the lead', () => {
    const s = defaultSpec();
    s.text = [{ id: 'a', level: 'headline', v: 'First', on: true, pos: null }, { id: 'b', level: 'headline', v: 'Second', on: true, pos: null }];
    expect(leadsOf(s.text).title?.id).toBe('a');
    expect(extrasOf(s.text).map((l) => l.id)).toEqual(['b']);
    expect(leadsOf(moveLayer(s, 'b', -1).text).title?.id).toBe('b');
    // a headline that is off does not lead
    expect(leadsOf(toggleLayer(s, 'a').text).title?.id).toBe('b');
  });
  test('two layers of one level are set alike (same face, case and ink role) and kept apart', () => {
    let n = 0;
    for (const style of STYLE_IDS) for (let i = 0; i < 30; i++) {
      const s = defaultSpec({ layout: 400 + i, colour: 1, graphic: 2, type: 3 });
      s.style = style;
      s.text = [{ id: 'h', level: 'headline', v: 'Signal', on: true, pos: null }, { id: 'b1', level: 'body', v: 'One user, one phone.', on: true, pos: null }, { id: 'b2', level: 'body', v: 'Rules, not drawings.', on: true, pos: null }];
      const sc = solve(s, stubMeasure).scene;
      const a = sc.items.find((it): it is TextItem => it.kind === 'text' && it.lid === 'b1'), b = sc.items.find((it): it is TextItem => it.kind === 'text' && it.lid === 'b2');
      if (!a || !b) continue;
      n++;
      expect(b.font).toEqual(a.font);
      expect(b.fill).toEqual(a.fill);
      expect(check(sc)).toEqual([]);
    }
    expect(n).toBeGreaterThan(100);
  });
  test('a migrated spec with junk layers keeps the good ones, at most eight, ids unique', () => {
    const s = migrate({ v: 2, style: 'swiss', text: [null, { level: 'nope', v: 'x' }, ...Array.from({ length: 12 }, () => ({ id: 'same', level: 'body', v: 'x', on: true }))] });
    expect(s.text).toHaveLength(MAX_LAYERS);
    expect(new Set(s.text.map((l) => l.id)).size).toBe(MAX_LAYERS);
    expect(migrate({ v: 2, text: 'junk' }).text).toHaveLength(4);
  });
});
