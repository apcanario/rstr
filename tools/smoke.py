"""npm run smoke: the built app in headless Chrome. Runs spec 9.2 and 9.3 over many seeds with the real fonts,
taps the controls at both phone sizes, and checks exports. Any failure prints the spec that caused it."""
import base64, io, json, sys, time
from PIL import Image
from common import browser, idle, open_app, served
import appcheck, exportcheck, fontcheck

N = int(sys.argv[1]) if len(sys.argv) > 1 else 200
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
# styles whose row enforces the variety tests of spec 8.0 (R5: Swiss, R6: Postmodern, R8: Brutalist, R9: Vaporwave)
ENFORCED = ['swiss', 'pomo', 'brutal', 'vapor']
FORMATS = ['1:1', '3:4', '9:16', 'A']
SIZES = {'1:1': (1080, 1080), '3:4': (1080, 1440), '9:16': (1080, 1920), 'A': (1080, 1527)}
fails = []
# Fallbacks allowed when a layout or motif is picked, at N = 200 (review R2 S1). Until R9 a picked Vaporwave sky
# title could not always fit (196 at 1:1, 6 at 3:4 and 9:16); R9 keeps it above the sun, so none now. The runs
# draw seeds 0..N-1, so for N <= 200 these counts are a ceiling; above, scaled.
# Unpicked and per-palette runs allow none: a fallback there means a palette or form cut every candidate.
PICKED_FALLBACKS = {}


def fail(msg, spec=None):
    fails.append(msg)
    print('FAIL', msg)
    if spec is not None:
        print('  spec:', json.dumps(spec, ensure_ascii=False))


def fallback_check(label, r, ceiling):
    if r['fallbacks'] > ceiling:
        fail(f'{label}: {r["fallbacks"]} fallbacks, at most {ceiling} expected')
        for spec in r['fallbackSpecs'][:3]:
            print('  fell back:', json.dumps(spec, ensure_ascii=False))


with served() as url, browser() as b:
    pg, errors = open_app(b, url)
    t0 = time.time()
    # 9.2, rules 1 to 5, over N seed sets per style x format x mode, each with every text variant
    for style in STYLES:
        for fmt in FORMATS:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': N})
            print(f'9.2 {style:6} {fmt:4}  {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
            fallback_check(f'9.2 {style} {fmt}', r, 0)
            for f in r['failures'][:5]:
                fail(f'9.2 {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # 9.2 with every value of pick.layout and pick.motif: a picked spec is tested like a seeded one
    for style in STYLES:
        for fmt in FORMATS:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': N, 'picks': 'each', 'variants': 'cycle'})
            print(f'9.2 {style:6} {fmt:4}  picked: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
            rec = PICKED_FALLBACKS.get((style, fmt), 0)
            fallback_check(f'9.2 picked {style} {fmt}', r, rec if N <= 200 else -(-rec * N // 200))
            for f in r['failures'][:5]:
                fail(f'9.2 picked {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # 9.2 with every palette picked, in light and dark (row R2)
    for style in STYLES:
        for fmt in FORMATS:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': max(18, N // 8), 'palettes': True, 'variants': 'cycle'})
            print(f'9.2 {style:6} {fmt:4}  each palette, light and dark: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
            fallback_check(f'9.2 palette {style} {fmt}', r, 0)
            for f in r['failures'][:5]:
                fail(f'9.2 palette {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # 9.2 over text layers with the real fonts (spec 8.6, R17): 1 to 8 layers in every mix of levels, N lists per
    # style and format (review R17 E2: every count in both modes in each 16), every layer drawn or flagged, never
    # dropped; fallbacks reported (a list whose slots fit no candidate draws the style's own fallback, flags listed)
    t1 = time.time()
    for style in STYLES:
        for fmt in FORMATS:
            r = pg.evaluate('(o) => window.__rstr.proof.layers(o)', {'styles': [style], 'formats': [fmt], 'n': N})
            print(f'9.2 {style:6} {fmt:4}  layers: {r["count"]} designs, {r["layers"]} layers, {r["flagged"]} flagged, {r["fallbacks"]} fallbacks ({len(r["layerFallbacks"])} from the layers), {len(r["failures"])} failing, {len(r["drawnOrFlagged"])} neither drawn nor flagged')
            for f in r['failures'][:5]:
                fail(f'9.2 layers {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
            for d in r['drawnOrFlagged'][:5]:
                fail(f'9.2 layers {style} {fmt}: a layer neither drawn nor flagged: {d}')
            # Carried R12 (from R17): no list falls back where its slots alone would not
            for d in r['layerFallbacks'][:5]:
                fail(f'9.2 layers {style} {fmt}: a fallback the layers caused: {d}')
    # review R17 S6: the layer lists also through marks light and full (no mark on a text item, labels from the spec),
    # with a photo (9.2 and the "It shows" run inside it), and below through the finishes and the copier pass
    LN = max(25, N // 8)
    for style in STYLES:
        for fmt in FORMATS:
            for label, o in [('marks light', {'marks': 'light'}), ('marks full', {'marks': 'full'}), ('photo', {'photo': {'id': 'test-portrait', 'treatment': None, 'place': None}})]:
                if label == 'photo':
                    pg.evaluate('([i, w, h, s]) => window.__rstr.photo.test(i, w, h, s)', ['test-portrait', 3000, 4000, 7])
                r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': LN, 'start': 400, 'variants': 'cycle', 'layers': True, **o})
                print(f'9.2 {style:6} {fmt:4}  layers, {label}: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
                for f in r['failures'][:5]:
                    fail(f'9.2 layers {label} {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    print(f'layers: {time.time() - t1:.0f} s')
    # 9.2 with each transform forced on Swiss (spec 8.0): a tilted or turned page keeps every text item legal
    for fmt in FORMATS:
        for tr in ['tilt', 'quarter']:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': ['swiss'], 'formats': [fmt], 'n': max(20, N // 4), 'variants': 'cycle', 'params': {'layout.transform': tr}})
            print(f'9.2 swiss  {fmt:4}  {tr} forced: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
            fallback_check(f'9.2 swiss {fmt} {tr}', r, 0)
            for f in r['failures'][:5]:
                fail(f'9.2 swiss {fmt} {tr}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # 9.2 with every graphic parameter at both ends of its range (row R13), every text variant, no fallback; and
    # at the pixel level (review R13 S2): inside every text item's mask, a graphic shows only where the Scene
    # puts one behind it, and only in colours it declared. Each end is also painted once at 9:16 for time.
    nends = npix = 0
    for style in STYLES:
        for g in pg.evaluate('(s) => window.__rstr.proof.graphics(s)', style):
            for k, R in g['params'].items():
                for v in [R['min'], R['max']]:
                    nends += 1
                    o = {'styles': [style], 'n': 2, 'start': 60, 'params': {f'g.{g["name"]}.{k}': v, 'graphics.cut': 2}, 'pick': g['pick']}
                    r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', o)
                    if r['fallbacks']:
                        fail(f'9.2 {style} {g["name"]}.{k}={v}: {r["fallbacks"]} of {r["count"]} fell back', r['fallbackSpecs'][0])
                    for f in r['failures'][:3]:
                        fail(f'9.2 {style} {g["name"]}.{k}={v}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
                    for fmt in FORMATS:
                        for i in range(2):
                            spec = pg.evaluate('([s, f, i, o]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = i ? "dark" : "light"; x.params = o.params; x.pick = { ...x.pick, ...o.pick }; x.seeds = {layout: 61 + i, colour: 62 + i, graphic: 63 + i, type: 64 + i}; return x; }', [style, fmt, i, o])
                            t1 = time.time()
                            px = pg.evaluate('(s) => window.__rstr.graphicLeak(s)', spec)
                            npix += 1
                            if px['leaks'] or px['stray']:
                                fail(f'pixels {style} {fmt} {g["name"]}.{k}={v}: {px["leaks"]} graphic pixels inside text where the Scene has none, {px["stray"]} of an undeclared colour', spec)
                            if fmt == '9:16' and i == 0 and time.time() - t1 > 6:
                                fail(f'paint {style} {g["name"]}.{k}={v}: {time.time() - t1:.1f} s for two 9:16 renders', spec)
    print(f'graphic parameter ends: {nends} ends, each checked for 9.2 over 2 seed sets x 3 formats x 2 modes x every text variant, no fallback; {npix} pixel checks (graphics inside text masks), all passed' if not fails else f'graphic parameter ends: {nends} ends, {npix} pixel checks')
    # knock-outs: stars and grid in a marker colour never show inside any text item's mask, with and without the layer
    nk = 0
    for fmt in FORMATS:
        for lay in ['title-sky', 'title-floor', 'tunnel', 'windows', None]:
            for i in range(4):
                spec = pg.evaluate('([f, l, i]) => { const x = window.__rstr.spec(); x.style = "vapor"; x.format = f; x.pick.layout = l; x.seeds = {layout: 500 + i, colour: 600 + i, graphic: 700 + i, type: 800 + i}; return x; }', [fmt, lay, i])
                r = pg.evaluate('(s) => window.__rstr.knock(s)', spec)
                for path, k in r.items():
                    nk += 1
                    if k['graphics'] == 0 or k['masked'] == 0:
                        fail(f'knock vapor {fmt} {path}: nothing to test ({k})', spec)
                    elif k['leaks']:
                        fail(f'knock vapor {fmt} {path}: {k["leaks"]} marker pixels inside text', spec)
    print(f'knock-outs: {nk} Vaporwave renders, marker never inside text checked')
    # spec 8.2 (review R6 E1): the photocopy ghost shows, paper edge on: at least 2% of the hot word's ink box in
    # the spot colour outside the word's fill and halo
    ng, low = 0, []
    for fmt in FORMATS:
        for i in range(8):
            spec = pg.evaluate('([f, i]) => { const x = window.__rstr.spec(); x.style = "pomo"; x.format = f; x.mode = i % 2 ? "dark" : "light"; x.pick.dialect = "photocopy"; x.seeds = {layout: 900 + i, colour: 910 + i, graphic: 920 + i, type: 930 + i}; return x; }', [fmt, i])
            r = pg.evaluate('(s) => window.__rstr.ghostShows(s)', spec)
            if r is None:
                continue
            ng += 1
            if r['share'] < 0.02:
                low.append(r['share'])
                fail(f'ghost pomo {fmt}: shows on {r["share"] * 100:.1f}% of the word\'s ink box, under 2%', spec)
    print(f'photocopy ghost: {ng} designs, the ghost shows on at least 2% of its word in {ng - len(low)}')
    # 9.2 for photocopy with the paper edge off (review R6 M6): rule 4 waived for the title words only, the rest held
    for fmt in FORMATS:
        r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': ['pomo'], 'formats': [fmt], 'n': max(20, N // 4), 'variants': 'cycle', 'pick': {'dialect': 'photocopy'}, 'params': {'pomo.paperEdge': False}})
        print(f'9.2 pomo   {fmt:4}  photocopy, paper edge off: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
        fallback_check(f'9.2 pomo {fmt} paper edge off', r, 0)
        for f in r['failures'][:5]:
            fail(f'9.2 pomo {fmt} paper edge off: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # review bundle 3 M5: the copier pass keeps photocopy text legible, read on pixels (every text item since review
    # R15 S3: the caption's faintest copy, title words before). Each item's
    # fill, in cells, against its paper halo (or a boxed word's paper against its toner box), on the Clean render
    # (pass included) and on the Scene drawn without the pass: no cell at needRatio without the pass may fall under
    # it with the pass. Cells already under it without the pass are counted and reported (colliding words, Carried
    # R12 from bundle 3). N seed sets per format, light and dark, every text variant in turn (the 9.2 photocopy
    # designs at one text variant each, for time). A paper wash over the Clean render must fail it.
    t1 = time.time()
    for fmt in FORMATS:
        nw = ncell = nd = nbefore = nboxed = 0
        for spec in pg.evaluate('(o) => window.__rstr.specs(o)', {'styles': ['pomo'], 'formats': [fmt], 'n': N, 'variants': 'cycle', 'pick': {'dialect': 'photocopy'}}):
            r = pg.evaluate('(s) => window.__rstr.copierProof(s)', spec)
            if r is None:
                fail(f'copier {fmt}: no copier pass on a photocopy design', spec)
                continue
            nd += 1
            nw += r['words']
            ncell += r['cells']
            nbefore += len(r['before'])
            if r['low']:
                fail(f'copier {fmt}: text under its ratio after the copier pass: {r["low"][:3]}', spec)
            # Carried R12 (from bundle 3): a boxed word's paper letters on its toner box, read without the pass too
            bx = [x for x in r['before'] if x['boxed']]
            nboxed += len(bx)
            if bx:
                fail(f'copier {fmt}: a boxed word under its ratio on its toner box (before the pass): {bx[:3]}', spec)
        print(f'copier pass {fmt:4}  {nd} photocopy designs, {nw} text items, {ncell} cells read with and without the pass; {nbefore} cells under their ratio before the pass, {nboxed} of them a boxed word\'s (must be 0)' + ('' if not fails else ' (failures above)'))
        # review R17 S6: the same over text layer lists
        nw = ncell = nd = nbefore = nboxed = 0
        for spec in pg.evaluate('(o) => window.__rstr.specs(o)', {'styles': ['pomo'], 'formats': [fmt], 'n': max(25, N // 8), 'start': 64, 'variants': 'cycle', 'layers': True, 'pick': {'dialect': 'photocopy'}}):
            r = pg.evaluate('(s) => window.__rstr.copierProof(s)', spec)
            if r is None:
                fail(f'copier layers {fmt}: no copier pass on a photocopy design', spec)
                continue
            nd += 1
            nw += r['words']
            ncell += r['cells']
            nbefore += len(r['before'])
            if r['low']:
                fail(f'copier layers {fmt}: text under its ratio after the copier pass: {r["low"][:3]}', spec)
            bx = [x for x in r['before'] if x['boxed']]
            nboxed += len(bx)
            if bx:
                fail(f'copier layers {fmt}: a boxed word under its ratio on its toner box (before the pass): {bx[:3]}', spec)
        print(f'copier pass {fmt:4}  layers: {nd} photocopy designs, {nw} text items, {ncell} cells; {nbefore} cells under their ratio before the pass, {nboxed} of them a boxed word\'s (must be 0)')
    nwash = 0
    for i in range(3):
        spec = pg.evaluate('(i) => { const x = window.__rstr.spec(); x.style = "pomo"; x.format = "1:1"; x.pick.dialect = "photocopy"; x.seeds = {layout: 70 + i, colour: 71 + i, graphic: 72 + i, type: 73 + i}; return x; }', i)
        r = pg.evaluate('(s) => window.__rstr.copierProof(s, 0.85)', spec)
        nwash += bool(r and r['low'])
        if not (r and r['low']):
            fail('copier check: a paper wash over the render did not fail it', spec)
    print(f'copier check, the test of the test: a paper wash at 0.85 fails {nwash} of 3; {time.time() - t1:.0f} s')
    # the fallback: text far too long for any candidate still draws a legal design
    long = ' '.join(['Antidisestablishmentarianism'] * 14)
    nfb = 0
    for style in STYLES:
        for fmt in FORMATS:
            for i in range(6):
                spec = pg.evaluate('([s, f, i, L]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.seeds = {layout: 100 + i, colour: 200 + i, graphic: 300 + i, type: 400 + i}; const by = (lv) => x.text.find((l) => l.level === lv); by("headline").v = L; by("subhead").v = L; by("caption").v = L; by("data").v = [{k: L, v: L}, {k: "When", v: L}, {k: "X", v: "Y"}]; return x; }', [style, fmt, i, long])
                r = pg.evaluate('(s) => window.__rstr.solve(s)', spec)
                nfb += r['layout'] == 'fallback'
                f = pg.evaluate('(s) => window.__rstr.check(s)', spec)
                if f:
                    fail(f'fallback {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f[:4]), spec)
    print(f'fallback: 72 over-long designs, {nfb} fell back, all checked')
    # 9.3: independence of the four streams, in light and dark; switching the mode moves no box either
    for style in STYLES:
        r = pg.evaluate('(o) => window.__rstr.proof.independence(o)', {'styles': [style], 'n': max(20, N // 4), 'variants': 'cycle'})
        print(f'9.3 {style:6} streams, light and dark: {r["count"]} designs, {len(r["failures"])} failing; the type seed changed the pairing and moved text in {r["typeMoved"]}')
        for f in r['failures'][:5]:
            fail(f'9.3 {style}: {f["facet"]}', f['spec'])
    # only pairings whose fonts are loaded take part here; the real-font type check runs in the online font
    # checks below (it fails if the type seed moves nothing), else only the stub-measure unit test covers it
    print('9.3 type seed: only loaded pairings take part here; the real-font type check runs with the online font checks, or, offline, the stub-measure unit test only')
    # 9.3: the same spec drawn twice gives identical pixels; Postmodern once per dialect, so the copier pass (which
    # reads and writes canvas pixels) is always drawn (review R6 M7)
    for style in STYLES:
        for fmt in FORMATS:
            for i, d in [(i, d) for i in range(4) for d in (['icecream', 'photocopy'] if style == 'pomo' else [None])]:
                spec = pg.evaluate('([s, f, i, d]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = i % 2 ? "dark" : "light"; x.seeds = {layout: 11 + i, colour: 23 + i, graphic: 37 + i, type: 41 + i}; if (d) x.pick.dialect = d; return x; }', [style, fmt, i, d])
                a = pg.evaluate('(s) => window.__rstr.pixels(s)', spec)
                c = pg.evaluate('(s) => window.__rstr.pixels(s)', spec)
                if a != c:
                    fail(f'9.3 {style} {fmt}: the same spec drew different pixels', spec)
    print('9.3 pixels: same spec, same pixels checked')
    # row R7, marks (spec 7.2): 9.2 with marks at light and full over N seed sets per style and format, light and
    # dark; no mark on a text item, no micro label beyond the spec (both folded into the invariants run)
    for level in ['light', 'full']:
        for style in STYLES:
            for fmt in FORMATS:
                r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': N, 'variants': 'cycle', 'marks': level})
                print(f'marks {level:5} {style:6} {fmt:4}  {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
                fallback_check(f'marks {level} {style} {fmt}', r, 0)
                for f in r['failures'][:5]:
                    fail(f'marks {level} {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # row R7, finishes (spec 7.1), every style x format x finish, light and dark, Postmodern in both dialects, marks
    # on for half, and the designs review R7 found broken (E1: Glitch slid the info window from under its text;
    # E2: Grain and Grunge greyed the photocopy title words): the same spec gives the same pixels; with VHS and
    # Glitch every pixel of every text item's fill and of the ring round its ink is Clean's, and no item is taken
    # too low even before the guard (so the guard is a net, not the fix); after the guard no finish takes any cell
    # of a text item under 3:1 that Clean has at 3:1 or more, nor an item Clean reads under 3:1 lower by over 5%
    cases = []
    for style in STYLES:
        for fmt in FORMATS:
            for fin in ['grain', 'grunge', 'vhs', 'glitch']:
                for i in range(4):
                    cases.append(('([s, f, i, fin]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = i % 2 ? "dark" : "light"; x.finish = fin; x.marks = i < 2 ? "off" : "full"; x.seeds = {layout: 51 + i, colour: 52 + i, graphic: 53 + i, type: 54 + i}; if (s === "pomo") x.pick.dialect = i % 2 ? "photocopy" : "icecream"; return x; }', [style, fmt, i, fin]))
    found = [('vapor', '9:16', 'dark', 'off', None, {'layout': 1000 + 11 * 7919, 'colour': 2000 + 11 * 104729, 'graphic': 3000 + 11 * 1299709, 'type': 4000 + 11 * 31}),
             ('pomo', '3:4', 'dark', 'light', 'photocopy', {'layout': 8932, 'colour': 106729, 'graphic': 1302709, 'type': 4031})]
    for fin in ['grain', 'grunge', 'vhs', 'glitch']:
        for st, fm, md, mk, d, seeds in found:
            cases.append(('([s, f, md, mk, d, seeds, fin]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = md; x.marks = mk; x.finish = fin; x.seeds = seeds; x.pick = {palette: null, pairing: null, motif: null, layout: null, dialect: d}; x.params = {}; return x; }', [st, fm, md, mk, d, seeds, fin]))
    # review R17 S6: layer lists through every finish, two per style, format and finish
    for style in STYLES:
        for fmt in FORMATS:
            for fin in ['grain', 'grunge', 'vhs', 'glitch']:
                for spec in pg.evaluate('(o) => window.__rstr.specs(o)', {'styles': [style], 'formats': [fmt], 'modes': ['light'] if fin in ['grain', 'vhs'] else ['dark'], 'n': 2, 'start': 64 + FORMATS.index(fmt) * 2, 'variants': 'cycle', 'layers': True, 'finish': fin, 'marks': 'full' if fin in ['vhs', 'grunge'] else 'off'}):
                    cases.append(('(s) => s', spec))
    nf, nrest, worst = 0, 0, 0
    for js, args in cases:
        spec = pg.evaluate(js, args)
        fin, style, fmt = spec['finish'], spec['style'], spec['format']
        a = pg.evaluate('(s) => window.__rstr.pixels(s)', spec)
        c = pg.evaluate('(s) => window.__rstr.pixels(s)', spec)
        if a != c:
            fail(f'finish {fin} {style} {fmt}: the same spec drew different pixels', spec)
        r = pg.evaluate('(s) => window.__rstr.finishProof(s)', spec)
        nf += 1
        nrest += r['restored']
        if fin in ['vhs', 'glitch']:
            worst = max(worst, r['maxDelta'])
            if r['inkDiff']:
                fail(f'finish {fin} {style} {fmt}: {r["inkDiff"]} pixels of text fill differ from Clean ({r["byPart"]})', spec)
            if r['ringDiff']:
                fail(f'finish {fin} {style} {fmt}: {r["ringDiff"]} pixels of the ring round text differ from Clean', spec)
            if r['rawLow']:
                fail(f'finish {fin} {style} {fmt}: the effect took text too low before the guard: {r["rawLow"][:3]}', spec)
        if r['low']:
            fail(f'finish {fin} {style} {fmt}: too low after the finish: {r["low"][:3]}', spec)
    print(f'finishes: {nf} designs, same pixels twice; VHS and Glitch leave every text fill pixel and every ring pixel as Clean (largest channel difference over the whole ink {worst}/255, none allowed on the fill) and take no item too low before the guard; no text taken too low (read in cells); the guard put back {nrest} items')
    # row R7: export time for the largest format (9:16, 1080 x 1920) by stage, Grunge and Glitch, every style, and
    # Postmodern photocopy with the copier pass timed on its own (Carried R7 from R6); the Style tab's four tiles
    for fin in ['clean', 'grunge', 'glitch']:
        for style, d in [('swiss', None), ('pomo', 'icecream'), ('pomo', 'photocopy'), ('brutal', None), ('vapor', None)]:
            spec = pg.evaluate('([s, d, fin]) => { const x = window.__rstr.spec(); x.style = s; x.format = "9:16"; x.finish = fin; x.marks = "full"; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; if (d) x.pick.dialect = d; return x; }', [style, d, fin])
            runs = [pg.evaluate('(s) => window.__rstr.bench(s)', spec) for _ in range(3)]
            t = sorted(runs, key=lambda x: x['total'])[1]
            print(f'export 9:16 {fin:6} {style:6} {d or "":9}  total {t["total"]:6.0f} ms (scene {t["scene"]:.0f}, paint {t["paint"]:.0f}, effect {t["effect"]:.0f}, text {t["text"]:.0f}, guard {t["guard"]:.0f}, jpeg {t["encode"]:.0f})' + (f'; copier pass alone {t["pass"]:.0f} ms' if t['pass'] else ''))
            if t['total'] > 8000:
                fail(f'export 9:16 {fin} {style}: {t["total"]:.0f} ms', spec)
    for fin in ['clean', 'grunge', 'glitch']:
        spec = pg.evaluate('(fin) => { const x = window.__rstr.spec(); x.format = "3:4"; x.finish = fin; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; return x; }', fin)
        ts = [pg.evaluate('(s) => window.__rstr.tiles(s)', spec) for _ in range(3)][1:]
        best = [min(a, b) for a, b in zip(*ts)]
        print(f'style tiles 3:4 {fin:6}  ' + ', '.join(f'{s} {v:.0f}' for s, v in zip(STYLES, best)) + f' ms; four in {sum(best):.0f} ms (tiles draw Clean)')
    # the same under a 4x CPU throttle, closer to a phone (review R7 S3), and one stage render with Grunge and Clean
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    try:
        for fin in ['clean', 'grunge']:
            spec = pg.evaluate('(fin) => { const x = window.__rstr.spec(); x.format = "3:4"; x.finish = fin; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; return x; }', fin)
            ts = pg.evaluate('(s) => window.__rstr.tiles(s)', spec)
            b3 = pg.evaluate('(s) => window.__rstr.bench(s)', spec)
            print(f'4x throttle 3:4 {fin:6}  four tiles in {sum(ts):.0f} ms (largest {max(ts):.0f}); one render {b3["total"]:.0f} ms')
    finally:
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    # 9.2 rule 6: exports are JPEG or PNG of exactly the format's pixels
    for style in STYLES:
        for fmt in FORMATS:
            for kind in ['image/jpeg', 'image/png']:
                spec = pg.evaluate('([s, f]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; return x; }', [style, fmt])
                r = pg.evaluate('([s, k]) => window.__rstr.exportImage(s, k)', [spec, kind])
                im = Image.open(io.BytesIO(base64.b64decode(r['url'].split(',')[1])))
                want = 'JPEG' if kind == 'image/jpeg' else 'PNG'
                if im.size != SIZES[fmt] or im.format != want:
                    fail(f'9.2.6 {style} {fmt} {kind}: got {im.format} {im.size}', spec)
    print('9.2.6 exports checked')
    # the variety tests of spec 8.0, per style and format: reported, enforced from each style's own row (R5, R6, R8, R9)
    for style in STYLES:
        for fmt in FORMATS:
            v = pg.evaluate('([s, f]) => window.__rstr.proof.variety(s, f, 300)', [style, fmt])
            miss = {k: x for k, x in v['missing'].items() if x}
            res = lambda ok: 'pass' if ok else 'FAIL'
            print(f'variety {style:6} {fmt:4}  60 shuffles: {v["repeats60"]} repeats ({res(v["pass"]["sixty"])}); 300 shuffles: missing {miss or "nothing"} ({res(v["pass"]["coverage"])}); top layout {v["top"]["layout"]} {v["top"]["share"] * 100:.0f}% ({res(v["pass"]["share"])})')
            if style in ENFORCED and not all(v['pass'].values()):
                fail(f'variety {style} {fmt}: {v["pass"]}')
    # review bundle 4 M5: spec 8.3's full-width rule (every title line of four words or fewer spans the inner width
    # within 1%) with each bundled Brutalist face, as tests/brutal.test.ts checks it on the stub measure; a pairing
    # whose fonts are not loaded is skipped and reported (the online ones: Carried R3)
    nwide = 0
    for pid in pg.evaluate('() => window.__rstr.fonts.pairings("brutal")'):
        if not pg.evaluate('(id) => window.__rstr.fonts.available(id)', pid):
            print(f'full width brutal {pid}: fonts not loaded, skipped (Carried R3)')
            continue
        r = pg.evaluate('(o) => window.__rstr.proof.brutalWidth(o)', {'n': max(30, N // 4), 'variants': 'cycle', 'pick': {'pairing': pid}})
        print(f'full width brutal {pid}: {r["designs"]} designs, {r["lines"]} title lines, {len(r["off"])} off by 1% or more, {r["fallbacks"]} fallbacks, {r["skipped"]} not drawn with the pairing')
        if r['designs'] == 0 or r['skipped']:
            fail(f'full width brutal {pid}: nothing measured with its own faces ({r["designs"]} designs, {r["skipped"]} skipped)')
        nwide += 1
        for x in r['off'][:3]:
            fail(f'full width brutal {pid}: "{x["line"]}" {x["got"]:.1f} of {x["want"]:.1f} px', x['spec'])
    if nwide < 2:
        fail(f'full width brutal: {nwide} pairings measured with their own faces, the bundled ones expected')
    # spec 8.2 (R6): each Postmodern dialect alone meets the 60-shuffle test (and is reported on the other two)
    for style in STYLES:
        for d in pg.evaluate('(s) => window.__rstr.proof.dialects(s)', style):
            for fmt in FORMATS:
                v = pg.evaluate('([s, f, d]) => window.__rstr.proof.variety(s, f, 300, { dialect: d })', [style, fmt, d])
                miss = {k: x for k, x in v['missing'].items() if x}
                print(f'variety {style:6} {fmt:4}  {d}: 60 shuffles: {v["repeats60"]} repeats; 300: missing {miss or "nothing"}; top layout {v["top"]["layout"]} {v["top"]["share"] * 100:.0f}%')
                if style in ENFORCED and not v['pass']['sixty']:
                    fail(f'variety {style} {fmt} {d}: {v["repeats60"]} repeats in 60')
    print(f'variety: enforced for {", ".join(ENFORCED)}')
    # row R10 (review R10 S3): every Advanced value of every non-library control, and every colour edit (each design
    # colour set to each other and to grey), through 9.2 with the real fonts, per style x format x mode, seed sets 0
    # and 7 (review R10's probe set), marks light, Grain on: no value may drop a design to the fallback, no rule may
    # fail, and under a colour edit a rule 4 failure must be one the Scene warns of
    t1 = time.time()
    for style in STYLES:
        for fmt in FORMATS:
            for start in (0, 7):
                r = pg.evaluate('(o) => window.__rstr.proof.advanced(o)', {'styles': [style], 'formats': [fmt], 'n': 1, 'start': start})
                print(f'advanced {style:6} {fmt:4} seed set {start}: {r["designs"]} designs, {r["values"]} values, {r["edits"]} colour edits ({r["warned"]} warned), {len(r["fallbacks"])} fallbacks, {len(r["failures"])} failing')
                for x in r['fallbacks'][:3]:
                    fail(f'advanced {style} {fmt}: {x["id"]} = {json.dumps(x["v"])} drops the design to the fallback', x['spec'])
                for x in r['failures'][:3]:
                    fail(f'advanced {style} {fmt}: {x["id"]} = {json.dumps(x["v"])}: ' + '; '.join(f'rule {y["rule"]} {y["part"]}: {y["msg"]}' for y in x['failures'][:4]), x['spec'])
    # review R10 S4: the finish strength changes the finished pixels (0 against 1.5), every finish
    for fin, style in (('grain', 'swiss'), ('grunge', 'brutal'), ('vhs', 'vapor'), ('glitch', 'pomo')):
        spec = pg.evaluate('([f, s]) => { const x = window.__rstr.spec(); x.style = s; x.finish = f; x.format = "1:1"; x.params = {}; return x; }', [fin, style])
        px = {}
        for k in (0, 1.5):
            spec['params'] = {f'finish.{fin}.strength': k}
            px[k] = pg.evaluate('(s) => window.__rstr.pixels(s)', spec)
        if px[0] == px[1.5]:
            fail(f'finish {fin}: strength 0 and 1.5 drew the same pixels', spec)
    print(f'advanced: values, colour edits and the finish strength on the real fonts took {time.time() - t1:.0f} s')
    # row R14 (spec 8.9, 9.4): with a test photo, portrait and landscape, 9.2 in every style, format and role, no
    # fallback; unpinned too; text over the photo read on pixels; the same spec and photo draw the same pixels
    t1 = time.time()
    for pid, w, h, sd in [('test-portrait', 3000, 4000, 7), ('test-landscape', 4000, 2600, 11)]:
        pg.evaluate('([i, w, h, s]) => window.__rstr.photo.test(i, w, h, s)', [pid, w, h, sd])
    nph = 0
    for style in STYLES:
        for fmt in FORMATS:
            for role in ['ground', 'box', 'disc', 'column', 'band', None]:
                for pid in ['test-portrait', 'test-landscape']:
                    # a multiple of the seven text variants, so each pinned role meets each slot alone (review R14 S2)
                    o = {'styles': [style], 'formats': [fmt], 'n': -(-max(7, N // (40 if role else 10)) // 7) * 7, 'start': 300, 'variants': 'cycle',
                         'photo': {'id': pid, 'treatment': None, 'place': {'role': role} if role else None}}
                    r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', o)
                    nph += r['count']
                    fallback_check(f'9.2 photo {style} {fmt} {role or "unpinned"} {pid}', r, 0)
                    for f in r['failures'][:3]:
                        fail(f'9.2 photo {style} {fmt} {role} {pid}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    print(f'photo 9.2: {nph} designs over {len(STYLES)} styles x {len(FORMATS)} formats x 5 roles and unpinned x 2 test photos x 2 modes, real fonts')
    npx = meas = plat = 0
    for style in STYLES:
        for k, role in enumerate(['ground', 'box', 'disc', 'column', 'band']):
            for i in range(3):
                spec = pg.evaluate('([s, r, k, i]) => { const TR = ["colour", "mono", "duotone", "halftone", "threshold", "posterise", "dither"]; const x = window.__rstr.spec(); x.style = s; x.format = ["1:1", "3:4", "9:16", "A"][(k + i) % 4]; x.mode = i % 2 ? "dark" : "light"; x.params = {}; x.finish = "clean"; x.marks = "off"; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null}; x.seeds = {layout: 7100 + k * 31 + i, colour: 7200 + i, graphic: 7300 + k + i, type: 7400 + i}; x.photo = {id: i % 2 ? "test-landscape" : "test-portrait", treatment: TR[(k * 3 + i) % TR.length], place: {role: r}}; return x; }', [style, role, k, i])
                r = pg.evaluate('(s) => window.__rstr.photo.pixels(s)', spec)
                npx += r['items']
                meas += r['measured']
                plat += r['plated']
                if r['low']:
                    fail(f'photo pixels {style} {role}: {r["low"]} of {r["masked"]} text pixels over the photo under the ratio of spec 5 {r["lows"]}', spec)
                if i == 0 and k == 0:
                    # each draw treats the photo afresh (review R15 S2: the second reused the first's treated box)
                    a = pg.evaluate('(s) => window.__rstr.pixels(s, true)', spec)
                    if a != pg.evaluate('(s) => window.__rstr.pixels(s, true)', spec):
                        fail(f'photo determinism {style}: the same spec and photo drew different pixels', spec)
    print(f'photo pixels: {npx} text items over the photo read on pixels ({meas} measured, {plat} on a plate, {npx - meas - plat} on neither; every one read on pixels), none under spec 5; determinism per style; {time.time() - t1:.0f} s')
    # row R15 (spec 8.9, 9.4): 9.2 in every treatment, every style, real fonts, no fallback; text over the photo on
    # pixels in every treatment; photocopy text over the photo read with the copier pass on (Carried R15 from R14);
    # the treatment's time at 1080 x 1920
    t1 = time.time()
    TREATS = ['colour', 'mono', 'duotone', 'halftone', 'threshold', 'posterise', 'dither']
    ntr = 0
    for style in STYLES:
        for t in TREATS:
            o = {'styles': [style], 'n': 7, 'start': 500, 'variants': 'cycle', 'photo': {'id': 'test-portrait' if len(t) % 2 else 'test-landscape', 'treatment': t, 'place': None}}
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', o)
            ntr += r['count']
            fallback_check(f'9.2 photo {style} {t}', r, 0)
            for f in r['failures'][:3]:
                fail(f'9.2 photo {style} {t}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    TS = '([s, t, i, d]) => { const x = window.__rstr.spec(); x.style = s; x.format = ["1:1", "3:4", "9:16", "A"][(i + ["colour", "mono", "duotone", "halftone", "threshold", "posterise", "dither"].indexOf(t)) % 4]; x.mode = (i >> 1) % 2 ? "dark" : "light"; x.params = {}; x.finish = "clean"; x.marks = "off"; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: d}; x.seeds = {layout: 6100 + i * 37, colour: 6200 + i, graphic: 6300 + i, type: 6400 + i}; x.photo = {id: i % 2 ? "test-landscape" : "test-portrait", treatment: t, place: {role: ["ground", "box", "disc", "column", "band"][i % 5]}}; return x; }'
    ntp = ntl = 0
    for style in STYLES:
        for t in TREATS:
            for i in range(2):
                spec = pg.evaluate(TS, [style, t, i, None])
                r = pg.evaluate('(s) => window.__rstr.photo.pixels(s)', spec)
                ntp += r['items']
                if r['low']:
                    fail(f'photo pixels {style} {t}: {r["low"]} of {r["masked"]} text pixels over the photo under the ratio of spec 5 {r["lows"]}', spec)
            a = pg.evaluate('(s) => window.__rstr.pixels(s, true)', spec)
            if a != pg.evaluate('(s) => window.__rstr.pixels(s, true)', spec):
                fail(f'photo determinism {style} {t}: the same spec, photo and treatment drew different pixels', spec)
    print(f'photo treatments: 9.2 on {ntr} designs (4 styles x 7 treatments), {ntp} text items over a treated photo read on pixels, determinism per style and treatment; {time.time() - t1:.0f} s')
    t1 = time.time()
    cw = cc = cb = cl = 0
    for t in TREATS:
        for i in range(8):
            spec = pg.evaluate(TS, ['pomo', t, i, 'photocopy'])
            r = pg.evaluate('(s) => window.__rstr.photo.copier(s)', spec)
            if r is None:
                fail(f'photo copier {t}: a photocopy design drew no copier pass', spec)
                continue
            cw += r['items']
            cc += r['cells']
            cb += len(r['before'])
            cl += len(r['low'])
            for x in r['low'][:3]:
                fail(f'photo copier {t}: {x["part"]} cell {x["cell"]} at {x["ratio"]} under {x["need"]} with the copier pass over the photo', spec)
    if cw < 20:
        fail(f'photo copier: only {cw} text items over the photo read with the pass, want at least 20')
    print(f'photo copier: {cw} photocopy text items over the photo, {cc} cells read with the copier pass on, {cl} taken under by it, {cb} under before it; {time.time() - t1:.0f} s')
    times = {}
    for t in TREATS:
        spec = pg.evaluate('(t) => { const x = window.__rstr.spec(); x.style = "swiss"; x.format = "9:16"; x.finish = "clean"; x.marks = "off"; x.params = {}; x.photo = {id: "test-portrait", treatment: t, place: {role: "ground"}}; return x; }', t)
        rs = [pg.evaluate('(s) => window.__rstr.photo.treatTime(s)', spec) for _ in range(5)]
        if not rs[0]:
            fail(f'treatment time {t}: no photo drawn', spec)
            continue
        ms = sorted(r['ms'] for r in rs)[2]
        rd = sorted(r['render'] for r in rs)[2]
        times[t] = (ms, rd, rs[0]['w'], rs[0]['h'])
    print('treatment time at 1080 x 1920 (ground photo, median of 5, ms; in brackets the whole first render, the treated box made afresh, review R15 M3): ' + ', '.join(f'{t} {v[0]:.0f} ({v[1]:.0f})' for t, v in times.items()) + (f'; box {list(times.values())[0][2]} x {list(times.values())[0][3]}' if times else ''))
    # review R14 S7: text over the test photo's calm sky and its hills (ground, close in, at the top and lower down),
    # so the measured path is read on pixels often, not a handful of times
    PH = '([s, k, i, sc, y]) => { const x = window.__rstr.spec(); x.style = s; x.format = ["1:1", "3:4", "9:16", "A"][i % 4]; x.mode = (i >> 1) % 2 ? "dark" : "light"; x.params = {}; x.finish = "clean"; x.marks = "off"; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null}; x.seeds = {layout: 9100 + k * 37 + i, colour: 9200 + i, graphic: 9300 + k + i, type: 9400 + i}; x.photo = {id: i % 2 ? "test-landscape" : "test-portrait", treatment: "colour", place: sc ? {role: "ground", scale: sc, x: 0.5, y: y} : (k < 5 ? {role: ["ground", "box", "disc", "column", "band"][k]} : null)}; return x; }'
    t1 = time.time()
    n2 = meas2 = 0
    for k, style in enumerate(STYLES):
        for i in range(12):
            for sc_, y in ((2.5, 0), (2.5, 0.7)):
                spec = pg.evaluate(PH, [style, k, i, sc_, y])
                r = pg.evaluate('(s) => window.__rstr.photo.pixels(s)', spec)
                n2 += r['items']
                meas2 += r['measured']
                if r['low']:
                    fail(f'photo pixels (calm) {style}: {r["low"]} of {r["masked"]} text pixels over the photo under the ratio of spec 5 {r["lows"]}', spec)
    if meas2 < 50:
        fail(f'photo pixels (calm): only {meas2} text items measured over the photo, want at least 50')
    print(f'photo pixels over calm areas: {n2} text items, {meas2} measured on pixels, none under spec 5; {time.time() - t1:.0f} s')
    # review R14 S1 (spec 8.9): the share of the photo's box that shows, read on pixels, in every style and role;
    # the stream's choice (unpinned) must show at least 35% on pixels wherever the engine says it does
    t1 = time.time()
    shows = {}
    for k, style in enumerate(STYLES):
        for role in range(6):
            for i in range(4):
                spec = pg.evaluate(PH, [style, role, i, 0, 0])
                r = pg.evaluate('(s) => window.__rstr.photo.shows(s)', spec)
                if not r:
                    fail(f'photo shows {style}: the design drew no photo', spec)
                    continue
                key = f'{style} {"unpinned" if role == 5 else r["role"]}'
                shows.setdefault(key, []).append(r['share'])
                if role == 5 and r['scene'] >= 0.35 and r['share'] < 0.35:
                    fail(f'photo shows {style} unpinned {r["role"]}: {r["share"]:.2f} of its box on pixels, the Scene said {r["scene"]:.2f}', spec)
    under = {key: sum(1 for v in vs if v < 0.35) for key, vs in shows.items()}
    print(f'photo shows (pixels): {sum(len(v) for v in shows.values())} designs; under 35% of the box: ' + ', '.join(f'{key} {n}/{len(shows[key])}' for key, n in sorted(under.items()) if n) + f'; {time.time() - t1:.0f} s')
    # review R17 S6: the photo's "It shows" floor (8.9) with up to four more plates of text layers on the page
    nsh, low = 0, 0
    for style in STYLES:
        for fmt in FORMATS:
            for spec in pg.evaluate('(o) => window.__rstr.specs(o)', {'styles': [style], 'formats': [fmt], 'modes': ['light', 'dark'], 'n': 3, 'start': 64 + FORMATS.index(fmt) * 3, 'variants': 'cycle', 'layers': True, 'photo': {'id': 'test-portrait', 'treatment': None, 'place': None}}):
                r = pg.evaluate('(s) => window.__rstr.photo.shows(s)', spec)
                if not r:
                    fail(f'photo shows layers {style} {fmt}: the design drew no photo', spec)
                    continue
                nsh += 1
                low += r['share'] < 0.35
                if r['scene'] >= 0.35 and r['share'] < 0.35:
                    fail(f'photo shows layers {style} {fmt} {r["role"]}: {r["share"]:.2f} of its box on pixels, the Scene said {r["scene"]:.2f}', spec)
    print(f'photo shows (pixels), text layers: {nsh} designs, {low} under 35% of the box (where no placement reaches it, spec 8.9)')
    print(f'engine checks took {time.time() - t0:.0f} s')
    # row R16 (spec 10.1, 9.4): export sizes, files, strips, the bleed, the honest failure, the export size of marks,
    # finishes and photo
    exportcheck.run(pg, fail)
    # spec 6: online loading, the cache, the 4 s wait, the note, and no layout with a fallback face
    t0 = time.time()
    skipped = fontcheck.run(b, url, pg, max(4, N // 25), fail)
    print(f'font checks took {time.time() - t0:.0f} s')
    if errors:
        fail('page errors: ' + '; '.join(errors[:3]))
    pg.close()

    # row R16 (spec 9.4): the A3 print render in a fresh page, its time and peak memory
    exportcheck.bench(b, url, fail, open_app)

    # the frame and Simple mode at both phone sizes (spec 10, row R4)
    appcheck.run(b, url, fail)
    appcheck.run_photo(b, url, fail)
    appcheck.run_limits(b, url, fail)
    appcheck.run_fullest(b, url, fail)

# the summary carries the skipped online checks, so a reader of the last line alone sees the gap (review R3 S1)
if fails:
    print(f'smoke: FAILED, {len(fails)} problems' + (f'; {skipped} online checks SKIPPED (not verified)' if skipped else ''))
else:
    print('smoke: passed' + (f', {skipped} online checks SKIPPED (not verified)' if skipped else ''))
sys.exit(1 if fails else 0)
