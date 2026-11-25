/**
 * Advanced mode (spec 10.3, row R10): the controls the parts list, what each writes, Shuffle's lock rules over them,
 * and the per-design colour edit of spec 5. Every control shown for a design must change that design (a control
 * exists only for a key the engine reads), and every value it can write must still pass 9.2.
 */
import { describe, expect, test } from 'vitest';
import { addKept, NO_LOCKS, reroll, restore, serialize, shuffle, withStyle, type Locks } from '../src/app/state';
import { PALETTES } from '../src/data/palettes';
import { advancedOf, allControls } from '../src/engine/advanced';
import { apply, designColours, facetOfParam, read, sceneColours, setColour, type Control, type Value } from '../src/engine/controls';
import { strength } from '../src/engine/finish';
import { check } from '../src/engine/invariants';
import { choosePalette, solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { specs } from '../src/engine/proof';
import type { Scene } from '../src/engine/scene';
import { FACETS, migrate, STYLE_IDS, type Facet, type Spec, type StyleId } from '../src/engine/spec';
import { STYLES } from '../src/engine/styles';

const round = (_k: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
const sceneOf = (s: Spec) => solve(s, stubMeasure).scene;
/** What a person sees change: every Scene item, the ground, and the finish's strength (which acts on pixels only). */
const sig = (s: Spec, sc = sceneOf(s)) => JSON.stringify([sc.frame, sc.transform, sc.ground, sc.items, strength(s)], round);
const show = (s: Spec, what: string) => `${what}: ${JSON.stringify(s)}`;

/** The values a control can write, unset first: every option of a choice, both ends of a range, a switch off. */
function valuesOf(c: Control): Value[] {
  if (c.kind === 'choice') return c.options.map((o) => o.v);
  if (c.kind === 'range') return [null, c.min, c.max];
  return [null, c.off];
}

/** The base designs: a few seed sets in every format, both modes, marks light and a finish on, so their controls show. */
const base = (style: StyleId, n = 3) => [...specs({ styles: [style], n, variants: 'cycle', marks: 'light', finish: 'grain' })];
/** Base designs and one design in each of the style's layouts (controls that only some layouts read show there). */
const wide = (style: StyleId) => [...base(style), ...STYLES[style].layouts.map((layout, i) => ({ ...base(style, 1)[i % 6], pick: { ...base(style, 1)[i % 6].pick, layout } }))];

const counter = (start = 1000) => { let n = start; return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0); };

describe('Advanced controls (spec 10.3): generated from the parts, each changes the design', () => {
  for (const style of STYLE_IDS) {
    test(`${style}: every control shown for a design changes it for some design; ids are unique`, () => {
      const seen = new Map<string, boolean>();
      for (const s of wide(style)) {
        const sc = sceneOf(s), a = advancedOf(s, sc), list = allControls(a);
        expect(new Set(list.map((c) => c.id)).size, show(s, 'duplicate control ids')).toBe(list.length);
        const s0 = sig(s, sc);
        for (const c of list) {
          if (seen.get(c.id)) continue;
          if (!seen.has(c.id)) seen.set(c.id, false);
          const cur = read(s, c.where);
          for (const v of valuesOf(c)) {
            if (v === cur) continue;
            if (sig(apply(s, c, v)) !== s0) { seen.set(c.id, true); break; }
          }
        }
      }
      const dead = [...seen].filter(([, ok]) => !ok).map(([id]) => id);
      expect(dead, `${style}: controls that changed no design`).toEqual([]);
      // the tabs spec 10.3 asks for, where the style has them
      expect([...seen.keys()]).toEqual(expect.arrayContaining(['pick.layout', 'layout.transform', 'layout.size', 'pick.pairing', 'pick.palette', 'finish.grain.strength']));
    }, 600000);
  }

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
    test(`${style}: every value a non-library control writes still passes 9.2 (the library ends: graphics.test.ts)`, () => {
      for (const s of base(style, 2)) {
        for (const c of allControls(advancedOf(s, sceneOf(s)))) {
          if (c.where.at === 'params' && c.where.key.startsWith('g.') && c.kind === 'range') continue;
          for (const v of valuesOf(c)) {
            const t = apply(s, c, v), sc = sceneOf(t);
            // the Paper edge off waives rule 4 for the title words (spec 8.2): the waiver is on the items
            expect(check(sc), show(t, `${c.id} = ${v}`)).toEqual([]);
          }
        }
      }
    }, 600000);
  }

  test('a value set by hand survives Back, Kept and reload as part of the spec', () => {
    const s = apply(defaultish(), { kind: 'range', id: 'type.cap', label: '', where: { at: 'params', key: 'type.cap' }, facet: 'type', min: 0.6, max: 1, step: 0.05 }, 0.7);
    const saved = restore(serialize({ spec: s, back: [s], kept: addKept([], s), locks: NO_LOCKS, advanced: true }), () => s);
    expect(saved.spec.params['type.cap']).toBe(0.7);
    expect(saved.kept[0]).toEqual(s);
    expect(saved.advanced).toBe(true);
  });
});

function defaultish(style: StyleId = 'swiss'): Spec {
  return base(style, 1)[0];
}

describe('Edit for this design (spec 5): the design\'s colours', () => {
  const editsOf = (s: Spec, sc: Scene): Spec[] => {
    // every design colour set to every other (the worst edits: colours collide), and to a mid grey
    const d = designColours(choosePalette(s), s, sc), out: Spec[] = [];
    for (const a of d) { for (const b of d) if (a !== b) out.push(setColour(s, a.roles, b.now)); out.push(setColour(s, a.roles, '#808080')); }
    return out;
  };

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
    expect(warned).toBeLessThan(n);
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

  test('migrate keeps only known modes, roles and #rrggbb values', () => {
    const m = migrate({ v: 1, style: 'swiss', pick: { colours: { light: { ink: '#ABCDEF', ground: 'red', nope: '#000000' }, dusk: { ink: '#000000' }, dark: { accent: '#00ff00' } } } });
    expect(m.pick.colours).toEqual({ light: { ink: '#abcdef' }, dark: { accent: '#00ff00' } });
    expect(migrate({ v: 1, pick: { colours: { light: { ground: 'x' } } } }).pick.colours).toBeNull();
    expect(migrate({ v: 1, pick: { colours: 'red' } }).pick.colours).toBeNull();
  });
});
