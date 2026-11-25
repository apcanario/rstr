"""npm run sheet: contact sheets and app screens to shots/. A person or a reviewer looks at them."""
import base64, io, os, sys
from PIL import Image, ImageDraw
from common import ROOT, browser, idle, open_app, served
from refs import ref_specs
from sheet_lib import img, strip
import appcheck

OUT = os.path.join(ROOT, 'shots')
os.makedirs(OUT, exist_ok=True)
REFS = os.path.join(ROOT, 'docs', 'design', 'refs')
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
FORMATS = ['1:1', '3:4', '9:16']


with served() as url, browser() as b:
    pg, errors = open_app(b, url)
    # per style: 12 designs across the three formats, in light and in dark (the same seeds in both)
    for style in STYLES:
        for mode in ['light', 'dark']:
            rows = []
            for row in range(2):
                cells = []
                for i in range(6):
                    n = row * 6 + i
                    fmt = FORMATS[n % 3]
                    spec = pg.evaluate('([s, f, n, md]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = md; x.seeds = {layout: 1000 + n * 7919, colour: 2000 + n * 104729, graphic: 3000 + n * 1299709, type: 4000 + n * 31}; x.pick = {palette: null, pairing: null, motif: null, layout: null}; return x; }', [style, fmt, n, mode])
                    sol = pg.evaluate('(s) => window.__rstr.solve(s)', spec)
                    sc = pg.evaluate('(s) => { const c = window.__rstr.scene(s); return c.palette + " " + c.pairing; }', spec)
                    cells.append((img(pg, spec), f'{fmt} {mode} {sc} {sol["layout"]}'))
                rows.append(cells)
            strip(rows).save(os.path.join(OUT, f'sheet-{style}-{mode}.jpg'), quality=85)
            print('wrote', f'shots/sheet-{style}-{mode}.jpg')
    # row R7: one sheet per finish and one per marks level (off is every other sheet): every style in every format,
    # light and dark alternating, the same seeds on each sheet so they compare cell for cell
    for kind, values in [('finish', ['clean', 'grain', 'grunge', 'vhs', 'glitch']), ('marks', ['light', 'full'])]:
        for v in values:
            rows = []
            for si, style in enumerate(STYLES):
                cells = []
                for fi, fmt in enumerate(FORMATS):
                    n = si * 3 + fi
                    spec = pg.evaluate('([s, f, n, k, v]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = n % 2 ? "dark" : "light"; x.seeds = {layout: 1000 + n * 7919, colour: 2000 + n * 104729, graphic: 3000 + n * 1299709, type: 4000 + n * 31}; x.pick = {palette: null, pairing: null, motif: null, layout: null, dialect: s === "pomo" ? (n % 2 ? "photocopy" : "icecream") : null}; x.params = {}; x.finish = k === "finish" ? v : "clean"; x.marks = k === "marks" ? v : "off"; return x; }', [style, fmt, n, kind, v])
                    cells.append((img(pg, spec), f'{style} {fmt} {spec["mode"]} {kind} {v}'))
                rows.append(cells)
            strip(rows, h=520).save(os.path.join(OUT, f'{kind}-{v}.jpg'), quality=85)
            print('wrote', f'shots/{kind}-{v}.jpg')
    # Postmodern per dialect (R6): 12 designs across the formats, light and dark alternating
    for d in ['icecream', 'photocopy']:
        rows = []
        for row in range(2):
            cells = []
            for i in range(6):
                n = row * 6 + i
                spec = pg.evaluate('([d, n, f]) => { const x = window.__rstr.spec(); x.style = "pomo"; x.format = f; x.mode = n % 4 === 3 ? "dark" : "light"; x.seeds = {layout: 5100 + n * 7919, colour: 5200 + n * 104729, graphic: 5300 + n * 1299709, type: 5400 + n * 31}; x.pick = {palette: null, pairing: null, motif: null, layout: null, dialect: d}; x.params = {}; return x; }', [d, n, FORMATS[n % 3]])
                sc = pg.evaluate('(s) => { const c = window.__rstr.scene(s); return [c.frame, c.transform, c.palette, c.layout].join(" "); }', spec)
                cells.append((img(pg, spec), sc))
            rows.append(cells)
        strip(rows).save(os.path.join(OUT, f'sheet-pomo-{d}.jpg'), quality=85)
        print('wrote', f'shots/sheet-pomo-{d}.jpg')
    # per style: 24 shuffles at 3:4, labelled with what the variety tests count (row R13)
    for style in STYLES:
        rows = []
        for row in range(3):
            cells = []
            for i in range(8):
                n = row * 8 + i
                spec = pg.evaluate('([s, n]) => { const x = window.__rstr.spec(); x.style = s; x.format = "3:4"; x.mode = n % 3 ? "light" : "dark"; x.seeds = {layout: 9100 + n * 7919, colour: 9200 + n * 104729, graphic: 9300 + n * 1299709, type: 9400 + n * 31}; x.pick = {palette: null, pairing: null, motif: null, layout: null}; return x; }', [style, n])
                sc = pg.evaluate('(s) => { const c = window.__rstr.scene(s); return [c.frame, c.transform, c.graphics.slice(0, 3).join("+")].join(" "); }', spec)
                cells.append((img(pg, spec), sc))
            rows.append(cells)
        strip(rows, h=420).save(os.path.join(OUT, f'variety-{style}.jpg'), quality=85)
        print('wrote', f'shots/variety-{style}.jpg')
    # per style: every palette, light above dark, one layout at 3:4, so the two forms can be compared (Swiss pins
    # graphic-above: its seeds roll type only, which shows no graphic or field, review R5 M1)
    for style in STYLES:
        ids = pg.evaluate('(s) => window.__rstr.palettes(s)', style)
        rows = []
        # Postmodern: a pair of rows per dialect (R6), so the ice cream 3:4 of bundle 1 M1 stays on this sheet
        for dialect in (['icecream', 'photocopy'] if style == 'pomo' else [None]):
            for mode in ['light', 'dark']:
                cells = []
                for pid in ids:
                    spec = pg.evaluate('([s, p, md, d]) => { const x = window.__rstr.spec(); x.style = s; x.format = "3:4"; x.mode = md; x.seeds = {layout: 4242, colour: 1, graphic: 5151, type: 6}; x.pick = {palette: p, pairing: null, motif: null, layout: s === "swiss" ? "graphic-above" : null, dialect: d}; x.params = {}; return x; }', [style, pid, mode, dialect])
                    cells.append((img(pg, spec), f'{pid} {mode}' + (f' {dialect}' if dialect else '')))
                rows.append(cells)
        strip(rows, h=420).save(os.path.join(OUT, f'palettes-{style}.jpg'), quality=85)
        print('wrote', f'shots/palettes-{style}.jpg')
    # per style: every pairing with the same other seeds (row R3). A pairing whose fonts could not be fetched
    # draws with the style's default, and its label says so.
    for style in STYLES:
        ids = pg.evaluate('(s) => window.__rstr.fonts.pairings(s)', style)
        cells, missing = [], 0
        for pid in ids:
            pg.evaluate('(id) => window.__rstr.fonts.ensure(id, 8000)', pid)
            spec = pg.evaluate('([s, p]) => { const x = window.__rstr.spec(); x.style = s; x.format = "3:4"; x.mode = "light"; x.seeds = {layout: 4242, colour: 1, graphic: 5151, type: 6}; x.pick = {palette: null, pairing: p, motif: null, layout: null}; return x; }', [style, pid])
            drawn = pg.evaluate('(s) => window.__rstr.scene(s).pairing', spec)
            missing += drawn != pid
            cells.append((img(pg, spec), pid if drawn == pid else f'{pid}: NOT LOADED, drawn as {drawn}'))
        rows = [cells[i:i + 8] for i in range(0, len(cells), 8)]
        strip(rows, h=420).save(os.path.join(OUT, f'pairings-{style}.jpg'), quality=85)
        print('wrote', f'shots/pairings-{style}.jpg' + (f': {missing} of {len(ids)} pairings NOT LOADED (drawn as the default)' if missing else ''))
    # text variants: one word, eight words, each slot alone
    for style in STYLES:
        cells = []
        for k, title in enumerate(['Signal', 'Eight plain words make a long poster title']):
            for fmt in FORMATS:
                spec = pg.evaluate('([s, f, t, k]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.text.title.v = t; x.seeds = {layout: 77 + k, colour: 88 + k, graphic: 99 + k, type: 5}; return x; }', [style, fmt, title, k])
                cells.append((img(pg, spec), f'{fmt} {len(title.split())} words'))
        strip([cells], h=480).save(os.path.join(OUT, f'text-{style}.jpg'), quality=85)
    print('wrote shots/text-*.jpg')
    # the spike's reference specs next to the approved refs
    rows, row = [], []
    for name, spec in ref_specs():
        ours = img(pg, spec)
        ours.save(os.path.join(OUT, f'ref-{name}.jpg'), quality=90)
        ref = os.path.join(REFS, name + '.jpg')
        pair = [(Image.open(ref).convert('RGB'), 'ref ' + name)] if os.path.exists(ref) else []
        row += pair + [(ours, 'now ' + name)]
        if len(row) >= 6:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    strip(rows, h=460).save(os.path.join(OUT, 'refs-compare.jpg'), quality=85)
    print('wrote shots/refs-compare.jpg')
    pg.close()
    # app screens (row R4): every tab and page and both sheets at both phone sizes, then each style and dark
    for old in [f for f in os.listdir(OUT) if f.startswith('screen-')]:
        os.remove(os.path.join(OUT, old))
    for (w, h) in [(360, 640), (412, 915)]:
        pg, _ = open_app(b, url, w, h, query='?s=' + __import__('urllib.parse').parse.quote(__import__('json').dumps(ref_specs()[1][1])))
        first = pg.evaluate('() => JSON.stringify(window.__rstr.spec())')
        for style in ['pomo', 'brutal']:   # two kept designs, so the Kept sheet shows thumbnails
            pg.evaluate('(s) => { const x = window.__rstr.spec(); x.style = s; window.__rstr.app.load(x); }', style)
            idle(pg)
            pg.click('[data-testid="keep"]')
        pg.evaluate('(s) => window.__rstr.app.load(JSON.parse(s))', first)
        idle(pg)
        pg.click('[data-testid="keep"]')
        for t in appcheck.TABS:
            pg.click(f'[data-tab="{t}"]')
            for i in range(appcheck.npages(pg)):
                appcheck.goto(pg, i)
                pg.wait_for_timeout(150)
                pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-{t}-{i + 1}.png'))
            appcheck.goto(pg, 0)
        # the Postmodern Look tab in Simple (review R6 M5), then every Advanced tab and page (R10) for a photocopy
        # design (the most Type and Graphic rows) and a Vaporwave one, marks and a finish on so their controls show
        cur = pg.evaluate('() => JSON.stringify(window.__rstr.spec())')
        pg.evaluate('(s) => { const x = JSON.parse(s); x.style = "pomo"; window.__rstr.app.load(x); }', cur)
        idle(pg)
        pg.click('[data-tab="look"]')
        for i in range(appcheck.npages(pg)):
            appcheck.goto(pg, i)
            pg.wait_for_timeout(150)
            pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-look-pomo-simple-{i + 1}.png'))
        appcheck.goto(pg, 0)
        pg.click('[data-tab="style"]')
        pg.click('[data-testid="advanced"]')
        for name, pk in [('pomo', '{"dialect": "photocopy"}'), ('vapor', '{"layout": "title-sky"}')]:
            pg.evaluate('([s, st, pk]) => { const x = JSON.parse(s); x.style = st; x.marks = "light"; x.finish = "grain"; x.pick = { ...x.pick, ...JSON.parse(pk) }; window.__rstr.app.load(x); }', [cur, name, pk])
            idle(pg)
            for t in appcheck.ADV_TABS:
                pg.click(f'[data-tab="{t}"]')
                for i in range(appcheck.npages(pg)):
                    appcheck.goto(pg, i)
                    pg.wait_for_timeout(150)
                    pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-adv-{name}-{t}-{i + 1}.png'))
                appcheck.goto(pg, 0)
        pg.click('[data-tab="style"]')
        pg.click('[data-testid="advanced"]')
        pg.evaluate('(s) => window.__rstr.app.load(JSON.parse(s))', cur)
        idle(pg)
        pg.click('[data-tab="style"]')
        for name in ['export', 'kept']:
            pg.click(f'[data-testid="{name}"]')
            pg.wait_for_timeout(250)
            pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-sheet-{name}.png'))
            pg.click('[data-testid="close"]')
        for style in STYLES:
            pg.click(f'button[data-style="{style}"]')
            idle(pg)
            pg.wait_for_timeout(150)
            pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-style-{style}.png'))
        pg.click('[data-tab="look"]')
        pg.click('button[data-mode="dark"]')
        idle(pg)
        pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-{STYLES[-1]}-dark.png'))
        pg.close()
    print('wrote shots/screen-*.png')
    if errors:
        print('page errors:', errors)
        sys.exit(1)
