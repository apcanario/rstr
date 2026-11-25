/**
 * Advanced mode (spec 10.3, row R10): the controls the parts list, what each writes, Shuffle's lock rules over them,
 * and the per-design colour edit of spec 5. Every control shown for a design must change that design (a control
 * exists only for a key the engine reads), and every value it can write must still pass 9.2.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { addKept, NO_LOCKS, reroll, restore, serialize, shuffle, STORE_KEY, withStyle, type Locks } from '../src/app/state';
import { PALETTES } from '../src/data/palettes';
import { advancedOf, allControls, valuesOf } from '../src/engine/advanced';
import { apply, designColours, facetOfParam, read, sceneColours, setColour } from '../src/engine/controls';
import { strength } from '../src/engine/finish';
import { check } from '../src/engine/invariants';
import { choosePalette, solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { colourEdits, specs } from '../src/engine/proof';
import type { Scene } from '../src/engine/scene';
import { FACETS, migrate, STYLE_IDS, type Facet, type Spec, type StyleId } from '../src/engine/spec';
import { STYLES } from '../src/engine/styles';

const round = (_k: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
const sceneOf = (s: Spec) => solve(s, stubMeasure).scene;
/** What a person sees change: every Scene item, the ground, and the finish's strength (which acts on pixels only). */
const sig = (s: Spec, sc = sceneOf(s)) => JSON.stringify([sc.frame, sc.transform, sc.ground, sc.items, strength(s)], round);
const show = (s: Spec, what: string) => `${what}: ${JSON.stringify(s)}`;


/** The base designs: a few seed sets in every format, both modes, marks light and a finish on, so their controls show. */
const base = (style: StyleId, n = 3) => [...specs({ styles: [style], n, variants: 'cycle', marks: 'light', finish: 'grain' })];
/**
 * One design in each of the style's layouts (controls that only some layouts read show there), from seed set 7 (review
 * R10's probe set), the formats and modes taken in turn.
 */
const perLayout = (style: StyleId, start = 7) => {
  const d = [...specs({ styles: [style], start, n: 1, variants: 'cycle', marks: 'light', finish: 'grain' })];
  return STYLES[style].layouts.map((layout, i) => ({ ...d[(i * 2 + (i % 2)) % d.length], pick: { ...d[(i * 2 + (i % 2)) % d.length].pick, layout } }));
};
/** Base designs and one design in each layout. */
const wide = (style: StyleId) => [...base(style, 2), ...perLayout(style)];
/** One base design per format and mode, each layout, and each layout tilted and turned by hand (review R10 S1). */
const wider = (style: StyleId) => [...base(style, 1), ...perLayout(style).flatMap((d) => [d, ...['tilt', 'quarter'].map((t) => ({ ...d, params: { ...d.params, 'layout.transform': t } }))])];

const counter = (start = 1000) => { let n = start; return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0); };

describe('Advanced controls (spec 10.3): generated from the parts, each changes the design', () => {
  for (const style of STYLE_IDS) {
    test(`${style}: every control shown for a design changes that design for at least one of its values; ids are unique`, () => {
      const seen = new Set<string>(), dead: string[] = [];
      for (const s of wider(style)) {
        const sc = sceneOf(s), a = advancedOf(s, sc, sceneOf), list = allControls(a);
        expect(new Set(list.map((c) => c.id)).size, show(s, 'duplicate control ids')).toBe(list.length);
        const s0 = sig(s, sc);
        for (const c of list) {
          seen.add(c.id);
          const cur = read(s, c.where);
          if (!valuesOf(c).some((v) => v !== cur && sig(apply(s, c, v)) !== s0)) dead.push(`${c.id} in ${sc.frame} ${s.format} ${sc.transform} ${JSON.stringify(s.seeds)} ${s.mode}`);
        }
      }
      // review R10 S1: a control is shown only on a design it changes (not merely on some design of the style)
      expect(dead, `${style}: controls shown for a design they do not change`).toEqual([]);
      // the tabs spec 10.3 asks for, where the style has them
      expect([...seen]).toEqual(expect.arrayContaining(['pick.layout', 'layout.transform', 'layout.size', 'pick.pairing', 'pick.palette', 'finish.grain.strength']));
      expect([...seen]).toEqual(expect.arrayContaining(({
        swiss: ['layout.share', 'type.track', 'graphics.second', 'graphics.cutShape'], brutal: ['graphics.second', 'graphics.cutShape'], vapor: ['layout.horizon', 'vapor.second'], pomo: [],
      } as Record<StyleId, string[]>)[style]));
    }, 900000);
  }

  for (const style of STYLE_IDS) {
    test(`${style}: an unset stepper shows what the design draws wherever one of its options draws this design (review bundle 4 S1)`, () => {
      const missing: string[] = [], wrong: string[] = [], shown = new Set<string>();
      for (const s of [...base(style, 3), ...perLayout(style)]) {
        const sc = sceneOf(s), s0 = sig(s, sc);
        for (const c of allControls(advancedOf(s, sc))) {
          // a stepper: a choice longer than a row of segments (App.tsx SEG_MAX 4), unset
          if (c.kind !== 'choice' || c.options.length <= 4 || read(s, c.where) !== null) continue;
          const same = c.options.filter((o) => o.v !== null && sig(apply(s, c, o.v)) === s0).map((o) => o.v);
          if (!same.length) continue;
          const at = `${c.id} in ${sc.frame} ${s.format} ${JSON.stringify(s.seeds)} ${s.mode}`;
          if (c.drawn === undefined) missing.push(`${at}: shows Auto, draws ${same.join('/')}`);
          else if (!same.includes(c.drawn)) wrong.push(`${at}: shows ${c.drawn}, draws ${same.join('/')}`);
          else shown.add(c.id);
        }
      }
      expect(missing, `${style}: unset steppers that show Auto while the design draws one of their options`).toEqual([]);
      expect(wrong, `${style}: unset steppers that show another value than the one drawn`).toEqual([]);
      expect([...shown]).toEqual(expect.arrayContaining(({
        swiss: ['pick.palette', 'pick.pairing', 'graphics.second'], brutal: ['pick.palette', 'pick.pairing', 'graphics.second'], vapor: ['pick.palette', 'vapor.first', 'vapor.second'], pomo: ['pick.palette'],
      } as Record<StyleId, string[]>)[style]));
    }, 900000);
  }

  test('a style change drops the values set by hand of the four facets, keeps the finish strengths and the marks allowed (review R10 M3)', () => {
    const s = { ...defaultish(), params: { 'layout.size': 'small', 'type.cap': 0.7, 'g.dots.pitch': 0.05, 'graphics.cut': 1, 'finish.grain.strength': 0.5, 'marks.no.grid': true } };
    expect(withStyle(s, 'brutal').params).toEqual({ 'finish.grain.strength': 0.5, 'marks.no.grid': true });
  });

  test('each control says the facet Shuffle clears it with, and that is the facet of its key', () => {
    const pickFacet: Record<string, Facet | null> = { layout: 'layout', motif: 'graphic', palette: 'colour', pairing: 'type', dialect: null };
    for (const style of STYLE_IDS) for (const s of base(style, 1)) for (const c of allControls(advancedOf(s, sceneOf(s)))) {
      const want = c.where.at === 'params' ? facetOfParam(c.where.key) : c.where.at === 'pos' ? 'layout' : pickFacet[c.where.key];
      expect(c.facet, `${style} ${c.id}`).toBe(want);
    }
    // the keys the engine reads, by facet (spec 10.3)
    expect(['layout.size', 'g.dots.pitch', 'graphics.cut', 'vapor.first', 'type.cap', 'pomo.paperEdge', 'finish.vhs.strength', 'marks.no.grid'].map(facetOfParam))
      .toEqual(['layout', 'graphic', 'graphic', 'graphic', 'type', 'type', null, null]);
  });

  test('Shuffle\'s lock rules hold for every control: cleared unless its facet is locked; New <facet> clears it; facetless values stay', () => {
    for (const style of STYLE_IDS) for (const s0 of base(style, 1)) for (const c of allControls(advancedOf(s0, sceneOf(s0)))) {
      const v = valuesOf(c).find((x) => x !== null && x !== read(s0, c.where))!;
      const s = apply(s0, c, v), want = read(s, c.where);
      expect(want, `${style} ${c.id} set`).not.toBeNull();
      const none = shuffle(s, NO_LOCKS, counter());
      expect(read(none, c.where), `${style} ${c.id} after Shuffle`).toBe(c.facet ? null : want);
      for (const f of FACETS) {
        const locks: Locks = { ...NO_LOCKS, [f]: true };
        expect(read(shuffle(s, locks, counter()), c.where), `${style} ${c.id}, ${f} locked`).toBe(c.facet === f || !c.facet ? want : null);
        expect(read(reroll(s, f, counter()), c.where), `${style} ${c.id}, New ${f}`).toBe(c.facet === f ? null : want);
      }
    }
  });

  for (const style of STYLE_IDS) {
    test(`${style}: every value a non-library control writes still passes 9.2 without falling back, in every layout (the library ends: graphics.test.ts)`, () => {
      const falls: string[] = [];
      for (const s of wide(style)) {
        const sc0 = sceneOf(s);
        for (const c of allControls(advancedOf(s, sc0))) {
          if (c.where.at === 'params' && c.where.key.startsWith('g.') && c.kind === 'range') continue;
          for (const v of valuesOf(c)) {
            const t = apply(s, c, v), sc = sceneOf(t);
            // the Paper edge off waives rule 4 for the title words (spec 8.2): the waiver is on the items
            expect(check(sc), show(t, `${c.id} = ${v}`)).toEqual([]);
            // a fallback passes 9.2 but replaces the design being tuned (review R10 S2): a value must not cause one
            if (sc.layout === 'fallback' && sc0.layout !== 'fallback') falls.push(`${c.id} = ${v} in ${sc0.frame} ${s.format} ${JSON.stringify(s.seeds)} ${s.mode}`);
          }
        }
      }
      expect(falls, `${style}: values that drop the design to the fallback`).toEqual([]);
    }, 900000);
  }

  test('a value set by hand survives Back, Kept and reload as part of the spec', () => {
    const s = apply(defaultish(), { kind: 'range', id: 'type.cap', label: '', where: { at: 'params', key: 'type.cap' }, facet: 'type', min: 0.6, max: 1, step: 0.05 }, 0.7);
    // and a colour edit on Back, before it (review R10 S4: Back with a hand-set value or an edit was not tested)
    const c = designColours(choosePalette(s), s, sceneOf(s))[0], e = setColour(s, c.roles, '#123456');
    const saved = restore(serialize({ spec: s, back: [e, s], kept: addKept([], s), locks: NO_LOCKS, advanced: true }), () => s);
    expect(saved.back[0].pick.colours).toEqual(e.pick.colours);
    expect(saved.back).toEqual([e, s]);
    expect(saved.spec.params['type.cap']).toBe(0.7);
    // Back holds the spec with the hand-set value (review R10 S4)
    expect(saved.back[1].params['type.cap']).toBe(0.7);
    expect(saved.kept[0]).toEqual(s);
    expect(saved.advanced).toBe(true);
  });
});

function defaultish(style: StyleId = 'swiss'): Spec {
  return base(style, 1)[0];
}

describe('Edit for this design (spec 5): the design\'s colours', () => {
  const editsOf = colourEdits;

  test('three to five colours are listed; an edit draws the new colour, moves no box and is stored in the spec only', () => {
    const palettes = JSON.stringify(PALETTES);
    for (const style of STYLE_IDS) for (const s of base(style, 2)) {
      const sc = sceneOf(s), d = designColours(choosePalette(s), s, sc);
      expect(d.length, show(s, 'design colours')).toBeGreaterThanOrEqual(style === 'pomo' && sc.frame.startsWith('copy-') ? 2 : 3);
      expect(d.length).toBeLessThanOrEqual(5);
      const e = setColour(s, d[d.length - 1].roles, '#123456'), se = sceneOf(e);
      expect(e.pick.colours?.[s.mode]).toBeTruthy();
      expect(sceneColours(se).has('#123456'), show(e, 'edited colour not drawn')).toBe(true);
      // the layout never sees the edit: every text item keeps its box (plates may be added under text)
      const boxes = (x: Scene) => x.items.filter((i) => i.kind === 'text').map((i) => JSON.stringify(i.quad, round));
      expect(boxes(se)).toEqual(boxes(sc));
      expect([se.frame, se.transform]).toEqual([sc.frame, sc.transform]);
      // the listed colour now reads the edit, and a reset goes back to the palette's
      expect(designColours(choosePalette(e), e, se).some((x) => x.now === '#123456')).toBe(true);
      expect(setColour(e, d[d.length - 1].roles, null).pick.colours).toBeNull();
    }
    // nothing is written to any palette list (spec 5: palettes are a fixed list)
    expect(JSON.stringify(PALETTES)).toBe(palettes);
  }, 600000);

  test('an edited colour set still passes contrast: the text swaps ink or takes a plate; what cannot pass is warned, never refused', () => {
    let swapped = 0, plated = 0, warned = 0, n = 0;
    for (const style of STYLE_IDS) for (const s of base(style, 1)) {
      const sc = sceneOf(s);
      for (const e of editsOf(s, sc)) {
        const se = sceneOf(e), f = check(se);
        n++;
        // rules 1, 2, 3 and 5 hold whatever the colours
        expect(f.filter((x) => x.rule !== 4), show(e, 'edited')).toEqual([]);
        // every rule 4 failure is a text item the Scene warns of
        for (const x of f) expect(se.colourWarn ?? [], show(e, `unwarned ${x.part} ${x.msg}`)).toContain(x.part);
        if (se.colourWarn?.length) warned++;
        const plates = se.items.length - sc.items.length;
        if (plates > 0) plated++;
        else if (JSON.stringify(se.items.filter((i) => i.kind === 'text').map((t) => t.kind === 'text' && t.ink)) !== JSON.stringify(sc.items.filter((i) => i.kind === 'text').map((t) => t.kind === 'text' && t.ink))) swapped++;
      }
    }
    // the repair is used, and nothing passes in only some cases (three colours, two set the same, leave nothing to read)
    expect(swapped + plated).toBeGreaterThan(0);
    // a floor from a measured count (review R10 S4): at the fix, 408 edits, 98 warned (24%), 310 held without a warning
    expect(n - warned, `${warned} of ${n} edits warned`).toBeGreaterThanOrEqual(Math.ceil(n * 0.7));
  }, 600000);

  test('an edit lives in pick.colours per mode, survives reload and Keep, Shuffle clears it unless Colour is locked', () => {
    const s0 = defaultish(), sc = sceneOf(s0), d = designColours(choosePalette(s0), s0, sc);
    const s = setColour(s0, d[0].roles, '#abcdef');
    expect(s.pick.colours).toEqual({ [s0.mode]: Object.fromEntries(d[0].roles.map((r) => [r, '#abcdef'])) });
    // the other mode's form is untouched (each form is written by hand, spec 5)
    const other = { ...s, mode: s.mode === 'light' ? 'dark' as const : 'light' as const };
    expect(designColours(choosePalette(other), other, sceneOf(other)).some((x) => x.now === '#abcdef')).toBe(false);
    // reload, Keep
    const saved = restore(serialize({ spec: s, back: [], kept: addKept([], s), locks: NO_LOCKS, advanced: true }), () => s0);
    expect(saved.spec.pick.colours).toEqual(s.pick.colours);
    expect(saved.kept[0].pick.colours).toEqual(s.pick.colours);
    expect(migrate(JSON.parse(JSON.stringify(s))).pick.colours).toEqual(s.pick.colours);
    // Shuffle and New colours, a new palette and a style change clear it; Colour locked keeps it; other rerolls keep it
    expect(shuffle(s, NO_LOCKS, counter()).pick.colours).toBeNull();
    expect(shuffle(s, { ...NO_LOCKS, colour: true }, counter()).pick.colours).toEqual(s.pick.colours);
    expect(shuffle(s, { layout: true, colour: false, graphic: true, type: true }, counter()).pick.colours).toBeNull();
    expect(reroll(s, 'colour', counter()).pick.colours).toBeNull();
    for (const f of ['layout', 'graphic', 'type'] as const) expect(reroll(s, f, counter()).pick.colours).toEqual(s.pick.colours);
    expect(withStyle(s, 'brutal').pick.colours).toBeNull();
    const pal = advancedOf(s, sceneOf(s)).tabs.colour.find((c) => c.id === 'pick.palette')!;
    expect(apply(s, pal, PALETTES.swiss[1].id).pick.colours).toBeNull();
  });

  test('the saved state holds an edit only under pick.colours and no palette list; the app writes one localStorage key (review bundle 4 M6)', () => {
    for (const style of STYLE_IDS) {
      const s0 = defaultish(style), d = designColours(choosePalette(s0), s0, sceneOf(s0)), s = setColour(s0, d[0].roles, '#3a5f8c');
      const saved = JSON.parse(serialize({ spec: s, back: [s0, s], kept: addKept([], s), locks: NO_LOCKS, advanced: true }));
      const plain = JSON.parse(serialize({ spec: s0, back: [s0, s0], kept: addKept([], s0), locks: NO_LOCKS, advanced: true }));
      // with every pick.colours taken out, the save is the save of the unedited design: the edit is nowhere else
      const strip = (x: { spec: Spec; back: Spec[]; kept: Spec[] }) => { for (const t of [x.spec, ...x.back, ...x.kept]) delete (t.pick as Partial<Spec['pick']>).colours; return x; };
      expect(saved.spec.pick.colours, style).toEqual(s.pick.colours);
      expect(strip(saved), style).toEqual(strip(plain));
      expect(Object.keys(saved).sort()).toEqual(Object.keys(plain).sort());
      // no palette list in it: no key 'palettes', and no value anywhere is a palette id but a picked palette
      const ids = new Set(PALETTES[style].map((P) => P.id)), found: string[] = [];
      const walk = (x: unknown, path: string): void => {
        if (typeof x === 'string') { if (ids.has(x) && !path.endsWith('.pick.palette')) found.push(`${path} = ${x}`); }
        else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}[${i}]`));
        else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (k === 'palettes') found.push(path + '.palettes'); walk(v, `${path}.${k}`); }
      };
      walk(saved, '');
      expect(found, style).toEqual([]);
    }
    // the app's only localStorage writes are to STORE_KEY (src/app: one key, the saved state)
    const src = ['../src/app/App.tsx', '../src/app/state.ts'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    const writes = [...src.matchAll(/localStorage\.(\w+)\(([^,)]*)/g)].map((m) => `${m[1]}(${m[2].trim()})`);
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) expect(w, 'a localStorage call with another key').toMatch(/^(getItem|setItem)\(STORE_KEY\)$/);
    expect(STORE_KEY).toBe('rstr.app.v1');
  });

  test('migrate keeps only known modes, roles and #rrggbb values', () => {
    const m = migrate({ v: 1, style: 'swiss', pick: { colours: { light: { ink: '#ABCDEF', ground: 'red', nope: '#000000' }, dusk: { ink: '#000000' }, dark: { accent: '#00ff00' } } } });
    expect(m.pick.colours).toEqual({ light: { ink: '#abcdef' }, dark: { accent: '#00ff00' } });
    expect(migrate({ v: 1, pick: { colours: { light: { ground: 'x' } } } }).pick.colours).toBeNull();
    expect(migrate({ v: 1, pick: { colours: 'red' } }).pick.colours).toBeNull();
  });
});
