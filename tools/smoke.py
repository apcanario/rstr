"""npm run smoke: the built app in headless Chrome. Runs spec 9.2 and 9.3 over many seeds with the real fonts,
taps the controls at both phone sizes, and checks exports. Any failure prints the spec that caused it."""
import base64, io, json, sys, time
from PIL import Image
from common import browser, idle, open_app, served
import appcheck, fontcheck

N = int(sys.argv[1]) if len(sys.argv) > 1 else 200
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
FORMATS = ['1:1', '3:4', '9:16']
SIZES = {'1:1': (1080, 1080), '3:4': (1080, 1440), '9:16': (1080, 1920)}
fails = []
# Fallbacks allowed when a layout or motif is picked, at N = 200 (review R2 S1): a picked Vaporwave sky title
# cannot always fit. The runs draw seeds 0..N-1, so for N <= 200 these counts are a ceiling; above, scaled.
# Unpicked and per-palette runs allow none: a fallback there means a palette or form cut every candidate.
PICKED_FALLBACKS = {('vapor', '1:1'): 196, ('vapor', '3:4'): 6, ('vapor', '9:16'): 6}


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
    # knock-outs: stars and grid in a marker colour never show inside any text item's mask, with and without the layer
    nk = 0
    for fmt in FORMATS:
        for lay in ['title-sky', 'title-floor', None]:
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
    # the fallback: text far too long for any candidate still draws a legal design
    long = ' '.join(['Antidisestablishmentarianism'] * 14)
    nfb = 0
    for style in STYLES:
        for fmt in FORMATS:
            for i in range(6):
                spec = pg.evaluate('([s, f, i, L]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.seeds = {layout: 100 + i, colour: 200 + i, graphic: 300 + i, type: 400 + i}; x.text.title.v = L; x.text.subtitle.v = L; x.text.caption.v = L; x.text.info.v = [{k: L, v: L}, {k: "When", v: L}, {k: "X", v: "Y"}]; return x; }', [style, fmt, i, long])
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
    # 9.3: the same spec drawn twice gives identical pixels
    for style in STYLES:
        for fmt in FORMATS:
            for i in range(4):
                spec = pg.evaluate('([s, f, i]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = i % 2 ? "dark" : "light"; x.seeds = {layout: 11 + i, colour: 23 + i, graphic: 37 + i, type: 41 + i}; return x; }', [style, fmt, i])
                a = pg.evaluate('(s) => window.__rstr.pixels(s)', spec)
                c = pg.evaluate('(s) => window.__rstr.pixels(s)', spec)
                if a != c:
                    fail(f'9.3 {style} {fmt}: the same spec drew different pixels', spec)
    print('9.3 pixels: same spec, same pixels checked')
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
    print(f'engine checks took {time.time() - t0:.0f} s')
    # spec 6: online loading, the cache, the 4 s wait, the note, and no layout with a fallback face
    t0 = time.time()
    skipped = fontcheck.run(b, url, pg, max(4, N // 25), fail)
    print(f'font checks took {time.time() - t0:.0f} s')
    if errors:
        fail('page errors: ' + '; '.join(errors[:3]))
    pg.close()

    # the frame and Simple mode at both phone sizes (spec 10, row R4)
    appcheck.run(b, url, fail)

# the summary carries the skipped online checks, so a reader of the last line alone sees the gap (review R3 S1)
if fails:
    print(f'smoke: FAILED, {len(fails)} problems' + (f'; {skipped} online checks SKIPPED (not verified)' if skipped else ''))
else:
    print('smoke: passed' + (f', {skipped} online checks SKIPPED (not verified)' if skipped else ''))
sys.exit(1 if fails else 0)
