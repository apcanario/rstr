"""npm run sheet: contact sheets and app screens to shots/. A person or a reviewer looks at them."""
import base64, io, os, sys
from PIL import Image, ImageDraw
from common import ROOT, browser, idle, open_app, served
from refs import ref_specs
import appcheck

OUT = os.path.join(ROOT, 'shots')
os.makedirs(OUT, exist_ok=True)
REFS = os.path.join(ROOT, 'docs', 'design', 'refs')
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
FORMATS = ['1:1', '3:4', '9:16']


def img(pg, spec):
    r = pg.evaluate('(s) => window.__rstr.exportImage(s, "image/jpeg")', spec)
    return Image.open(io.BytesIO(base64.b64decode(r['url'].split(',')[1]))).convert('RGB')


def strip(rows, h=560, gap=12, label_h=0):
    """rows: list of lists of (image, label)."""
    rows = [[(im.resize((int(im.width * h / im.height), h)), lab) for im, lab in row] for row in rows]
    W = max(sum(i.width + gap for i, _ in row) + gap for row in rows)
    H = len(rows) * (h + gap + 22) + gap
    sh = Image.new('RGB', (W, H), (34, 34, 38))
    d = ImageDraw.Draw(sh)
    y = gap
    for row in rows:
        x = gap
        for im, lab in row:
            sh.paste(im, (x, y))
            d.text((x, y + h + 4), lab, fill=(200, 200, 200))
            x += im.width + gap
        y += h + gap + 22
    return sh


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
    # per style: every palette, light above dark, one layout at 3:4, so the two forms can be compared
    for style in STYLES:
        ids = pg.evaluate('(s) => window.__rstr.palettes(s)', style)
        rows = []
        for mode in ['light', 'dark']:
            cells = []
            for pid in ids:
                spec = pg.evaluate('([s, p, md]) => { const x = window.__rstr.spec(); x.style = s; x.format = "3:4"; x.mode = md; x.seeds = {layout: 4242, colour: 1, graphic: 5151, type: 6}; x.pick = {palette: p, pairing: null, motif: null, layout: null}; return x; }', [style, pid, mode])
                cells.append((img(pg, spec), f'{pid} {mode}'))
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
            chips = len(pg.query_selector_all('[data-chip]'))
            for i in range(max(1, chips)):
                if chips:
                    pg.click(f'[data-chip="{i}"]')
                pg.wait_for_timeout(150)
                pg.screenshot(path=os.path.join(OUT, f'screen-{w}x{h}-{t}-{i + 1}.png'))
            if chips:
                pg.click('[data-chip="0"]')
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
