import { describe, expect, test } from 'vitest';
import { addKept, BACK_STEPS, infoText, KEPT_MAX, NO_LOCKS, openLink, parseInfo, pushBack, reroll, restore, serialize, shuffle, shuffleFresh, withStyle, type Locks } from '../src/app/state';
import { varietyKey } from '../src/engine/proof';
import { STYLES } from '../src/engine/styles';
import { choosePalette, choosePairing, layout } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { slotsOf, defaultSpec, FACETS, migrate, STYLE_IDS as STYLE_IDS_ALL, type Spec } from '../src/engine/spec';

/** A seeded seed source, so the tests are reproducible. */
function counter(start = 1000) {
  let n = start;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0);
}

const PICK = { layout: 'layout', colour: 'palette', graphic: 'motif', type: 'pairing' } as const;

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
        if (f === 'layout') s.pick.layout = STYLES[style].layouts[STYLES[style].layouts.length - 1];
        if (f === 'graphic') s.pick.motif = STYLES[style].motifs[STYLES[style].motifs.length - 1];
        const first = s, palette = choosePalette(s).id, pairing = choosePairing(s).id;
        const changed = new Set<string>();
        for (let i = 0; i < 50; i++) {
          const prev = s;
          s = shuffle(s, locks, seed);
          expect(s.seeds[f]).toBe(first.seeds[f]);
          expect(s.pick).toEqual({ ...{ palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null }, [PICK[f]]: first.pick[PICK[f]] });
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
  test('Shuffle with nothing locked clears every pick but the dialect; format, mode, finish and marks stay (spec 3)', () => {
    const s: Spec = { ...defaultSpec(), format: '9:16', mode: 'dark', finish: 'grain', marks: 'full', pick: { palette: 'paper', colours: null, pairing: 'x', motif: 'topo', layout: 'full-bleed', dialect: 'photocopy' } };
    const n = shuffle(s, NO_LOCKS, counter());
    // the Dialect control is a setting of the Look tab, like Light/Dark: Shuffle keeps it (R6 choice)
    expect(n.pick).toEqual({ palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: 'photocopy' });
    expect([n.format, n.mode, n.finish, n.marks]).toEqual(['9:16', 'dark', 'grain', 'full']);
    for (const f of FACETS) expect(n.seeds[f]).not.toBe(s.seeds[f]);
  });
  test('a reroll changes one facet and clears its pick only', () => {
    const s: Spec = { ...defaultSpec(), pick: { palette: 'paper', colours: null, pairing: 'p', motif: 'topo', layout: 'l', dialect: null } };
    const n = reroll(s, 'colour', counter());
    expect(n.seeds.colour).not.toBe(s.seeds.colour);
    expect({ ...n.seeds, colour: 0 }).toEqual({ ...s.seeds, colour: 0 });
    expect(n.pick).toEqual({ ...s.pick, palette: null });
  });
  test('the Paper edge value set by hand: Shuffle clears it unless Type is locked; New type clears it, other rerolls keep it (spec 10.3, review R6 S5)', () => {
    const s: Spec = { ...defaultSpec(), style: 'pomo', params: { 'pomo.paperEdge': false, 'finish.grain.strength': 0.5 } };
    expect(shuffle(s, NO_LOCKS, counter()).params).toEqual({ 'finish.grain.strength': 0.5 });
    expect(shuffle(s, { ...NO_LOCKS, type: true }, counter()).params).toEqual(s.params);
    expect(shuffle(s, { ...NO_LOCKS, layout: true, colour: true, graphic: true }, counter()).params).toEqual({ 'finish.grain.strength': 0.5 });
    expect(reroll(s, 'type', counter()).params).toEqual({ 'finish.grain.strength': 0.5 });
    for (const f of ['layout', 'colour', 'graphic'] as const) expect(reroll(s, f, counter()).params).toEqual(s.params);
  });
  test('the graphic facet\'s Advanced keys (vapor.first, vapor.second, vapor.extras, graphics.cut): Shuffle clears them unless Graphic is locked (review R9 M5)', () => {
    const p = { 'vapor.first': 'sun', 'vapor.second': 'grid', 'vapor.extras': 0, 'graphics.cut': 0, 'g.sun.slits': 4, 'marks.no.grid': true };
    const s: Spec = { ...defaultSpec(), style: 'vapor', params: p };
    expect(shuffle(s, NO_LOCKS, counter()).params).toEqual({ 'marks.no.grid': true });
    expect(shuffle(s, { ...NO_LOCKS, graphic: true }, counter()).params).toEqual(p);
    expect(reroll(s, 'graphic', counter()).params).toEqual({ 'marks.no.grid': true });
  });
  test('Shuffle holds spec 8.0 in a session: 200 shuffles of each style, no repeat of the variety key in any 60 in a row (review R9 S1)', () => {
    const keyOf = (s: Spec) => varietyKey(layout(s, stubMeasure));
    for (const style of ['swiss', 'pomo', 'brutal', 'vapor'] as const) {
      let s: Spec = { ...defaultSpec(), style, format: '3:4' }, recent: string[] = [];
      const seed = counter(77), keys: string[] = [];
      for (let i = 0; i < 200; i++) {
        const r = shuffleFresh(s, NO_LOCKS, recent, keyOf, seed);
        s = r.spec; recent = r.recent; keys.push(keyOf(s));
      }
      for (let i = 0; i < keys.length; i++) expect(keys.slice(Math.max(0, i - 59), i), `${style} shuffle ${i}`).not.toContain(keys[i]);
    }
    const all = { layout: true, colour: true, graphic: true, type: true };
    const s = defaultSpec();
    expect(shuffleFresh(s, all, ['x'], () => 'x').spec).toBe(s);
  }, 120000);
  test('a style change keeps seeds and clears picks', () => {
    const s: Spec = { ...defaultSpec(), pick: { palette: 'paper', colours: null, pairing: 'p', motif: 'topo', layout: 'l', dialect: 'icecream' } };
    const n = withStyle(s, 'brutal');
    expect(n.style).toBe('brutal');
    expect(n.seeds).toEqual(s.seeds);
    expect(n.pick).toEqual({ palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null });
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
      (s) => ({ ...s, text: s.text.map((l) => (l.id === 't1' ? { ...l, v: 'Changed\ntitle' } : l)) }),
      (s) => ({ ...s, text: s.text.map((l) => (l.id === 't3' ? { ...l, on: false } : l)) }),
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
      expect(r.back.every((s) => s.v === 2)).toBe(true);
      expect(r.kept.every((s) => s.v === 2)).toBe(true);
      expect(r.advanced).toBe(false);
      expect(r.locks).toEqual(NO_LOCKS);
      expect(r.spec.v).toBe(2);
    }
    expect(restore(null, () => defaultSpec({ layout: 123 })).spec.seeds.layout).toBe(123);
  });
  test('saved specs are migrated, and Back keeps at most its step count', () => {
    const r = restore(JSON.stringify({ spec: { style: 'pomo', palette: 'x' }, back: Array.from({ length: 40 }, (_, i) => ({ v: 1, seeds: { layout: i } })), kept: [] }), () => defaultSpec());
    expect(r.spec).toEqual(migrate({ style: 'pomo', palette: 'x' }));
    expect(r.back).toHaveLength(BACK_STEPS);
    expect(r.back[BACK_STEPS - 1].seeds.layout).toBe(39);
  });
  test(`Kept keeps the newest ${KEPT_MAX}, which come first, on restore and on Keep`, () => {
    const kept = Array.from({ length: KEPT_MAX + 10 }, (_, i) => defaultSpec({ layout: i }));
    const r = restore(JSON.stringify({ spec: defaultSpec(), kept }), () => defaultSpec());
    expect(r.kept).toHaveLength(KEPT_MAX);
    expect(r.kept[0].seeds.layout).toBe(0);
    let k = r.kept;
    k = addKept(k, defaultSpec({ layout: 9999 }));
    expect(k).toHaveLength(KEPT_MAX);
    expect(k[0].seeds.layout).toBe(9999);
    expect(addKept(k, k[3])).toBe(k);
  });
  test('a ?s= link replaces the saved design and puts it on Back; a broken link changes nothing', () => {
    const saved = { spec: defaultSpec({ layout: 7 }), back: [defaultSpec({ layout: 6 })], kept: [], locks: { ...NO_LOCKS }, advanced: false };
    const link = { ...defaultSpec({ layout: 8 }), style: 'pomo' as const };
    const o = openLink(saved, JSON.stringify(link));
    expect(o.spec).toEqual(migrate(link));
    expect(o.back).toEqual([...saved.back, saved.spec]);
    for (const q of [null, '', 'garbage', '{', '[1]', '42', 'null']) expect(openLink(saved, q)).toBe(saved);
  });
});

describe('the Info field', () => {
  test('round trip of label: value pairs, at most three', () => {
    const v = slotsOf(defaultSpec().text).info.v;
    expect(parseInfo(infoText(v))).toEqual(v);
    expect(parseInfo('Where: Lisboa · When: Today · A: 1 · B: 2')).toHaveLength(3);
    expect(parseInfo('Just a value')).toEqual([{ k: '', v: 'Just a value' }]);
    expect(parseInfo('')).toEqual([]);
  });
});

describe('Layout lock holds the photo (spec 8.9, Carried R12 from R17)', () => {
  test('a Shuffle with Layout locked keeps the role and scale the photo is drawn in, over 40 designs per style (before the fix 5 to 7 in 100 moved)', async () => {
    const { registerPhoto, testPhoto } = await import('../src/engine/photo');
    const { holdPhoto } = await import('../src/app/state');
    const { seedSet } = await import('../src/engine/proof');
    registerPhoto(testPhoto('lock-photo', 3000, 4000, 7));
    const photoOf = (s: Spec) => layout(s, stubMeasure).items.find((i) => i.kind === 'graphic' && i.name === 'photo') as { params: Record<string, unknown> } | undefined;
    let n = 0;
    const seq = [11, 23, 37, 41, 53, 67, 79, 83, 97];
    for (const style of STYLE_IDS_ALL) for (let i = 0; i < 40; i++) {
      const s0 = defaultSpec(seedSet(i));
      const s: Spec = { ...s0, style, format: (['1:1', '3:4', '9:16', 'A'] as const)[i % 4], photo: { id: 'lock-photo', treatment: null, place: { crop: 5 } } };
      const g0 = photoOf(s)!;
      let k = 0;
      const held = holdPhoto(s, layout(s, stubMeasure));
      expect(held.photo?.place).toEqual({ crop: 5, role: g0.params.role, held: true });
      // pinning the role the design draws keeps it (the candidate may differ: another form of the palette list may
      // have needed another role in that candidate)
      expect([photoOf(held)!.params.role, photoOf(held)!.params.scale]).toEqual([g0.params.role, g0.params.scale]);
      const t = shuffle(held, { ...NO_LOCKS, layout: true }, () => seq[k++ % seq.length] * (i + 1) * 7919);
      const g1 = photoOf(t)!;
      expect([g1.params.role, g1.params.scale]).toEqual([g0.params.role, g0.params.scale]);
      n++;
    }
    expect(n).toBe(160);
    // unlocked, Shuffle clears the pinned role with the rest of the place
    const s = { ...defaultSpec(seedSet(1)), photo: { id: 'lock-photo', treatment: null, place: { role: 'disc' as const, crop: 3 } } };
    expect(shuffle(s, NO_LOCKS).photo?.place).toBeNull();
  });
  test('a role the lock holds shows as Auto on the Photo tab, survives a save, and a hand pick or Auto clears the hold (review R12 M3)', async () => {
    const { registerPhoto, testPhoto } = await import('../src/engine/photo');
    const { holdPhoto } = await import('../src/app/state');
    const { photoControls, read, write } = await import('../src/engine/controls');
    const { photoRef } = await import('../src/engine/spec');
    registerPhoto(testPhoto('lock-photo', 3000, 4000, 7));
    const s: Spec = { ...defaultSpec(), photo: { id: 'lock-photo', treatment: null, place: null } };
    const held = holdPhoto(s, layout(s, stubMeasure));
    const ctl = photoControls({ spec: held, scene: layout(held, stubMeasure) }).find((c) => c.id === 'photo.role')!;
    expect(held.photo?.place?.held).toBe(true);
    expect(read(held, ctl.where)).toBeNull();
    expect(photoRef(JSON.parse(JSON.stringify(held.photo)))?.place).toEqual(held.photo?.place);
    const picked = write(held, ctl.where, 'disc');
    expect(picked.photo?.place).toEqual({ role: 'disc' });
    expect(read(picked, ctl.where)).toBe('disc');
    expect(write(held, ctl.where, null).photo?.place).toBeNull();
    // a role pinned by hand is not marked held, and holdPhoto leaves it alone
    expect(holdPhoto(picked, layout(picked, stubMeasure))).toBe(picked);
  });
});
