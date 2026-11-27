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
FORMATS = ['1:1', '3:4', '9:16', 'A']


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
                    fmt = FORMATS[n % len(FORMATS)]
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
                    n = si * len(FORMATS) + fi
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
                spec = pg.evaluate('([d, n, f]) => { const x = window.__rstr.spec(); x.style = "pomo"; x.format = f; x.mode = n % 4 === 3 ? "dark" : "light"; x.seeds = {layout: 5100 + n * 7919, colour: 5200 + n * 104729, graphic: 5300 + n * 1299709, type: 5400 + n * 31}; x.pick = {palette: null, pairing: null, motif: null, layout: null, dialect: d}; x.params = {}; return x; }', [d, n, FORMATS[n % len(FORMATS)]])
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
                spec = pg.evaluate('([s, f, t, k]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.text.find((l) => l.level === "headline").v = t; x.seeds = {layout: 77 + k, colour: 88 + k, graphic: 99 + k, type: 5}; return x; }', [style, fmt, title, k])
                cells.append((img(pg, spec), f'{fmt} {len(title.split())} words'))
        strip([cells], h=480).save(os.path.join(OUT, f'text-{style}.jpg'), quality=85)
    print('wrote shots/text-*.jpg')
    # row R17: text layers, 1 to 8 in a mix of levels (proof's layerMix), per style across the formats; a flagged layer
    # is named under its cell
    for style in STYLES:
        cells = []
        for i in [1, 3, 5, 7, 50, 52, 54, 55, 60, 63, 69, 71]:
            fmt = FORMATS[i % len(FORMATS)]
            spec = pg.evaluate('([s, f, i]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = i % 2 ? "dark" : "light"; x.text = window.__rstr.layerMix(i); x.seeds = {layout: 300 + i, colour: 400 + i, graphic: 500 + i, type: 6}; return x; }', [style, fmt, i])
            sc = pg.evaluate('(s) => window.__rstr.scene(s)', spec)
            fl = sc.get('flagged') or []
            cells.append((img(pg, spec), f'{fmt} {len(spec["text"])} layers' + (f', flagged {",".join(fl)}' if fl else '')))
        strip([cells[:6], cells[6:]], h=460).save(os.path.join(OUT, f'layers-{style}.jpg'), quality=85)
    print('wrote shots/layers-*.jpg')
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
    # row R14: the photo in every role (columns) under every style (rows), and unpinned shuffles, with the test photos
    for pid, w, h, sd in [('test-portrait', 3000, 4000, 7), ('test-landscape', 4000, 2600, 11)]:
        pg.evaluate('([i, w, h, s]) => window.__rstr.photo.test(i, w, h, s)', [pid, w, h, sd])
    PH = 'x.params = {}; x.finish = "clean"; x.marks = "off"; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null};'
    rows = []
    for si, style in enumerate(STYLES):
        cells = []
        for k, role in enumerate(['ground', 'box', 'disc', 'column', 'band']):
            n = si * 5 + k
            spec = pg.evaluate('([s, r, n]) => { const x = window.__rstr.spec(); ' + PH + ' x.style = s; x.format = ["1:1", "3:4", "9:16", "A"][n % 4]; x.mode = n % 2 ? "dark" : "light"; x.seeds = {layout: 8100 + n * 7919, colour: 8200 + n * 104729, graphic: 8300 + n * 1299709, type: 8400 + n * 31}; x.photo = {id: n % 2 ? "test-landscape" : "test-portrait", treatment: null, place: {role: r}}; return x; }', [style, role, n])
            sol = pg.evaluate('(s) => window.__rstr.solve(s)', spec)
            cells.append((img(pg, spec), f'{style} {spec["format"]} {spec["mode"]} {role} {sol["layout"]}'))
        rows.append(cells)
    strip(rows, h=520).save(os.path.join(OUT, 'photo-roles.jpg'), quality=85)
    print('wrote shots/photo-roles.jpg')
    # row R15: one photo in every treatment (columns) under every style (rows; Postmodern in both dialects), ground
    # and in the graphic box; then the finishes and the copier pass over a treated photo
    TR = ['colour', 'mono', 'duotone', 'halftone', 'threshold', 'posterise', 'dither']
    for role, fmt in (('ground', '3:4'), ('box', '1:1')):
        rows = []
        for si, (style, dia) in enumerate([('swiss', None), ('pomo', 'icecream'), ('pomo', 'photocopy'), ('brutal', None), ('vapor', None)]):
            cells = []
            for k, t in enumerate(TR):
                spec = pg.evaluate('([s, d, t, f, r, n]) => { const x = window.__rstr.spec(); ' + PH + ' x.pick.dialect = d; x.style = s; x.format = f; x.mode = n % 3 === 2 ? "dark" : "light"; x.seeds = {layout: 5100 + n * 7919, colour: 5200 + n * 31, graphic: 5300, type: 5400 + n}; x.photo = {id: "test-portrait", treatment: t, place: {role: r}}; return x; }', [style, dia, t, fmt, role, si])
                cells.append((img(pg, spec), f'{style}{" " + dia if dia else ""} {spec["mode"]} {t} {role}'))
            rows.append(cells)
        strip(rows, h=520).save(os.path.join(OUT, f'photo-treatments-{role}.jpg'), quality=85)
        print('wrote', f'shots/photo-treatments-{role}.jpg')
    rows = []
    for fin in ['clean', 'grain', 'grunge', 'vhs', 'glitch']:
        cells = []
        for k, (style, dia, t) in enumerate([('swiss', None, 'duotone'), ('pomo', 'photocopy', 'threshold'), ('pomo', 'icecream', 'posterise'), ('brutal', None, 'halftone'), ('vapor', None, 'dither')]):
            spec = pg.evaluate('([s, d, t, fin, n]) => { const x = window.__rstr.spec(); ' + PH + ' x.pick.dialect = d; x.finish = fin; x.style = s; x.format = "3:4"; x.mode = "light"; x.seeds = {layout: 4100 + n * 7919, colour: 4200 + n, graphic: 4300 + n, type: 4400 + n}; x.photo = {id: "test-landscape", treatment: t, place: {role: "ground"}}; return x; }', [style, dia, t, fin, k])
            cells.append((img(pg, spec), f'{style}{" " + dia if dia else ""} {t} {fin}'))
        rows.append(cells)
    strip(rows, h=520).save(os.path.join(OUT, 'photo-finishes.jpg'), quality=85)
    print('wrote shots/photo-finishes.jpg')
    for style in STYLES:
        rows = []
        for row in range(2):
            cells = []
            for i in range(6):
                n = row * 6 + i
                spec = pg.evaluate('([s, n]) => { const x = window.__rstr.spec(); ' + PH + ' x.style = s; x.format = ["1:1", "3:4", "9:16", "A"][n % 4]; x.mode = n % 4 === 3 ? "dark" : "light"; x.seeds = {layout: 9100 + n * 7919, colour: 9200 + n * 104729, graphic: 9300 + n * 1299709, type: 9400 + n * 31}; x.photo = {id: n % 2 ? "test-landscape" : "test-portrait", treatment: null, place: null}; return x; }', [style, n])
                sc = pg.evaluate('(s) => { const c = window.__rstr.scene(s); const g = c.items.find((i) => i.name === "photo"); return [c.frame, c.layout, g ? g.params.role : "none"].join(" "); }', spec)
                cells.append((img(pg, spec), f'{spec["format"]} {spec["mode"]} {sc}'))
            rows.append(cells)
        strip(rows).save(os.path.join(OUT, f'photo-{style}.jpg'), quality=85)
        print('wrote', f'shots/photo-{style}.jpg')
    # row R16: the A format in every style, light and dark (the paper ratio, 1 to root 2)
    rows = []
    for row, mode in enumerate(['light', 'dark']):
        cells = []
        for si, style in enumerate(STYLES):
            for j in range(2):
                n = si * 2 + j + row * 8
                spec = pg.evaluate('([s, n, md]) => { const x = window.__rstr.spec(); x.style = s; x.format = "A"; x.mode = md; x.seeds = {layout: 6100 + n * 7919, colour: 6200 + n * 104729, graphic: 6300 + n * 1299709, type: 6400 + n * 31}; x.pick = {palette: null, pairing: null, motif: null, layout: null, dialect: null}; x.params = {}; x.finish = "clean"; x.marks = n % 3 ? "off" : "light"; return x; }', [style, n, mode])
                sol = pg.evaluate('(s) => window.__rstr.solve(s)', spec)
                cells.append((img(pg, spec), f'A {style} {mode} {sol["layout"]}'))
        rows.append(cells)
    # review bundle 5 S2: a photo in A, on the ground and cut into a disc, in two treatments, light and dark
    cells = []
    for si, style in enumerate(STYLES):
        for j, (role, t) in enumerate([('ground', 'duotone'), ('disc', 'halftone')]):
            n = 16 + si * 2 + j
            spec = pg.evaluate('([s, n, r, t]) => { const x = window.__rstr.spec(); ' + PH + ' x.style = s; x.format = "A"; x.mode = n % 2 ? "dark" : "light"; x.seeds = {layout: 6100 + n * 7919, colour: 6200 + n * 104729, graphic: 6300 + n * 1299709, type: 6400 + n * 31}; x.photo = {id: n % 4 < 2 ? "test-portrait" : "test-landscape", treatment: t, place: {role: r}}; return x; }', [style, n, role, t])
            sol = pg.evaluate('(s) => window.__rstr.solve(s)', spec)
            cells.append((img(pg, spec), f'A {style} {spec["mode"]} photo {role} {t} {sol["layout"]}'))
    rows.append(cells)
    strip(rows).save(os.path.join(OUT, 'format-A.jpg'), quality=85)
    print('wrote shots/format-A.jpg')
    # row R16: export at size. Left: a 300 px corner of the 1x file, blown up three times; right: the same corner of
    # the 3x file at its own pixels (marks and grain drawn at 3x). Below: the A3 print with its bleed, scaled down,
    # the trim line drawn in on top (red), and its corner at full size
    def dataimg(u):
        return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB')
    pairs = []
    for i, (style, fin) in enumerate([('swiss', 'grain'), ('brutal', 'grunge'), ('vapor', 'vhs')]):
        spec = pg.evaluate('([s, f, i]) => { const x = window.__rstr.spec(); x.style = s; x.format = "3:4"; x.finish = f; x.marks = "full"; x.seeds = {layout: 71 + i, colour: 72 + i, graphic: 73 + i, type: 74 + i}; x.params = {}; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null}; return x; }', [style, fin, i])
        one = dataimg(pg.evaluate('(s) => window.__rstr.export.url(s, "1x", false, "png")', spec))
        three = dataimg(pg.evaluate('(s) => window.__rstr.export.url(s, "3x", false, "png")', spec))
        pairs.append([(one.crop((0, 0, 300, 300)).resize((900, 900), Image.NEAREST), f'{style} {fin} 1x, corner x3'), (three.crop((0, 0, 900, 900)), f'{style} {fin} 3x, the same corner')])
    strip(pairs, h=600).save(os.path.join(OUT, 'export-scale.jpg'), quality=88)
    print('wrote shots/export-scale.jpg')
    spec = pg.evaluate('() => { const x = window.__rstr.spec(); x.style = "vapor"; x.format = "A"; x.finish = "grain"; x.marks = "light"; x.seeds = {layout: 81, colour: 82, graphic: 83, type: 84}; x.params = {}; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: null}; return x; }')
    full = dataimg(pg.evaluate('(s) => window.__rstr.export.url(s, "print", true, "jpeg")', spec))
    small = full.resize((full.width // 4, full.height // 4))
    d = ImageDraw.Draw(small)
    d.rectangle((35 / 4, 35 / 4, (35 + 3508) / 4, (35 + 4961) / 4), outline=(255, 0, 0), width=1)
    corner = full.crop((0, 0, 700, 700))
    dc = ImageDraw.Draw(corner)
    dc.line((35, 35, 700, 35), fill=(255, 0, 0)); dc.line((35, 35, 35, 700), fill=(255, 0, 0))
    strip([[(small, f'A3 print + 3 mm bleed, {full.width} x {full.height}, scaled down; red: the trim'), (corner, 'its top-left corner at full size, bleed outside the red line')]], h=900).save(os.path.join(OUT, 'export-print.jpg'), quality=88)
    print('wrote shots/export-print.jpg')
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
        # the Text tab at eight layers with flagged rows and one row's edit controls open (review R17 M6): Simple and
        # Advanced, the page holding the first flagged row
        cur8 = pg.evaluate('() => JSON.stringify(window.__rstr.spec())')
        pg.evaluate('([s, t]) => { const x = JSON.parse(s); x.style = "brutal"; x.format = "A"; x.text = t; window.__rstr.app.load(x); }', [cur8, appcheck.EIGHT])
        idle(pg)
        for mode in ['simple', 'advanced']:
            if mode == 'advanced':
                pg.click('[data-tab="style"]')
                pg.click('[data-testid="advanced"]')
                idle(pg)
            pg.click('[data-tab="text"]')
            for i in range(appcheck.npages(pg)):
                appcheck.goto(pg, i)
                if pg.query_selector('[data-layer][data-flagged]'):
                    break
            pg.wait_for_timeout(150)
            pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-text8-{mode}.png'))
            lid = pg.evaluate('() => (document.querySelector("[data-layer][data-flagged]") || document.querySelector("[data-layer]")).dataset.layer')
            pg.click(f'[data-more="{lid}"]')
            idle(pg)
            pg.wait_for_timeout(150)
            pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-text8-{mode}-more.png'))
            pg.click(f'[data-done="{lid}"]')
            appcheck.goto(pg, 0)
        pg.click('[data-tab="style"]')
        pg.click('[data-testid="advanced"]')
        idle(pg)
        pg.evaluate('(s) => window.__rstr.app.load(JSON.parse(s))', cur8)
        idle(pg)
        # the Postmodern Look tab in Simple (review R6 M5), then every Advanced tab and page (R10) for a photocopy
        # design (the most Type and Graphic rows), a Vaporwave one, a Swiss and a Brutalist one, marks and a finish on so their controls show
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
        # each design as the app reaches it (review bundle 4 S3): the Swiss ref's picks, params and positions cleared,
        # as a tap on the style tile clears them, so every row shows what that style draws; every style
        for name, pk in [('swiss', '{}'), ('brutal', '{}'), ('pomo', '{"dialect": "photocopy"}'), ('vapor', '{"layout": "title-sky"}')]:
            pg.evaluate('([s, st, pk]) => { const x = JSON.parse(s); x.style = st; x.marks = "light"; x.finish = "grain"; x.params = {}; x.pick = { palette: null, pairing: null, motif: null, layout: null, dialect: null, colours: null, ...JSON.parse(pk) }; for (const k of Object.keys(x.text)) x.text[k].pos = null; window.__rstr.app.load(x); }', [cur, name, pk])
            idle(pg)
            for t in appcheck.ADV_TABS:
                # the Photo tab per style is taken with a photo on the design, below (review bundle 5 S3); one empty
                # state is kept, on the Swiss design
                if t == 'photo' and name != 'swiss':
                    continue
                pg.click(f'[data-tab="{t}"]')
                for i in range(appcheck.npages(pg)):
                    appcheck.goto(pg, i)
                    pg.wait_for_timeout(150)
                    pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-adv-{name}-{t}{"-empty" if t == "photo" else ""}-{i + 1}.png'))
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
            if name == 'export':
                # R16: Print with its bleed, and every format ticked at 3x
                if pg.get_attribute('button[data-fmt="A"]', 'aria-pressed') != 'true':
                    pg.click('button[data-fmt="A"]')
                pg.click('button[data-size="print"]')
                pg.click('button[data-bleed="3mm"]')
                pg.wait_for_timeout(250)
                pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-sheet-export-print.png'))
                pg.click('button[data-bleed="off"]')
                for f in FORMATS:
                    if pg.get_attribute(f'button[data-fmt="{f}"]', 'aria-pressed') != 'true':
                        pg.click(f'button[data-fmt="{f}"]')
                pg.click('button[data-size="3x"]')
                pg.wait_for_timeout(250)
                pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-sheet-export-all.png'))
                pg.click('button[data-size="1x"]')
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
        # row R14: the Photo tab with a photo on the design, Simple then Advanced
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            pg.click('[data-tab="photo"]')
            pg.set_input_files('[data-testid="photo-input"]', appcheck.test_jpegs(tmp)[0])
            pg.wait_for_function('() => !!window.__rstr.spec().photo', timeout=15000)
            idle(pg)
            pg.wait_for_timeout(150)
            pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-photo-simple.png'))
            pg.click('[data-testid="advanced"]')
            pg.click('[data-tab="photo"]')
            for i in range(appcheck.npages(pg)):
                appcheck.goto(pg, i)
                pg.wait_for_timeout(150)
                pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-adv-photo-{i + 1}.png'))
            appcheck.goto(pg, 0)
            # review bundle 5 S3: the Photo tab and the photo under every style, as the app reaches each design
            withp = pg.evaluate('() => JSON.stringify(window.__rstr.spec())')
            for name, pk in [('swiss', '{}'), ('brutal', '{}'), ('pomo', '{"dialect": "photocopy"}'), ('vapor', '{"layout": "title-sky"}')]:
                pg.evaluate('([s, st, pk]) => { const x = JSON.parse(s); x.style = st; x.marks = "light"; x.finish = "grain"; x.params = {}; x.pick = { palette: null, pairing: null, motif: null, layout: null, dialect: null, colours: null, ...JSON.parse(pk) }; for (const k of Object.keys(x.text)) x.text[k].pos = null; x.photo = { ...x.photo, treatment: null, place: null }; window.__rstr.app.load(x); }', [withp, name, pk])
                idle(pg)
                pg.wait_for_function('() => !!window.__rstr.spec().photo', timeout=15000)
                pg.click('[data-tab="photo"]')
                for i in range(appcheck.npages(pg)):
                    appcheck.goto(pg, i)
                    pg.wait_for_timeout(150)
                    pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-adv-{name}-photo-{i + 1}.png'))
                appcheck.goto(pg, 0)
            pg.click('[data-testid="advanced"]')
        pg.close()
    # review R16 S4: the export sheet just after a failure, and at its fullest (Print, bleed, a photo, a failed size), at 360 x 640
    probs = []
    appcheck.run_fullest(b, url, lambda m, *a: probs.append(m), shots=OUT)
    for m in probs:
        print('PROBLEM:', m)
    print('wrote shots/screen-*.png')
    if errors:
        print('page errors:', errors)
        sys.exit(1)
