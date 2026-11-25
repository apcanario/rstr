/** Brutalist, finished (row R8, spec 8.0, 8.3) on the stub measure. */
import { describe, expect, test } from 'vitest';
import { FORMAT_LIST } from '../src/engine/formats';
import { bounds, overlaps, rectQuad } from '../src/engine/geom';
import { GRAPHICS } from '../src/engine/graphics';
import { choosePairing, choosePalette, partCtx, solve } from '../src/engine/layout';
import { stubMeasure } from '../src/engine/measure';
import { BRUTAL_CUTS, BRUTAL_GRAPHICS, brutalDraw, NUMERAL_MIN, numeralFits, numeralHeight } from '../src/engine/parts/graphics/brutal';
import { BRUTAL_LAYOUTS, FULL_WIDTH, brutalLayout } from '../src/engine/parts/layout/brutal';
import { brutalBreaks, brutalLines } from '../src/engine/parts/shared/brutal';
import { isCoreFace, PAIRINGS } from '../src/data/pairings';
import { runBrutalWidth, shuffleSeeds, specs } from '../src/engine/proof';
import { counted, rng } from '../src/engine/rng';
import type { GraphicItem, Scene, TextItem } from '../src/engine/scene';
import { defaultSpec, type Spec } from '../src/engine/spec';

const titles = (sc: Scene) => sc.items.filter((i): i is TextItem => i.kind === 'text' && i.slot === 'title');
const brutal = (i: number, f: Spec['format'] = '3:4') => { const s = defaultSpec(shuffleSeeds(i)); s.style = 'brutal'; s.format = f; return s; };
const planOf = (s: Spec, sc: Scene) => brutalLayout.plan(partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), Number(sc.layout.slice(1))))!;
/** A title line's ink length along its run, in the page's frame. */
const inkLen = (t: TextItem) => { const r = t.runs[0], mt = stubMeasure(r.s, t.font, t.size); return (mt.left + mt.right) * (r.sx ?? 1); };

describe('R8: layouts, transforms, graphics (spec 8.0, 8.3)', () => {
  const N = 600;
  const plans = Array.from({ length: N }, (_, i) => { const s = brutal(i, FORMAT_LIST[i % 3]); return { s, plan: brutalLayout.plan(partCtx(s, stubMeasure, choosePalette(s), choosePairing(s), 0))! }; });
  test('eight layouts, each rolled and none over 20%', () => {
    expect(BRUTAL_LAYOUTS).toHaveLength(8);
    const n = new Map<string, number>();
    for (const p of plans) n.set(p.plan.frame, (n.get(p.plan.frame) ?? 0) + 1);
    expect([...n.keys()].sort()).toEqual([...BRUTAL_LAYOUTS].sort());
    for (const [k, v] of n) expect(v / N, k).toBeLessThan(0.2);
  });
  test('tilt and quarter each about one in six (never a quarter turn with the title up the edge)', () => {
    const tilt = plans.filter((p) => p.plan.transform === 'tilt').length, quarter = plans.filter((p) => p.plan.transform === 'quarter').length;
    expect(Math.abs(tilt / N - 1 / 6)).toBeLessThan(0.05);
    expect(Math.abs(quarter / N - 1 / 6)).toBeLessThan(0.06);
    for (const p of plans) if (p.plan.frame === 'title-up') expect(p.plan.transform).not.toBe('quarter');
  });
  test('twelve graphics from the shared library, arrow included', () => {
    expect(BRUTAL_GRAPHICS).toHaveLength(12);
    for (const g of BRUTAL_GRAPHICS) expect(GRAPHICS[g], g).toBeDefined();
    for (const g of ['barcode', 'slab', 'asterisks', 'arrow', 'numeral']) expect(BRUTAL_GRAPHICS).toContain(g);
    expect(Object.keys(GRAPHICS.arrow.params).length).toBeGreaterThanOrEqual(3);
  });
  test('cut-ins 0, 1, 2 near 0.38, 0.52, 0.10; every cut shape appears; the shared library at its heavy end', () => {
    const counts = [0, 0, 0], shapes = new Set<string>();
    const P = choosePalette(brutal(0));
    for (let i = 0; i < N; i++) {
      const d = brutalDraw(brutal(i), P, counted(rng(i * 7 + 1)), { x: 0, y: 0, w: 982, h: 300 });
      counts[d.cuts.length]++;
      d.cuts.forEach((k) => { shapes.add(k.shape); expect(k.name).not.toBe(d.first); });
      if (d.first === 'bars' || d.first === 'lines') {
        const R = GRAPHICS[d.first].params.weight;
        expect(d.params.weight, d.first).toBeGreaterThanOrEqual(R.min + (R.max - R.min) * 0.55 - 1e-9);
      }
    }
    [0.38, 0.52, 0.1].forEach((want, i) => expect(Math.abs(counts[i] / N - want), `cut-ins ${i}: ${counts[i]}`).toBeLessThan(0.05));
    expect([...shapes].sort()).toEqual([...BRUTAL_CUTS].sort());
  });
  /** The share of an asterisk's circle its arms fill (arms bars through the centre, each of half-thickness weight). */
  const filled = (arms: number, wt: number) => {
    let inC = 0, inA = 0;
    for (let i = 0; i < 200; i++) for (let j = 0; j < 200; j++) {
      const x = (i + 0.5) / 100 - 1, y = (j + 0.5) / 100 - 1;
      if (x * x + y * y > 1) continue;
      inC++;
      for (let a = 1; a <= arms; a++) { const t = (Math.PI / arms) * a; if (Math.abs(-Math.sin(t) * x + Math.cos(t) * y) <= wt) { inA++; break; } }
    }
    return inA / inC;
  };
  test('heavy asterisks stay asterisks: the arms fill under 0.75 of the circle at every draw (review R8 S4)', () => {
    let n = 0;
    for (let i = 0; i < N; i++) {
      const d = brutalDraw(brutal(i), choosePalette(brutal(i)), counted(rng(i * 7 + 1)), { x: 0, y: 0, w: 982, h: 300 });
      for (const p of [d.first === 'asterisks' ? d.params : null, ...d.cuts.filter((k) => k.name === 'asterisks').map((k) => k.params)]) {
        if (!p) continue;
        n++;
        expect(filled(p.arms, p.weight), JSON.stringify(p)).toBeLessThan(0.75);
      }
    }
    expect(n).toBeGreaterThan(50);
  });
  test('a cut never sits on a plate of the first graphic\'s ink (review R8 S5); a numeral is never cut in as a strip (M4)', () => {
    let cuts = 0;
    for (let i = 0; i < N; i++) {
      const s = brutal(i, FORMAT_LIST[i % 3]), P = choosePalette(s);
      const d = brutalDraw(s, P, counted(rng(i * 7 + 1)), { x: 0, y: 0, w: 982, h: 300 });
      const under = d.plate ? P[d.plate] : P.ground, ink = [P.ink, P.ground, P.accent].find((x) => x !== under);
      for (const k of d.cuts) {
        cuts++;
        if (P.accent !== ink) expect(P[k.role], JSON.stringify({ i, k })).not.toBe(ink);
        if (k.name === 'numeral') expect(k.shape).not.toBe('strip');
      }
    }
    expect(cuts).toBeGreaterThan(300);
  });
});

describe('review bundle 4: the huge numeral, and the band over a short title', () => {
  const designs = () => specs({ styles: ['brutal'], n: 200, variants: 'cycle', picks: 'none' });
  test('every numeral drawn unpinned is at least a quarter of the canvas width tall, first graphic or cut-in (S2); numerals still drawn', () => {
    let n = 0;
    const small: string[] = [];
    for (const s of designs()) {
      const sc = solve(s, stubMeasure).scene;
      for (const g of sc.items) {
        if (g.kind !== 'graphic' || g.name !== 'numeral' || g.layer === 'mark') continue;
        n++;
        const h = numeralHeight(g.box, { weight: Number(g.params.weight), scale: Number(g.params.scale) });
        if (h < sc.w * NUMERAL_MIN) small.push(`${s.format} ${JSON.stringify(s.seeds)} ${sc.frame}: ${h.toFixed(0)} px${g.cut ? ' (cut in)' : ''}`);
      }
    }
    expect(small, 'numerals under a quarter of the width').toEqual([]);
    console.log(`bundle 4 S2: ${n} numerals in 600 Brutalist designs, none under ${NUMERAL_MIN} of the width`);
    expect(n).toBeGreaterThan(5);
  }, 120000);
  test('a numeral picked by hand as the second is drawn whatever its size (the hand pick wins); the rule reads the box as the figure does', () => {
    const P = choosePalette(brutal(0));
    const d = brutalDraw({ pick: { motif: null }, params: { 'graphics.second': 'numeral', 'graphics.cut': 1 } }, P, counted(rng(5)), { x: 0, y: 0, w: 982, h: 120 });
    expect(d.cuts[0]?.name === 'numeral' || d.first === 'numeral').toBe(true);
    // the box rule: 300 high holds a huge figure (273 px at the heavy end's smallest), 280 does not
    expect(numeralFits({ x: 0, y: 0, w: 982, h: 300 }, 1080)).toBe(true);
    expect(numeralFits({ x: 0, y: 0, w: 982, h: 280 }, 1080)).toBe(false);
  });
  test('a band taller than the title takes no cut-in unless Advanced asks (S4); one-word titles are where it shows', () => {
    let tall = 0, cut = 0;
    for (const s of designs()) {
      const sc = solve(s, stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const plan = planOf(s, sc), B = plan.boxes.graphic;
      if (!B || plan.titleUp) continue;
      const T = [plan.boxes.title, plan.boxes.title2].reduce((a, b) => a + (b ? b.h : 0), 0);
      if (!T || B.h <= T) continue;
      tall++;
      if (sc.items.some((g) => g.kind === 'graphic' && g.layer !== 'mark' && g.cut)) cut++;
    }
    expect(tall).toBeGreaterThan(0);
    expect(cut, `${cut} of ${tall} bands taller than the title carry a cut-in`).toBe(0);
    // Advanced's cut-in count still wins over the rule
    const one = specs({ styles: ['brutal'], n: 60, variants: 'cycle', picks: 'none', params: { 'graphics.cut': 1 } });
    let forced = 0;
    for (const s of one) { const sc = solve(s, stubMeasure).scene; if (sc.items.some((g) => g.kind === 'graphic' && g.layer !== 'mark' && g.cut)) forced++; }
    expect(forced).toBeGreaterThan(0);
  }, 120000);
});

describe('R8: every title line fills the width (spec 8.3; Carried R8, review R1 M4)', () => {
  test('lines break one word each up to four, else three balanced; fewer, wider lines only as a fallback break', () => {
    expect(brutalLines('Signal and noise')).toEqual(['SIGNAL', 'AND', 'NOISE']);
    expect(brutalLines('Eight plain words make a long poster title')).toHaveLength(3);
    expect(brutalBreaks('Signal and noise')).toEqual([['SIGNAL', 'AND', 'NOISE'], ['SIGNAL', 'AND NOISE'], ['SIGNAL AND NOISE']]);
    expect(brutalBreaks('Two\nlines')).toEqual([['TWO', 'LINES']]);
  });
  test('every title line of four words or fewer spans the full inner width within 1%, in every layout that promises it, every format, every text variant', () => {
    let n = 0, lines = 0;
    const seen = new Set<string>();
    for (const s of specs({ styles: ['brutal'], n: 24, picks: 'none' })) {
      if (s.text.title.v.trim().split(/\s+/).length > 4) continue;
      const sc = solve(s, stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const plan = planOf(s, sc), ts = titles(sc);
      if (!ts.length) continue;
      n++;
      seen.add(plan.frame);
      for (const t of ts) {
        // the box the line sits in: the title's own or the second part of a split title
        const boxes = [plan.boxes.title!, plan.boxes.title2].filter(Boolean);
        const want = plan.titleUp ? plan.boxes.title!.h : boxes[0]!.w;
        const got = inkLen(t);
        expect(Math.abs(got - want) / want, `${plan.frame} ${s.format} ${JSON.stringify(s.seeds)} ${t.runs[0].s}: ${got} of ${want}`).toBeLessThan(0.01);
        lines++;
      }
    }
    expect([...seen].sort()).toEqual([...BRUTAL_LAYOUTS].sort());
    expect(FULL_WIDTH.length).toBe(7);
    expect(lines).toBeGreaterThan(n * 1.5);
    console.log(`R8 full width: ${lines} title lines in ${n} designs`);
  }, 120000);
  test('the smoke run\'s full-width proof (review bundle 4 M5) finds nothing off on the stub measure, per pairing, and fails a line off by 1%', () => {
    for (const p of PAIRINGS.brutal.filter((x) => isCoreFace(x.display))) {
      const r = runBrutalWidth(stubMeasure, { n: 10, variants: 'cycle', pick: { pairing: p.id } });
      expect(r.designs, p.id).toBeGreaterThan(20);
      expect(r.off, p.id).toEqual([]);
    }
    // the test of the test: lines laid out on the stub and read with a measure 2% wide are all off
    const wide: typeof stubMeasure = (s, f, px, tr) => { const mt = stubMeasure(s, f, px, tr); return { ...mt, left: mt.left * 1.02, right: mt.right * 1.02 }; };
    const r = runBrutalWidth(stubMeasure, { n: 4, variants: 'cycle' }, undefined, wide);
    expect(r.lines).toBeGreaterThan(0);
    expect(r.off.length).toBe(Math.min(50, r.lines));
  });
  test('the 1:1 Anton title (Klein, Alarm) fills the width where height binds (review R1 M4)', () => {
    for (const palette of ['klein', 'alarm']) for (let i = 0; i < 30; i++) {
      const s = brutal(i, '1:1');
      s.pick.pairing = 'br-anton'; s.pick.palette = palette; s.pick.layout = 'title-top';
      const sc = solve(s, stubMeasure).scene;
      expect(sc.layout).not.toBe('fallback');
      const plan = planOf(s, sc);
      for (const t of titles(sc)) expect(Math.abs(inkLen(t) - plan.boxes.title!.w) / plan.boxes.title!.w).toBeLessThan(0.01);
    }
  });
  test('one word per line up to four words: always at normal and oversize where the area holds the lines, with every core display face; in 70% of all such designs off the edge (review R8 E1)', () => {
    const core = PAIRINGS.brutal.filter((p) => isCoreFace(p.display)).map((p) => p.id);
    const by = new Map<string, [number, number]>();
    let all = 0, kept = 0;
    for (const pairing of core) for (const s of specs({ styles: ['brutal'], n: 200, variants: 'cycle', pick: { pairing } })) {
      const words = s.text.title.v.trim().split(/\s+/).filter(Boolean).length;
      if (words < 2 || words > 4 || s.text.title.v.includes('\n') || !s.text.title.on) continue;
      const sc = solve(s, stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      const ts = titles(sc);
      if (!ts.length) continue;
      const plan = planOf(s, sc), one = ts.length === words;
      // up the edge the strip's cap (0.7 of the width, 0.55 beside an info table) binds, not the band
      if (!plan.titleUp) { all++; if (one) kept++; }
      const k = `${plan.size} ${plan.frame}`, c = by.get(k) ?? [0, 0];
      by.set(k, [c[0] + (one ? 1 : 0), c[1] + 1]);
      // where words join at normal or oversize, height bound: the band is thin (1.2 x 9% of the width) or absent
      if (plan.size !== 'small' && !one && !plan.titleUp) {
        const g = plan.boxes.graphic;
        expect(g ? g.h : 0, `${k} ${s.format} ${pairing} ${JSON.stringify(s.seeds)}: ${ts.map((t) => t.runs[0].s).join(' / ')}`).toBeLessThanOrEqual(Math.round(sc.w * 0.09 * 1.2) + 1);
      }
    }
    console.log(`R8 one word per line: ${kept} of ${all}; ${[...by].sort().map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ')}`);
    expect(kept / all).toBeGreaterThanOrEqual(0.7);
  }, 180000);
  test('eight words stay heavy: three lines or fewer, each at least 60 px in type size, no fallback', () => {
    let n = 0;
    for (const f of FORMAT_LIST) for (const layout of BRUTAL_LAYOUTS) for (let i = 0; i < 12; i++) {
      const s = brutal(i, f);
      s.pick.layout = layout; s.text.title.v = 'Eight plain words make a long poster title';
      const sc = solve(s, stubMeasure).scene;
      if (sc.layout === 'fallback') continue;
      n++;
      const ts = titles(sc);
      expect(ts.length).toBeLessThanOrEqual(3);
      for (const t of ts) expect(t.px, `${f} ${layout} ${i}`).toBeGreaterThanOrEqual(60);
    }
    expect(n).toBeGreaterThan(3 * 8 * 12 * 0.95);
  });
});

describe('R8: the band and the marks (Carried R8 from R13 and from R7)', () => {
  // review R8 E1: the band no longer takes height the rule's one-word lines need, so with every slot on it gives way
  // where the area only just holds them (a tilted page, mostly): 78% in 1:1, 74% in 3:4, 89% in 9:16 at the R8 fix
  test('with the default text the band graphic is drawn in most shuffles, in every format', () => {
    for (const f of FORMAT_LIST) {
      let with_ = 0;
      for (let i = 0; i < 300; i++) if (solve(brutal(i, f), stubMeasure).scene.graphics.length) with_++;
      expect(with_ / 300, f).toBeGreaterThan(0.7);
    }
  });
  test('the underline bar never sits in a slit: 24 px clear of any other text on the side away from the title', () => {
    let bars = 0;
    for (const s of specs({ styles: ['brutal'], n: 60, variants: 'cycle', marks: 'full', modes: ['light'] })) {
      const sc = solve(s, stubMeasure).scene;
      const bar = sc.items.find((i): i is GraphicItem => i.kind === 'graphic' && i.layer === 'mark' && i.params.kind === 'bar' && i.box.h === 4);
      if (!bar) continue;
      bars++;
      const T = bounds(rectQuad({ ...titles(sc).map((t) => bounds(t.quad)).reduce((a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) })) }));
      const b = bar.box, away = b.y > T.y ? { x: b.x, y: b.y, w: b.w, h: 24 } : { x: b.x, y: b.y - 20, w: b.w, h: 24 };
      for (const t of sc.items) if (t.kind === 'text' && t.slot !== 'title') expect(overlaps(t.quad, rectQuad(away)), JSON.stringify(s.seeds)).toBe(false);
    }
    expect(bars).toBeGreaterThan(10);
  });
  test('light marks: three or more on all but at most one of 600 Brutalist designs, never none', () => {
    let few = 0, n = 0;
    for (const s of specs({ styles: ['brutal'], n: 200, variants: 'cycle', marks: 'light', modes: ['light'] })) {
      n++;
      const sc = solve(s, stubMeasure).scene;
      const kinds = new Set(sc.items.filter((i): i is GraphicItem => i.kind === 'graphic' && i.layer === 'mark' && !['bar', 'card', 'label'].includes(String(i.params.kind))).map((g) => g.params.mark));
      expect(kinds.size, JSON.stringify(s.seeds)).toBeGreaterThan(0);
      if (kinds.size < 3) few++;
    }
    console.log(`R8 marks: ${few} of ${n} Brutalist designs with fewer than three light marks`);
    expect(n).toBe(600);
    expect(few).toBeLessThanOrEqual(1);
  }, 120000);
});
