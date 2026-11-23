"""npm run smoke: the built app in headless Chrome. Runs spec 9.2 and 9.3 over many seeds with the real fonts,
taps the controls at both phone sizes, and checks exports. Any failure prints the spec that caused it."""
import base64, io, json, sys, time
from PIL import Image
from common import browser, open_app, served

N = int(sys.argv[1]) if len(sys.argv) > 1 else 200
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
FORMATS = ['1:1', '3:4', '9:16']
SIZES = {'1:1': (1080, 1080), '3:4': (1080, 1440), '9:16': (1080, 1920)}
fails = []


def fail(msg, spec=None):
    fails.append(msg)
    print('FAIL', msg)
    if spec is not None:
        print('  spec:', json.dumps(spec, ensure_ascii=False))


with served() as url, browser() as b:
    pg, errors = open_app(b, url)
    t0 = time.time()
    # 9.2, rules 1 to 5, over N seed sets per style x format x mode, each with every text variant
    for style in STYLES:
        for fmt in FORMATS:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': N})
            print(f'9.2 {style:6} {fmt:4}  {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
            for f in r['failures'][:5]:
                fail(f'9.2 {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # 9.2 with every value of pick.layout and pick.motif: a picked spec is tested like a seeded one
    for style in STYLES:
        for fmt in FORMATS:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': N, 'picks': 'each', 'variants': 'cycle'})
            print(f'9.2 {style:6} {fmt:4}  picked: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
            for f in r['failures'][:5]:
                fail(f'9.2 picked {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]), f['spec'])
    # 9.2 with every palette picked, in light and dark (row R2)
    for style in STYLES:
        for fmt in FORMATS:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': max(18, N // 8), 'palettes': True, 'variants': 'cycle'})
            print(f'9.2 {style:6} {fmt:4}  each palette, light and dark: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing')
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
        print(f'9.3 {style:6} streams, light and dark: {r["count"]} designs, {len(r["failures"])} failing')
        for f in r['failures'][:5]:
            fail(f'9.3 {style}: {f["facet"]}', f['spec'])
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
    if errors:
        fail('page errors: ' + '; '.join(errors[:3]))
    pg.close()

    # the app at both phone sizes: nothing scrolls, controls at least 48 px, Shuffle and format work, export downloads
    for (w, h) in [(360, 640), (412, 915)]:
        pg, errors = open_app(b, url, w, h)
        for style in STYLES:
            pg.click(f'button[data-style="{style}"]')
            for fmt in FORMATS:
                pg.click(f'button[data-format="{fmt}"]')
                before = pg.evaluate('() => JSON.stringify(window.__rstr.spec().seeds)')
                pg.click('[data-testid="shuffle"]')
                after = pg.evaluate('() => window.__rstr.spec()')
                if json.dumps(after['seeds'], separators=(',', ':')) == before:
                    fail(f'app {w}x{h}: Shuffle did not change the seeds')
                if after['style'] != style or after['format'] != fmt:
                    fail(f'app {w}x{h}: style or format not applied')
                f = pg.evaluate('(s) => window.__rstr.check(s)', after)
                if f:
                    fail(f'app {w}x{h} {style} {fmt}: {f[:3]}', after)
                cw, ch = pg.evaluate('() => { const c = document.querySelector("canvas"); return [c.width, c.height]; }')
                if (cw, ch) != SIZES[fmt]:
                    fail(f'app {w}x{h}: stage canvas is {cw}x{ch} for {fmt}')
        # Light / Dark: the switch changes the mode and nothing else, and the design stays legal
        for _ in range(2):
            before = pg.evaluate('() => window.__rstr.spec()')
            pg.click('[data-testid="mode"]')
            after = pg.evaluate('() => window.__rstr.spec()')
            if after['mode'] == before['mode'] or after['seeds'] != before['seeds'] or after['style'] != before['style']:
                fail(f'app {w}x{h}: the mode switch did not change only the mode')
            if pg.inner_text('[data-testid="mode"]').strip().lower() != after['mode']:
                fail(f'app {w}x{h}: the mode switch shows the wrong label')
            f = pg.evaluate('(s) => window.__rstr.check(s)', after)
            if f:
                fail(f'app {w}x{h} mode {after["mode"]}: {f[:3]}', after)
        sc = pg.evaluate('() => [document.documentElement.scrollHeight, document.documentElement.clientHeight, document.documentElement.scrollWidth, document.documentElement.clientWidth]')
        if sc[0] > sc[1] or sc[2] > sc[3]:
            fail(f'app {w}x{h}: the page scrolls {sc}')
        small = pg.evaluate('() => [...document.querySelectorAll("button")].map(b => b.getBoundingClientRect()).filter(r => r.height < 47.5 || r.width < 47.5).length')
        if small:
            fail(f'app {w}x{h}: {small} controls under 48 px')
        over = pg.evaluate('''() => [...document.querySelectorAll("button")].filter(b => {
            const r = document.createRange(); r.selectNodeContents(b);
            const t = r.getBoundingClientRect(), s = getComputedStyle(b), bb = b.getBoundingClientRect();
            const inner = bb.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
            const lines = r.getClientRects().length;
            return t.width > inner + 0.5 || b.scrollWidth > b.clientWidth + 1 || (b.textContent.trim() && t.height > parseFloat(s.lineHeight || '0') * 1.5 && lines > 1);
        }).map(b => b.textContent)''')
        if over:
            fail(f'app {w}x{h}: text overflows on {over}')
        with pg.expect_download() as dl:
            pg.click('[data-testid="export"]')
        path = dl.value.path()
        im = Image.open(path)
        fmt = pg.evaluate('() => window.__rstr.spec().format')
        if im.size != SIZES[fmt] or im.format != 'JPEG':
            fail(f'app {w}x{h}: exported {im.format} {im.size} for {fmt}')
        if not dl.value.suggested_filename.startswith('rstr-'):
            fail(f'app {w}x{h}: export name {dl.value.suggested_filename}')
        if errors:
            fail(f'app {w}x{h}: page errors {errors[:3]}')
        print(f'app {w}x{h}: controls, scroll, shuffle and export checked')
        pg.close()

print('smoke:', 'FAILED, ' + str(len(fails)) + ' problems' if fails else 'passed')
sys.exit(1 if fails else 0)
