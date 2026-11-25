/** Row R14: the photo (spec 8.9, 9.4) on the stub measure, with test photos registered for layout. */
import { beforeAll, describe, expect, test } from 'vitest';
import { solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { contains, rectQuad, xfQuad } from '../src/engine/geom';
import { check, lowContrast } from '../src/engine/invariants';
import { coverRect, gridOf, PHOTO_ROLES, registerPhoto, testPhoto, keptSize, photoChoice, type PhotoRole } from '../src/engine/photo';
import { runInvariants } from '../src/engine/proof';
import { defaultSpec, migrate, STYLE_IDS, type Spec } from '../src/engine/spec';
import { FORMAT_LIST } from '../src/engine/formats';
import { newCrop, NO_LOCKS, shuffle, withPhoto } from '../src/app/state';
import { photoControls, apply } from '../src/engine/controls';
import type { GraphicItem, Scene } from '../src/engine/scene';

const PORTRAIT = 'test-portrait', LANDSCAPE = 'test-landscape';
beforeAll(() => {
  registerPhoto(testPhoto(PORTRAIT, 3000, 4000, 7));
  registerPhoto(testPhoto(LANDSCAPE, 4000, 2600, 11));
});
const photoOfScene = (sc: Scene) => sc.items.find((i): i is GraphicItem => i.kind === 'graphic' && i.name === 'photo');
const withRole = (id: string, role: PhotoRole): Spec['photo'] => ({ id, treatment: null, place: { role } });

describe('cover (spec 8.9: from fitting to 2.5 times, offset anywhere that keeps the box covered)', () => {
  test('a portrait and a landscape photo cover every box at every scale and offset', () => {
    const boxes = [{ x: 0, y: 0, w: 1080, h: 1920 }, { x: 40, y: 300, w: 1000, h: 200 }, { x: -20, y: -30, w: 300, h: 1500 }, { x: 10, y: 10, w: 500, h: 500 }];
    for (const [iw, ih] of [[3000, 4000], [4000, 2600], [800, 800], [5000, 300]])
      for (const b of boxes) for (const s of [1, 1.3, 2.5, 0.5, 9]) for (const x of [0, 0.3, 1, -1, 2]) for (const y of [0, 0.7, 1]) {
        const d = coverRect(b, iw, ih, s, x, y);
        expect(d.x).toBeLessThanOrEqual(b.x + 1e-6);
        expect(d.y).toBeLessThanOrEqual(b.y + 1e-6);
        expect(d.x + d.w).toBeGreaterThanOrEqual(b.x + b.w - 1e-6);
        expect(d.y + d.h).toBeGreaterThanOrEqual(b.y + b.h - 1e-6);
        expect(d.w / d.h).toBeCloseTo(iw / ih, 6);
      }
  });
  test('in every style, format and role the photo covers the box it is given, for both photos', () => {
    let n = 0;
    for (const style of STYLE_IDS) for (const format of FORMAT_LIST) for (const role of PHOTO_ROLES) for (const id of [PORTRAIT, LANDSCAPE]) for (let i = 0; i < 3; i++) {
      const s = { ...defaultSpec({ layout: 100 + i, colour: 200 + i, graphic: 300 + i, type: 400 + i }), style, format, photo: withRole(id, role) };
      const g = photoOfScene(solve(s, stubMeasure).scene);
      expect(g, `${style} ${format} ${role}`).toBeDefined();
      const d = { x: +g!.params.x, y: +g!.params.y, w: +g!.params.w, h: +g!.params.h };
      expect(contains(rectQuad(d), rectQuad(g!.box), 1e-6), `${style} ${format} ${role} ${id}`).toBe(true);
      n++;
    }
    expect(n).toBe(4 * 3 * 5 * 2 * 3);
  });
  test('kept on import at a long edge of 5000 px at most', () => {
    expect(keptSize(8000, 6000)).toEqual([5000, 3750]);
    expect(keptSize(3000, 6000)).toEqual([2500, 5000]);
    expect(keptSize(1200, 900)).toEqual([1200, 900]);
  });
});

describe('9.2 with a test photo, every style, format and role (spec 9.4)', () => {
  for (const style of STYLE_IDS) {
    test(style, () => {
      let count = 0, fallbacks = 0;
      for (const role of PHOTO_ROLES) for (const id of [PORTRAIT, LANDSCAPE]) {
        const r = runInvariants(stubMeasure, { styles: [style], n: 4, variants: 'cycle', photo: withRole(id, role) });
        count += r.count;
        fallbacks += r.fallbacks;
        expect(r.failures.map((f) => [role, id, f.failures[0], JSON.stringify(f.spec)]), `${style} ${role} ${id}`).toEqual([]);
      }
      expect(count).toBe(5 * 2 * 3 * 2 * 4);
      expect(fallbacks, `${style}: fallbacks with a photo`).toBe(0);
    }, 240000);
  }
  test('every text item over the photo is on a plate or reads against the measured pixels', () => {
    let over = 0, measured = 0, plated = 0;
    for (const style of STYLE_IDS) for (const role of ['ground', 'box'] as PhotoRole[]) for (let i = 0; i < 6; i++) {
      const s = { ...defaultSpec({ layout: 10 + i, colour: 20 + i, graphic: 30 + i, type: 40 + i }), style, format: FORMAT_LIST[i % 3], mode: i % 2 ? 'dark' as const : 'light' as const, photo: withRole(PORTRAIT, role) };
      const sc = solve(s, stubMeasure).scene, at = sc.items.findIndex((x) => x.kind === 'graphic' && x.name === 'photo'), g = sc.items[at] as GraphicItem;
      sc.items.forEach((t, k) => {
        if (k <= at || t.kind !== 'text') return;
        expect(lowContrast(sc, k)).toBeNull();
        if (!g.regions?.some((r) => contains(r.quad, t.quad))) return;
        over++;
        measured++;
      });
      plated += sc.items.filter((x, k) => k > at && x.kind === 'rect' && x.plate).length;
    }
    // both ways occur: the test photo has calm dark and light areas and busy ones
    expect(measured).toBeGreaterThan(0);
    expect(plated).toBeGreaterThan(0);
    expect(over).toBe(measured);
  }, 240000);
});

describe('roles and crop from the layout stream (spec 8.9)', () => {
  test('30 shuffles give at least 10 distinct role-and-crop results per style', () => {
    for (const style of STYLE_IDS) {
      let s: Spec = { ...defaultSpec(), style, photo: { id: PORTRAIT, treatment: null, place: null } };
      const seen = new Set<string>();
      let k = 1;
      for (let i = 0; i < 30; i++) {
        s = shuffle(s, NO_LOCKS, () => (k = (k * 48271) % 2147483647));
        const g = photoOfScene(solve(s, stubMeasure).scene)!;
        seen.add([g.params.role, ...['x', 'y', 'w', 'h'].map((p) => Math.round(+g.params[p] / 10))].join(' '));
      }
      expect(seen.size, style).toBeGreaterThanOrEqual(10);
      const roles = new Set([...seen].map((x) => x.split(' ')[0]));
      expect(roles.size, `${style} roles`).toBeGreaterThanOrEqual(3);
    }
  }, 240000);
  test('every role comes up', () => {
    const roles = new Set<string>();
    for (let i = 0; i < 60; i++) roles.add(photoChoice({ ...defaultSpec({ layout: i * 7919 }), photo: { id: PORTRAIT, treatment: null, place: null } }).role);
    expect([...roles].sort()).toEqual([...PHOTO_ROLES].sort());
  });
  test('Layout locked holds role and crop; New crop moves the crop alone; Shuffle clears what was pinned', () => {
    const s0: Spec = { ...defaultSpec({ layout: 5 }), style: 'swiss', photo: { id: LANDSCAPE, treatment: null, place: { role: 'disc', scale: 2 } } };
    const locked = shuffle(s0, { ...NO_LOCKS, layout: true });
    const a = photoOfScene(solve(s0, stubMeasure).scene)!, b = photoOfScene(solve(locked, stubMeasure).scene)!;
    expect(locked.photo).toEqual(s0.photo);
    expect([b.params.role, b.params.scale]).toEqual([a.params.role, a.params.scale]);
    const un = shuffle(s0, NO_LOCKS);
    expect(un.photo).toEqual({ id: LANDSCAPE, treatment: null, place: null });
    const c = newCrop(s0, () => 99);
    expect(c.photo!.place).toEqual({ role: 'disc', crop: 99 });
    expect(c.seeds).toEqual(s0.seeds);
    const sa = solve({ ...s0, photo: { ...s0.photo!, place: { role: 'ground' } } }, stubMeasure).scene;
    const sb = solve({ ...s0, photo: { ...s0.photo!, place: { role: 'ground', crop: 99 } } }, stubMeasure).scene;
    expect(photoOfScene(sb)!.params.role).toBe('ground');
    expect(photoOfScene(sb)!.params.x).not.toBe(photoOfScene(sa)!.params.x);
    // the crop alone: every text item where it was
    const tq = (sc: Scene) => JSON.stringify(sc.items.filter((i) => i.kind === 'text').map((i) => i.quad));
    expect(tq(sb)).toBe(tq(sa));
  });
  test('a design without a photo, or with one not on this phone, draws as before', () => {
    const s = { ...defaultSpec({ layout: 3 }), style: 'vapor' as const };
    const a = solve(s, stubMeasure).scene, b = solve({ ...s, photo: { id: 'gone', treatment: null, place: null } }, stubMeasure).scene;
    expect(JSON.stringify(b.items)).toBe(JSON.stringify(a.items));
  });
  test('the same spec and photo give the same Scene; a tilted design tilts the photo with it', () => {
    const s = { ...defaultSpec({ layout: 8 }), style: 'swiss' as const, params: { 'layout.transform': 'tilt' }, photo: withRole(PORTRAIT, 'box') };
    const a = solve(s, stubMeasure).scene, b = solve(structuredClone(s), stubMeasure).scene;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.transform).toBe('tilt');
    expect(photoOfScene(a)!.frame?.rot).toBeTruthy();
    expect(check(a)).toEqual([]);
  });
  test('the ground role is never transformed and covers the canvas', () => {
    const s = { ...defaultSpec({ layout: 8 }), style: 'swiss' as const, format: '9:16' as const, params: { 'layout.transform': 'quarter' }, photo: withRole(LANDSCAPE, 'ground') };
    const g = photoOfScene(solve(s, stubMeasure).scene)!;
    expect(g.frame).toBeUndefined();
    expect(g.layer).toBe('ground');
    expect(contains(xfQuad(undefined, rectQuad(g.box)), rectQuad({ x: 0, y: 0, w: 1080, h: 1920 }))).toBe(true);
  });
});

describe('the spec and the controls', () => {
  test('photo references migrate: id kept, bad place fields dropped, ranges clamped', () => {
    expect(migrate({ v: 1, photo: { id: 'p1', place: { role: 'disc', scale: 9, x: -1, y: 0.5, crop: 3, junk: 1 } } }).photo)
      .toEqual({ id: 'p1', treatment: null, place: { role: 'disc', scale: 2.5, x: 0, y: 0.5, crop: 3 } });
    expect(migrate({ v: 1, photo: { place: {} } }).photo).toBeNull();
    expect(migrate({ v: 1, photo: 'x' }).photo).toBeNull();
    expect(migrate({ v: 1 }).photo).toBeNull();
    expect(withPhoto(defaultSpec(), null).photo).toBeNull();
  });
  test('the Photo tab shows role, scale and offset on a design with a photo, and writes photo.place', () => {
    const s = { ...defaultSpec({ layout: 2 }), photo: withRole(PORTRAIT, 'box') };
    const sc = solve(s, stubMeasure).scene, cs = photoControls({ spec: s, scene: sc });
    expect(cs.map((c) => c.id)).toEqual(['photo.role', 'photo.scale', 'photo.x', 'photo.y']);
    expect(cs.every((c) => c.facet === 'layout')).toBe(true);
    const t = apply(s, cs[1], 1.8);
    expect(t.photo!.place).toEqual({ role: 'box', scale: 1.8 });
    expect(apply(t, cs[0], null).photo!.place).toEqual({ scale: 1.8 });
    expect(photoControls({ spec: defaultSpec(), scene: solve(defaultSpec(), stubMeasure).scene })).toEqual([]);
  });
  test('the grid keeps each cell\'s darkest and lightest pixel', () => {
    const px = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    px.set([0, 0, 0, 255], 0); px.set([255, 255, 255, 255], 4 * 5);
    const g = gridOf(px, 4, 4, 2);
    expect([g.cols, g.rows]).toEqual([2, 2]);
    expect([...g.lo.slice(0, 3)]).toEqual([0, 0, 0]);
    expect([...g.hi.slice(0, 3)]).toEqual([255, 255, 255]);
    expect([...g.lo.slice(3, 6)]).toEqual([128, 128, 128]);
  });
});
