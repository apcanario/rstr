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
import { layerCase, layerMix, runLayers } from '../src/engine/proof';
import { registerPhoto, testPhoto } from '../src/engine/photo';
import { check } from '../src/engine/invariants';
import { defaultSpec, extrasOf, leadsOf, LEVELS, MAX_LAYERS, migrate, slotsOf, STYLE_IDS, type Spec, type TextLayer } from '../src/engine/spec';
import { addLayer, moveLayer, removeLayer, restore, serialize, setLayerText, setLevel, toggleLayer, NO_LOCKS } from '../src/app/state';
import type { GraphicItem, Scene, TextItem } from '../src/engine/scene';
import { overlaps } from '../src/engine/geom';
import { FORMAT_LIST } from '../src/engine/formats';

/**
 * The fixture: 672 v1 specs (every style x format x mode x text variant, 3 seed sets; a quarter with marks, some with
 * the test photo, Swiss and Postmodern with positions set) and a hash of the whole Scene each drew, written by the
 * engine at e510dbc, the commit before R17. The hash leaves out only what R17 adds to a Scene (`lid`, `flagged`) and
 * what R12 adds (`mixed`, the recipe of a colour mixed from two roles; `boxed`, the photocopy boxed word's mark). R12
 * (Carried from bundle 3) pushes a photocopy boxed word clear of earlier words' paper halos on purpose: the 16 entries
 * marked `since: "R12"` (photocopy copy-stack designs whose boxed word moved) were recorded again at R12. Review R12 E1
 * chooses the photo's place once over every form of the palette list: the 6 entries marked `since: "R12 E1"` (Swiss
 * designs with the test photo, of 101 with it) were recorded again then. Review bundle 6 S1 keeps later words' paper
 * halos off the boxed word's letters: the 16 entries marked `since: "bundle 6 S1"` (photocopy copy-stack designs, 8 of
 * them R12's) were recorded again then; the other 642 still hold the pre-R17 Scene.
 */
const FIX: { spec: Record<string, unknown>; fp: string; frame: string }[] = JSON.parse(readFileSync(new URL('./fixtures/v1-kept.json', import.meta.url), 'utf8'));
const strip = (k: string, v: unknown) => (k === 'lid' || k === 'flagged' || k === 'mixed' || k === 'boxed' ? undefined : v);
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

/** Flagged share of the 200-list run per style, measured at the R17 fixes (stub measure), plus a margin. */
const FLAG_CEILING: Record<string, number> = { swiss: 0.09, pomo: 0.08, brutal: 0.1, vapor: 0.09 };
const texts = (sc: Scene, id: string) => sc.items.filter((i): i is TextItem => i.kind === 'text' && i.lid === id);
const maxPx = (ts: TextItem[]) => Math.max(0, ...ts.map((t) => t.px));

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
  test('every block of 64 lists has every count x format x mode (review R17 E2)', () => {
    for (const b of [0, 64, 128]) {
      const seen = new Set<string>();
      for (let i = b; i < b + 64; i++) { const c = layerCase(i); seen.add(`${layerMix(i).length} ${c.format} ${c.mode}`); }
      expect(seen.size).toBe(64);
    }
    // with one format given (smoke runs each format on its own), every count in both modes within 16 lists
    const one = new Set<string>();
    for (let i = 0; i < 16; i++) one.add(`${layerMix(i).length} ${layerCase(i, ['9:16']).format} ${layerCase(i, ['9:16']).mode}`);
    expect(one.size).toBe(16);
  });
  for (const style of STYLE_IDS) {
    test(style, () => {
      const r = runLayers(stubMeasure, { styles: [style], n: 200 });
      expect(r.count).toBe(200);
      expect(r.failures, r.failures.slice(0, 2).map((f) => JSON.stringify(f)).join('\n')).toEqual([]);
      expect(r.drawnOrFlagged, 'a layer neither drawn nor flagged').toEqual([]);
      // Carried R12 (from R17): a second layer's room is checked in every palette and mode before it is taken, so no
      // list falls back where its slots alone would not (was up to 4 of 200 per format in Swiss and Vaporwave)
      expect(r.layerFallbacks, 'a fallback caused by the layers').toEqual([]);
      // most layers find room: a run that flagged nearly everything would pass the two lines above. The ceiling is the
      // share this run flags plus a margin (review R17 S5); a third of the lists are one level throughout, up to eight
      // headlines, which cannot all be set at the lead's size (spec 8.6: set alike, else flagged)
      expect(r.flagged / r.layers, `${r.flagged} of ${r.layers} flagged`).toBeLessThan(FLAG_CEILING[style]);
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
  test('the lowest levels shrink first: in every crowded design, a label set by the placer is never larger than a second subhead placed before it, and a second caption is set like the lead caption (t2 and t4 lead their slots)', () => {
    let seen = 0;
    for (const style of STYLE_IDS) for (let i = 0; i < 40; i++) {
      const s = defaultSpec({ layout: 900 + i, colour: 2, graphic: 3, type: 4 });
      s.style = style; s.format = '1:1';
      s.text = [{ id: 't1', level: 'headline', v: 'Signal', on: true, pos: null }, ...['subhead', 'subhead', 'caption', 'label', 'caption'].map((level, j) => ({ id: 't' + (j + 2), level: level as TextLayer['level'], v: 'A short line of words', on: true, pos: null }))];
      const sc = solve(s, stubMeasure).scene, px = (id: string) => (sc.items.find((it) => it.kind === 'text' && it.lid === id) as TextItem | undefined)?.px;
      const sub = px('t3'), low = [px('t5')].filter((v): v is number => v != null);
      if (sub == null) continue;
      seen++;
      for (const v of low) expect(v).toBeLessThanOrEqual(sub + 1e-6);
      const c1 = px('t4'), c2 = px('t6');
      if (c1 != null && c2 != null && !sc.items.some((it) => it.kind === 'text' && it.lid === 't4' && it.extra)) expect(Math.abs(c2 / c1 - 1)).toBeLessThanOrEqual(0.25 + 1e-6);
    }
    expect(seen).toBeGreaterThan(100);
  });
  test('a v1 design shortened in its fallback flags the slot\'s layer (nothing shortened in silence)', () => {
    // a subtitle of 60 words cannot fit any candidate: the fallback shortens it (review R17 M5: asserted, not assumed)
    const s = defaultSpec({ layout: 5, colour: 6, graphic: 7, type: 8 });
    s.format = '1:1';
    const long = Array.from({ length: 60 }, () => 'word').join(' ');
    s.text = s.text.map((l) => (l.level === 'subhead' ? { ...l, v: long } : l));
    const sc = solve(s, stubMeasure).scene;
    expect(sc.layout).toBe('fallback');
    const sub = texts(sc, 't2');
    expect(sub.length).toBeGreaterThan(0);
    expect(sub.some((i) => i.runs.some((r) => r.s.includes('…')))).toBe(true);
    expect(sc.flagged).toEqual(['t2']);
    // the same words, short enough to fit, flag nothing
    const ok = { ...s, text: s.text.map((l) => (l.level === 'subhead' ? { ...l, v: 'A few words' } : l)) };
    expect(solve(ok, stubMeasure).scene.flagged ?? []).toEqual([]);
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

describe('review R17: a second layer of a slot\'s level is set like the lead (spec 8.6), and placed by the rules', () => {
  const caseOf = (ts: TextItem[]) => (ts.every((t) => t.runs.every((r) => r.s === r.s.toLocaleUpperCase('en'))) ? 'upper' : 'mixed');
  const pairs = [
    { level: 'headline', a: 'Signal and noise', b: 'Second title here' },
    { level: 'subhead', a: 'A modular identity system', b: 'Set by hand' },
    { level: 'caption', a: 'Vol. 01 generated', b: 'Lisboa 2026' },
  ] as const;
  for (const style of STYLE_IDS) {
    test(`${style}: lead and second layer of one level: same faces, same case, size 0.8 to 1.25 of the lead (Brutalist: every line at the full width), 9.2 holds`, () => {
      let n = 0;
      for (const p of pairs) for (let i = 0; i < 24; i++) {
        const s = defaultSpec({ layout: 600 + i, colour: 7, graphic: 8, type: 9 });
        s.style = style; s.format = FORMAT_LIST[i % 4]; s.mode = i % 8 < 4 ? 'light' : 'dark';
        s.text = [{ id: 'a', level: p.level, v: p.a, on: true, pos: null }, { id: 'b', level: p.level, v: p.b, on: true, pos: null }];
        if (p.level !== 'headline') s.text.unshift({ id: 'h', level: 'headline', v: 'Signal', on: true, pos: null });
        const sc = solve(s, stubMeasure).scene;
        expect(check(sc)).toEqual([]);
        const A = texts(sc, 'a'), B = texts(sc, 'b');
        if (!B.length) { expect(sc.flagged).toContain('b'); continue; }
        n++;
        expect(A.every((t) => !t.extra) && B.every((t) => t.extra)).toBe(true);
        // the photocopy title takes a face per word from the pairing's three (8.2): the second's are among the lead's
        const fa = new Set(A.map((t) => t.font.family));
        for (const t of B) expect(fa.has(t.font.family), `${style} ${p.level} ${t.font.family} not in ${[...fa]}`).toBe(true);
        if (!(style === 'pomo' && sc.frame.startsWith('copy-') && p.level === 'headline')) expect(caseOf(B)).toBe(caseOf(A));
        if (style === 'brutal' && p.level === 'headline') {
          // every line of the second block at the full width of the rows, as the lead's are (8.3)
          const w = (t: TextItem) => { const r = t.runs[0], mt = stubMeasure(r.s, t.font, t.size); return (mt.left + mt.right) * (r.sx ?? 1); };
          const ws = B.map(w);
          for (const x of ws) expect(Math.abs(x - ws[0]) / ws[0]).toBeLessThan(0.01);
          if (sc.frame !== 'title-up') expect(Math.abs(ws[0] - w(A[0])) / w(A[0])).toBeLessThan(0.01);
        } else {
          const r = maxPx(B) / maxPx(A);
          expect(r, `${style} ${p.level} seed ${i}`).toBeGreaterThanOrEqual(0.8 - 1e-6);
          expect(r, `${style} ${p.level} seed ${i}`).toBeLessThanOrEqual(1.25 + 1e-6);
        }
      }
      expect(n, 'second layers drawn').toBeGreaterThan(40);
    });
  }

  test('Vaporwave: no layer beyond the slots covers the sun (8.4, review R17 S2)', () => {
    let seen = 0;
    for (let i = 0; i < 160; i++) {
      const s = defaultSpec({ layout: 300 + i, colour: 5, graphic: 6, type: 7 });
      s.style = 'vapor'; s.format = FORMAT_LIST[i % 4];
      s.text = layerMix(64 + i);
      const sc = solve(s, stubMeasure).scene;
      const suns = sc.items.filter((it): it is GraphicItem => it.kind === 'graphic' && it.name === 'sun');
      if (!suns.length) continue;
      seen++;
      for (const it of sc.items) if (it.kind === 'text' && it.extra) for (const g of suns) expect(overlaps(g.quad, it.quad), `${i} ${it.part} over the sun`).toBe(false);
    }
    expect(seen).toBeGreaterThan(30);
  });

  test('Brutalist and Swiss outside full-bleed: no body or label layer sits across a graphic the style\'s own text keeps off (review R17 S3)', () => {
    let n = 0;
    for (const style of ['brutal', 'swiss'] as const) for (let i = 0; i < 120; i++) {
      const s = defaultSpec({ layout: 500 + i, colour: 5, graphic: 6, type: 7 });
      s.style = style; s.format = FORMAT_LIST[i % 4];
      s.text = [{ id: 'h', level: 'headline', v: 'Signal and noise', on: true, pos: null }, { id: 'b', level: 'body', v: 'One user, one phone.', on: true, pos: null }, { id: 'l', level: 'label', v: 'Free entry', on: true, pos: null }];
      const sc = solve(s, stubMeasure).scene;
      if (style === 'swiss' && sc.frame === 'full-bleed') continue;
      const lead = sc.items.filter((it): it is TextItem => it.kind === 'text' && !it.extra);
      const gs = sc.items.filter((it): it is GraphicItem => it.kind === 'graphic' && it.layer !== 'ground' && !it.pass && it.layer !== 'mark' && !lead.some((t) => overlaps(it.quad, t.quad)));
      for (const t of sc.items) if (t.kind === 'text' && t.extra) { n++; for (const g of gs) expect(overlaps(g.quad, t.quad), `${style} ${i} ${t.part} on ${g.name}`).toBe(false); }
    }
    expect(n).toBeGreaterThan(200);
  });

  test('a layer\'s position (Swiss, Postmodern) chooses the end of the text area it is looked for from (spec 10.3, review R17 S4)', () => {
    let moved = 0, n = 0;
    for (const style of ['swiss', 'pomo'] as const) for (let i = 0; i < 30; i++) {
      const s = defaultSpec({ layout: 800 + i, colour: 1, graphic: 2, type: 3 });
      s.style = style; s.format = '3:4';
      const L = (pos: string | null): TextLayer[] => [{ id: 'h', level: 'headline', v: 'Signal', on: true, pos: null }, { id: 'b', level: 'body', v: 'One user, one phone.', on: true, pos }];
      const y = (sc: Scene) => { const t = texts(sc, 'b'); return t.length ? Math.min(...t[0].quad.map((p) => p[1])) : null; };
      const head = y(solve({ ...s, text: L('head') }, stubMeasure).scene), foot = y(solve({ ...s, text: L('foot') }, stubMeasure).scene);
      if (head == null || foot == null) continue;
      n++;
      if (head < foot - 1) moved++;
      expect(head).toBeLessThanOrEqual(foot + 1e-6);
    }
    expect(n).toBeGreaterThan(40);
    expect(moved / n).toBeGreaterThan(0.6);
  });

  test('the lowest levels give way first: a flagged layer weighs more than any number below it, and a lower lead that took its room makes way (review R17 S1)', () => {
    let crowded = 0, fixed = 0;
    for (const style of STYLE_IDS) for (let i = 0; i < 40; i++) {
      const s = defaultSpec({ layout: 950 + i, colour: 2, graphic: 3, type: 4 });
      s.style = style; s.format = '9:16';
      s.text = [
        { id: 'h1', level: 'headline', v: 'Signal and noise', on: true, pos: null },
        { id: 's1', level: 'subhead', v: 'A modular identity system', on: true, pos: null },
        { id: 'd1', level: 'data', v: [{ k: 'Where', v: 'Lisboa' }, { k: 'When', v: '23 Nov 2026' }], on: true, pos: null },
        { id: 'c1', level: 'caption', v: 'Printed in an edition of forty, numbered by hand', on: true, pos: null },
        { id: 's2', level: 'subhead', v: 'Rules and seeded randomness, set by hand', on: true, pos: null },
        { id: 'h2', level: 'headline', v: 'Second title', on: true, pos: null },
      ];
      const sc = solve(s, stubMeasure).scene;
      const fl = sc.flagged ?? [];
      // a design whose four slots fit no candidate falls back to the style's own fallback, which keeps no room
      if (!fl.length || sc.layout === 'fallback') continue;
      crowded++;
      const rank = (id: string) => ['headline', 'subhead', 'data', 'body', 'label', 'caption'].indexOf(s.text.find((l) => l.id === id)!.level);
      const top = Math.min(...fl.map(rank));
      // the same list with every layer below the highest flagged one off: if that frees the room, a lower layer took it
      const off = { ...s, text: s.text.map((l) => (rank(l.id) > top ? { ...l, on: false } : l)) };
      const fl2 = solve(off, stubMeasure).scene.flagged ?? [];
      const still = fl.filter((id) => rank(id) === top && fl2.includes(id));
      if (still.length < fl.filter((id) => rank(id) === top).length) fixed++;
    }
    // a lower layer is seldom what keeps a higher one out; record how often
    expect(fixed, `${fixed} of ${crowded} crowded designs`).toBeLessThanOrEqual(Math.ceil(crowded * 0.1));
  });
});
