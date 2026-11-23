/** Vaporwave graphics: stars, the slit sun, the grid floor, the horizon glow; after type, stars and grid keep a halo off every glyph. */
import { bounds, pad, rectQuad } from '../../geom';
import { GRAPHICS } from '../../graphics';
import { chooseParams } from '../../graphics/params';
import { mkGraphic } from '../../items';
import type { GraphicItem } from '../../scene';
import type { GraphicsPart } from '../types';

const USES = ['stars', 'sun', 'grid', 'horizon'];

export const vaporGraphics: GraphicsPart = {
  id: 'vapor', uses: USES, vocab: USES, motifs: [],
  place(c, plan) {
    const { P, W, H, spec } = c, hz = plan.horizon, sun = plan.focus;
    const sky = P.gradient ?? [P.ground, P.ground], A2 = P.accent2 ?? P.accent, A3 = P.accent3 ?? P.accent;
    const pr = (n: string) => chooseParams(GRAPHICS[n], spec.params);
    const st = pr('stars'), spread = st.spread ?? GRAPHICS.stars.params.spread.def;
    const starsG = mkGraphic('stars', { x: 0, y: 0, w: W, h: hz }, spec.seeds.graphic, 0, { ink: P.ink, ground: P.ground }, [P.ink], { W, hz, ...st }, { extent: { x: 0, y: 0, w: W, h: hz * spread + (st.size === undefined ? W * 0.01 : W * 0.0135 * st.size) } });
    // the sun sits on the plan's focus; a layout without one gets no sun
    const sunG = sun && ((sunX: number, sy: number, sunR: number) => { const sunTop = Math.max(0, sy - sunR); return mkGraphic('sun', { x: 0, y: 0, w: W, h: hz }, 0, 0, { accent3: A3, accent: P.accent, sky1: sky[1] ?? sky[0] }, [A3, P.accent, sky[1] ?? sky[0]], { x: sunX, y: sy, r: sunR, ...pr('sun') },
      { extent: { x: sunX - sunR, y: sunTop, w: 2 * sunR, h: Math.max(0, Math.min(sy + sunR, hz) - sunTop) } }); })(sun.x, sun.y, sun.r);
    const gridG = mkGraphic('grid', { x: 0, y: hz, w: W, h: H - hz }, 0, 0, { line: A2 }, [A2], pr('grid'));
    const horizonG = mkGraphic('horizon', { x: 0, y: hz - W * 0.03, w: W, h: W * 0.06 }, 0, 0, { accent: P.accent }, [P.accent], { W, hz, ...pr('horizon') });
    const out = sunG ? [starsG, sunG, gridG, horizonG] : [starsG, gridG, horizonG];
    out.forEach((g) => (g.layer = 'back'));
    return out;
  },
  after(c, _plan, items) {
    // stars and grid stay a halo away from every glyph, so no line or star lies directly behind the type
    const knockPad = Math.round(c.W * 0.012);
    const holes: ReturnType<typeof rectQuad>[] = [], glyphs: number[] = [], boxes: ReturnType<typeof rectQuad>[] = [];
    items.forEach((t, i) => {
      if (t.kind !== 'text') return;
      const box = rectQuad(pad(bounds(t.quad), knockPad));
      holes.push(box);
      if (t.px >= 60) glyphs.push(i); else boxes.push(box);
    });
    for (const g of items) if (g.kind === 'graphic' && (g.name === 'stars' || g.name === 'grid')) { (g as GraphicItem).avoid = holes; g.knock = { glyphs, boxes, pad: knockPad }; }
  },
};
