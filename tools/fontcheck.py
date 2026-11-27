"""Font checks for npm run smoke (spec 6, row R3).

Online checks need fonts.googleapis.com and fonts.gstatic.com. When headless Chrome cannot reach them, each
online check prints SKIP with the check's name and nothing is claimed about Google Fonts.

The offline checks run against a stub font host: Playwright answers requests to the two Google hosts with a
css2-shaped stylesheet and bundled font files, inside the browser, without any network. They prove the app's
mechanism (fetch once, cache in the service worker, draw offline; the 4 s wait; the note), not that a family
exists on Google Fonts.
"""
import json, os, re, time, urllib.parse
from common import ROOT, idle, open_app

CSS_HOST = 'https://fonts.googleapis.com'
FILE_HOST = 'https://fonts.gstatic.com'
FONTS = os.path.join(ROOT, 'public', 'fonts')
STUB_FILES = {400: 'inter-tight-latin-400-normal.woff2', 500: 'inter-tight-latin-500-normal.woff2',
              700: 'inter-tight-latin-700-normal.woff2', 800: 'inter-tight-latin-800-normal.woff2'}


def spec_query(pg, style, pairing, fmt='3:4'):
    s = pg.evaluate('([st, p, f]) => { const x = window.__rstr.spec(); x.style = st; x.format = f; x.pick.pairing = p; x.seeds = {layout: 5, colour: 6, graphic: 7, type: 8}; return x; }', [style, pairing, fmt])
    return '?s=' + urllib.parse.quote(json.dumps(s))


class StubHost:
    """Answers the Google Fonts hosts from inside the browser: a css2-shaped stylesheet, bundled files."""

    def __init__(self):
        self.hits = []

    def css(self, route):
        url = route.request.url
        self.hits.append(url)
        q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)['family'][0]
        fam, spec = q.split(':')
        axes, tuples = spec.split('@')
        blocks = []
        names = axes.split(',')
        for t in tuples.split(';'):
            v = dict(zip(names, [int(x) for x in t.split(',')]))
            ital, w = v.get('ital', 0), v['wght']
            slug = re.sub(r'[^a-z0-9]', '', fam.lower())
            blocks.append(f"/* latin */\n@font-face {{\n  font-family: '{fam}';\n  font-style: {'italic' if ital else 'normal'};\n  font-weight: {w};\n"
                          f"  src: url({FILE_HOST}/stub/{slug}-{ital}-{w}.woff2) format('woff2');\n  unicode-range: U+0000-00FF;\n}}")
        route.fulfill(status=200, headers={'content-type': 'text/css', 'access-control-allow-origin': '*'}, body='\n'.join(blocks))

    def file(self, route):
        self.hits.append(route.request.url)
        w = int(route.request.url.rsplit('-', 1)[1].split('.')[0])
        with open(os.path.join(FONTS, STUB_FILES.get(w, STUB_FILES[400])), 'rb') as f:
            route.fulfill(status=200, headers={'content-type': 'font/woff2', 'access-control-allow-origin': '*'}, body=f.read())

    def attach(self, ctx):
        ctx.route(CSS_HOST + '/**', self.css)
        ctx.route(FILE_HOST + '/**', self.file)


def network_off(ctx, hits):
    """Font hosts unreachable: every request to them is aborted (the app server stays up)."""
    for h in (CSS_HOST, FILE_HOST):
        ctx.unroute(h + '/**')
        ctx.route(h + '/**', lambda r: (hits.append('aborted ' + r.request.url), r.abort('internetdisconnected')))


def drawn(pg):
    idle(pg)
    return pg.evaluate('() => window.__rstr.drawn()')


def note(pg):
    el = pg.query_selector('[data-testid="font-note"]')
    return el.inner_text() if el else ''


def online(pg):
    """Can headless Chrome fetch a stylesheet and a font file from Google Fonts? Returns (ok, reason)."""
    r = pg.evaluate('''async (u) => {
        try {
            const res = await fetch(u, {mode: 'cors', credentials: 'omit'});
            if (!res.ok) return [false, 'fonts.googleapis.com answered ' + res.status];
            const m = /url\\((https:\\/\\/fonts\\.gstatic\\.com[^)]+)\\)/.exec(await res.text());
            if (!m) return [false, 'no font file in the stylesheet'];
            const f = await fetch(m[1], {mode: 'cors', credentials: 'omit'});
            return f.ok ? [true, ''] : [false, 'fonts.gstatic.com answered ' + f.status];
        } catch (e) { return [false, String(e)]; }
    }''', CSS_HOST + '/css2?family=Inter:wght@400&display=block')
    return r[0], r[1]


def never_fallback(pg, fail):
    """Layout never runs with a fallback face: every face a Scene measured or drew is loaded (by face, not family)."""
    r = pg.evaluate('''() => {
        const api = window.__rstr, out = {count: 0, bad: [], drawnAsked: 0, drawnDefault: 0};
        for (const style of ['swiss', 'pomo', 'brutal', 'vapor']) {
            const ids = api.fonts.pairings(style);
            for (const id of [null, ...ids]) for (const format of ['1:1', '3:4', '9:16']) for (let i = 0; i < 3; i++) {
                const s = api.spec(); s.style = style; s.format = format; s.pick.pairing = id;
                s.seeds = {layout: 900 + i, colour: 910 + i, graphic: 920 + i, type: 930 + i * 7};
                const sc = api.scene(s), want = api.fonts.wanted(s);
                out.count++;
                const u = api.fonts.unloaded(sc);
                if (u.length) out.bad.push([JSON.stringify(s), u]);
                if (sc.pairing === want) out.drawnAsked++;
                else if (api.fonts.available(want)) out.bad.push([JSON.stringify(s), ['drew ' + sc.pairing + ' though ' + want + ' is loaded']]);
                else if (sc.pairing !== ids[0]) out.bad.push([JSON.stringify(s), ['drew ' + sc.pairing + ', not the default']]);
                else out.drawnDefault++;
            }
        }
        return out;
    }''')
    for spec, u in r['bad'][:5]:
        fail('fonts: a Scene used faces that are not loaded: ' + ', '.join(u))
        print('  spec:', spec)
    print(f'fonts: {r["count"]} Scenes, every measured and drawn face loaded; {r["drawnAsked"]} drawn with the pairing asked for, {r["drawnDefault"]} with the default (fonts not loaded)')


def offline_after_use(b, url, fail, stub=True):
    """Use a pairing once, cut the font hosts, reload: it still draws with its own fonts. Then an unused one."""
    ctx = b.new_context(service_workers='allow', viewport={'width': 412, 'height': 915})
    hits = []
    host = StubHost() if stub else None
    if host:
        host.attach(ctx)
    used, unused = ('sw-inter', 'sw-hanken')
    # Carried R10 (from R10), the cause of the flake: the app used to open on a fresh design with new seeds, and in
    # about one opening in eight its type seed picked sw-hanken itself, so the 'unused' pairing was fetched and cached
    # before the network went off and drew with its own fonts (reproduced: 5 of 40 isolated runs, drawn as sw-hanken
    # with no note and no font request). The app now opens on the used pairing's design, and the cache is checked
    # to hold nothing of the unused one before the hosts are cut.
    first = {'v': 2, 'style': 'swiss', 'format': '3:4', 'seeds': {'layout': 5, 'colour': 6, 'graphic': 7, 'type': 8}, 'pick': {'pairing': used}}
    pg, errors = open_app(b, url, ctx=ctx, query='?s=' + urllib.parse.quote(json.dumps(first)))
    pg.evaluate('() => navigator.serviceWorker.ready')
    pg.wait_for_function('() => !!navigator.serviceWorker.controller')
    q = spec_query(pg, 'swiss', used)
    pg.goto(url + q)
    pg.wait_for_function('window.__rstr !== undefined')
    d = drawn(pg)
    what = 'stub font host' if stub else 'Google Fonts'
    if d['pairing'] != used:
        fail(f'fonts ({what}): online, {used} drew as {d["pairing"]} (note: {d["note"]!r})')
    cached = pg.evaluate("async () => (await (await caches.open('rstr-fonts-v1')).keys()).map((r) => r.url)")
    if any('Hanken' in u for u in cached):
        fail(f'fonts ({what}): before the hosts were cut the cache already held the unused pairing {unused}: {[u for u in cached if "Hanken" in u][:2]}')
    network_off(ctx, hits)
    pg.goto(url + q)
    pg.wait_for_function('window.__rstr !== undefined')
    d = drawn(pg)
    if d['pairing'] != used or note(pg):
        fail(f'fonts ({what}): network off after one use, {used} drew as {d["pairing"]}, note {note(pg)!r}')
    sc = pg.evaluate('() => window.__rstr.scene(window.__rstr.spec())')
    if 'Inter' not in sc['fonts'] or sc['pairing'] != used:
        fail(f'fonts ({what}): offline Scene for {used} measured {sc["fonts"]}')
    if any('Inter:' in h or '/inter-' in h for h in hits):
        fail(f'fonts ({what}): offline, {used} went to the network: {hits[:3]}')
    print(f'fonts ({what}): {used} used once, then the font hosts cut: drawn with its own fonts from the service worker cache')
    t0 = time.time()
    pg.goto(url + spec_query(pg, 'swiss', unused))
    pg.wait_for_function('window.__rstr !== undefined')
    # Carried R10 (from R10): this check failed now and then with nothing changed. It read the stage after idle() and
    # then gave the note 5 s to appear: idle() returns once the stage has drawn, but the note is set by a render that
    # follows the draw, and idle() itself gives up after 15 s and returns whatever drew last. Now it waits for the one
    # state it checks, for up to 30 s: the stage has drawn this spec (the unused pick wanted) and the note shown is the
    # one that draw set; on a timeout it reads what is there and the failure says what it saw and how long it waited.
    state = '''() => {
        const a = window.__rstr, d = a.drawn(), el = document.querySelector('[data-testid="font-note"]');
        return { d, note: el ? el.textContent : '' };
    }'''
    ok = True
    try:
        pg.wait_for_function('(u) => { const a = window.__rstr, d = a.drawn(), el = document.querySelector(\'[data-testid="font-note"]\'); return !!d && d.wanted === u && !!el && el.textContent === d.note && d.note.length > 0; }', arg=unused, timeout=30000)
    except Exception:
        ok = False
    idle(pg)
    st = pg.evaluate(state)
    d, n = st['d'] or {}, st['note']
    spec = pg.evaluate('() => window.__rstr.spec()')
    if not ok or d.get('pairing') != 'sw-inter-tight' or d.get('wanted') != unused or 'Hanken' not in n or spec['pick']['pairing'] != unused:
        fail(f'fonts ({what}): network off, unused {unused}: drew {d}, note {n!r}, spec pick {spec["pick"]["pairing"]}, waited {time.time() - t0:.1f} s ({"state reached" if ok else "timed out"}), font requests {hits[-4:]}')
    else:
        print(f'fonts ({what}): network off, unused {unused} picked: drawn with the default, note shown ({n!r}), the spec keeps its pick')
    if errors:
        fail(f'fonts ({what}): page errors {errors[:3]}')
    ctx.close()


def wait_four_seconds(b, url, fail):
    """Font hosts that never answer: the stage waits about 4 s, then draws the default with the note."""
    ctx = b.new_context(viewport={'width': 412, 'height': 915})
    held = []
    for h in (CSS_HOST, FILE_HOST):
        ctx.route(h + '/**', lambda r: held.append(r))
    pg = ctx.new_page()
    probe = b.new_page()
    probe.goto(url)
    probe.wait_for_function('window.__rstr !== undefined')
    q = spec_query(probe, 'pomo', 'pm-syne-fraunces')
    probe.close()
    t0 = time.time()
    pg.goto(url + q)
    pg.wait_for_function('window.__rstr !== undefined')
    d = drawn(pg)
    dt = time.time() - t0
    n = note(pg)
    if d['pairing'] != 'pm-bricolage' or not n or not (3.8 <= dt <= 7):
        fail(f'fonts: hosts that hang: drew {d} after {dt:.1f} s, note {n!r} (want the default after about 4 s)')
    else:
        print(f'fonts: font hosts that never answer: the default drew after {dt:.1f} s with the note')
    for r in held:
        try:
            r.abort()
        except Exception:
            pass
    ctx.close()


def core_font_fails(b, url, fail):
    """A bundled font that fails to load: the stage still draws and the note names the face (review R1 M10)."""
    ctx = b.new_context(viewport={'width': 412, 'height': 915})
    ctx.route('**/fonts/anton-latin-400-normal.woff2', lambda r: r.abort())
    probe = b.new_page()
    probe.goto(url)
    probe.wait_for_function('window.__rstr !== undefined')
    q = spec_query(probe, 'brutal', 'br-archivo-black')
    probe.close()
    pg, errors = open_app(b, url, query=q, ctx=ctx)
    n = note(pg)
    if 'Anton' not in n:
        fail(f'fonts: core font Anton failed but the note says {n!r}')
    else:
        print(f'fonts: a bundled font that fails shows the note ({n!r})')
    ctx.close()


def offline_preference(b, url, fail):
    """Offline (navigator.onLine false, font hosts aborted): a style tap and Shuffle land on a pairing whose
    fonts are here, so no note shows (review R3 M2)."""
    ctx = b.new_context(viewport={'width': 412, 'height': 915})
    hits = []
    network_off(ctx, hits)
    pg, errors = open_app(b, url, ctx=ctx)
    ctx.set_offline(True)
    bad, taps = [], 0
    for rnd in range(3):
        for style in ['swiss', 'pomo', 'brutal', 'vapor']:
            for act, sel in [('style', f'button[data-style="{style}"]'), ('shuffle', '[data-testid="shuffle"]')]:
                pg.click(sel)
                d = drawn(pg)
                taps += 1
                if d['pairing'] != d['wanted'] or note(pg):
                    bad.append(f'{act} {style}: wanted {d["wanted"]}, drew {d["pairing"]}, note {note(pg)!r}')
    for x in bad[:5]:
        fail('fonts offline preference: ' + x)
    if not bad:
        print(f'fonts: offline, {taps} style taps and shuffles all landed on a loaded pairing, no note')
    if errors:
        fail(f'fonts offline preference: page errors {errors[:3]}')
    ctx.set_offline(False)
    ctx.close()


def online_pairings(pg, n, fail):
    """Online: every pairing's fonts load from Google Fonts, and every pairing passes 9.2 with them."""
    bad = []
    for style in ['swiss', 'pomo', 'brutal', 'vapor']:
        for pid in pg.evaluate('(s) => window.__rstr.fonts.pairings(s)', style):
            if not pg.evaluate('(id) => window.__rstr.fonts.ensure(id, 30000)', pid):
                bad.append(pid)
                fail(f'fonts online: {pid} did not load from Google Fonts')
    print(f'fonts online: every pairing loaded from Google Fonts' if not bad else f'fonts online: {len(bad)} pairings did not load: {bad}')
    for style in ['swiss', 'pomo', 'brutal', 'vapor']:
        for fmt in ['1:1', '3:4', '9:16']:
            r = pg.evaluate('(o) => window.__rstr.proof.invariants(o)', {'styles': [style], 'formats': [fmt], 'n': n, 'pairings': True})
            print(f'9.2 {style:6} {fmt:4}  every pairing, real fonts: {r["count"]} designs, {r["fallbacks"]} fallbacks, {len(r["failures"])} failing, pairings drawn {len(r["pairings"])}')
            for f in r['failures'][:5]:
                fail(f'9.2 pairing {style} {fmt}: ' + '; '.join(f'rule {x["rule"]} {x["part"]}: {x["msg"]}' for x in f['failures'][:4]))
                print('  spec:', json.dumps(f['spec'], ensure_ascii=False))
            want = len(pg.evaluate('(s) => window.__rstr.fonts.pairings(s)', style))
            if len(r['pairings']) != want:
                fail(f'9.2 pairing {style} {fmt}: only {r["pairings"]} drew with their own fonts')
    # 9.3 with the real fonts loaded: the type seed must change the pairing (and move text) somewhere,
    # else the independence run proved nothing about type (review R3 M5)
    for style in ['swiss', 'pomo', 'brutal', 'vapor']:
        r = pg.evaluate('(o) => window.__rstr.proof.independence(o)', {'styles': [style], 'n': max(20, n * 2), 'variants': 'cycle'})
        print(f'9.3 {style:6} real fonts: {r["count"]} designs, {len(r["failures"])} failing; the type seed moved text in {r["typeMoved"]}')
        for f in r['failures'][:5]:
            fail(f'9.3 real fonts {style}: {f["facet"]}', f['spec'])
        if r['typeMoved'] == 0:
            fail(f'9.3 real fonts {style}: the type seed never changed the pairing, so the type check proved nothing')


ONLINE_CHECKS = 3


def run(b, url, pg, n, fail):
    """Runs every font check. Returns the number of online checks skipped (0 when Google Fonts was reachable)."""
    never_fallback(pg, fail)
    ok, why = online(pg)
    skipped = 0
    if ok:
        online_pairings(pg, n, fail)
        offline_after_use(b, url, fail, stub=False)
    else:
        skipped = ONLINE_CHECKS
        print(f'SKIP online: Google Fonts not reachable from headless Chrome ({why}). Not verified:')
        print('SKIP   "every pairing of every style passes 9.2 with its real fonts loaded (tested, online)", and 9.3 with them')
        print('SKIP   "every family resolves from Google Fonts" (also tools/fetch_fonts.py --check)')
        print('SKIP   "with the network off after one use, a used pairing still draws with its own fonts" against Google itself; the stub-host run below covers the mechanism')
    offline_after_use(b, url, fail, stub=True)
    wait_four_seconds(b, url, fail)
    core_font_fails(b, url, fail)
    offline_preference(b, url, fail)
    return skipped
