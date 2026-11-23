"""The app frame and Simple mode in headless Chrome (spec 10.1, 10.2; row R4), at 360 x 640 and 412 x 915.

Each Done-when line of R4 that says "(tested)" is checked here through taps, as Pedro would use the app:
nothing scrolls, every control at least 48 px, no text on a control wraps or overflows (with the longest
palette, pairing and style names), a locked facet survives 50 shuffles, Back restores the previous design
exactly, export gives files of the right pixels for all three sizes, reload brings back the design, Back
steps and Kept.
"""
import json, time
from PIL import Image
from common import idle, open_app

SIZES = {'1:1': (1080, 1080), '3:4': (1080, 1440), '9:16': (1080, 1920)}
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
TABS = ['style', 'text', 'look']
FACETS = ['layout', 'colour', 'graphic', 'type']
PICK_OF = {'layout': 'layout', 'colour': 'palette', 'graphic': 'motif', 'type': 'pairing'}

# Every problem with the screen as it stands: scrolling, anything outside the viewport, controls under 48 px,
# text on a control that wraps or overflows.
LAYOUT_JS = r'''() => {
  const out = [];
  const name = (el) => (el.dataset && (el.dataset.testid || el.dataset.fit || el.dataset.style || el.dataset.tab || el.dataset.lock || el.dataset.format || el.dataset.chip)) || el.getAttribute('aria-label') || el.className || el.tagName;
  const de = document.documentElement;
  if (de.scrollHeight > de.clientHeight || de.scrollWidth > de.clientWidth) out.push(`page scrolls ${de.scrollWidth}x${de.scrollHeight} in ${de.clientWidth}x${de.clientHeight}`);
  if (document.body.scrollHeight > document.body.clientHeight + 1) out.push('body scrolls');
  const all = [...document.querySelectorAll('.app *')];
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  for (const el of all) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) out.push('scrolls inside: ' + name(el));
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.left < -0.5) out.push(`outside the screen: ${name(el)} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
  }
  for (const el of document.querySelectorAll('.app button, .app input, .app textarea')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) out.push(`control under 48 px: ${name(el)} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    if (el.tagName === 'BUTTON' && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) out.push('button content overflows: ' + name(el));
  }
  for (const el of document.querySelectorAll('.app [data-fit]')) {
    if (!shown(el)) continue;
    const t = el.textContent;
    if (!t.trim() && el.dataset.fit.trim()) out.push('label empty: ' + el.dataset.fit);
    if (el.scrollWidth > el.clientWidth + 0.5) out.push(`text overflows: "${t}" ${el.scrollWidth} > ${el.clientWidth}`);
    const rg = document.createRange(); rg.selectNodeContents(el);
    const tops = new Set([...rg.getClientRects()].map((q) => Math.round(q.top)));
    if (tops.size > 1) out.push(`text wraps: "${t}"`);
    const lr = rg.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (lr.width && (lr.left < er.left - 0.5 || lr.right > er.right + 0.5)) out.push(`text leaves its label: "${t}"`);
    const host = el.closest('button, .sheet, .panel, header');
    if (host) { const h = host.getBoundingClientRect(); if (lr.width && (lr.left < h.left - 0.5 || lr.right > h.right + 0.5 || lr.top < h.top - 0.5 || lr.bottom > h.bottom + 0.5)) out.push(`text leaves its control: "${t}"`); }
    if (t !== el.dataset.fit && !t.endsWith('…')) out.push(`label text is not its own: "${t}" for "${el.dataset.fit}"`);
  }
  return out;
}'''


def spec(pg):
    return pg.evaluate('() => window.__rstr.spec()')


def tap(pg, sel, expect_change=True):
    """Tap a control; when the design should change, wait until the app holds the new design and has drawn it."""
    before = pg.evaluate('() => JSON.stringify(window.__rstr.spec())')
    pg.click(sel)
    if expect_change:
        try:
            pg.wait_for_function('(p) => JSON.stringify(window.__rstr.spec()) !== p', arg=before, timeout=5000)
        except Exception:
            idle(pg)
            return False
    idle(pg)
    return True


def views(pg):
    """Every tab and page, then every sheet: yields a label for each screen as it is shown."""
    for t in TABS:
        pg.click(f'[data-tab="{t}"]')
        chips = pg.query_selector_all('[data-chip]')
        for i in range(max(1, len(chips))):
            if chips:
                pg.click(f'[data-chip="{i}"]')
            yield f'{t} page {i + 1}'
        if chips:
            pg.click('[data-chip="0"]')
    pg.click('[data-tab="style"]')
    for name in ['export', 'kept']:
        pg.click(f'[data-testid="{name}"]')
        pg.wait_for_selector(f'[data-testid="{name}-sheet"]')
        yield f'{name} sheet'
        pg.click('[data-testid="close"]')


def check_layout(pg, where, fail):
    n = 0
    for v in views(pg):
        pg.evaluate('() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
        for p in pg.evaluate(LAYOUT_JS)[:6]:
            fail(f'{where}, {v}: {p}')
        n += 1
    return n


def longest(pg, style):
    names = pg.evaluate('(s) => window.__rstr.names(s)', style)
    pal = max(names['palettes'], key=lambda p: len(p['name']))
    par = max(names['pairings'], key=lambda p: len(p['name']))
    return pal, par


def run(b, url, fail):
    for (w, h) in [(360, 640), (412, 915)]:
        at = f'app {w}x{h}'
        pg, errors = open_app(b, url, w, h)
        downloads = []
        pg.on('download', lambda d: downloads.append(d))

        # nothing scrolls, controls at least 48 px, no text wraps or overflows: every tab, page and sheet,
        # first with the design as it opens, then for each style with its longest palette and pairing names
        # picked, in both modes, with a few kept designs so the Kept sheet has thumbnails
        pg.click('[data-testid="keep"]')
        tap(pg, '[data-testid="shuffle"]')
        pg.click('[data-testid="keep"]')
        n = check_layout(pg, at, fail)
        for style in STYLES:
            pal, par = longest(pg, style)
            for mode in ['light', 'dark']:
                pg.evaluate('([st, pa, pr, md]) => { const x = window.__rstr.spec(); x.style = st; x.mode = md; x.pick.palette = pa; x.pick.pairing = pr; window.__rstr.app.load(x); }', [style, pal['id'], par['id'], mode])
                idle(pg)
                shown = pg.evaluate('() => [...document.querySelectorAll(".lock .val")].map((e) => e.dataset.fit)')
                if pal['name'] not in shown or par['name'] not in shown:
                    fail(f'{at}: the locks do not show {pal["name"]!r} and {par["name"]!r}: {shown}')
                n += check_layout(pg, f'{at} {style} {mode} ({pal["name"]}, {par["name"]})', fail)
        print(f'{at}: {n} screens checked: no scroll, controls at least 48 px, no text wraps or overflows (longest palette, pairing and style names)')

        # Style tiles, format, Light/Dark on the Look tab, finish, marks, rerolls, text switches
        pg.click('[data-tab="style"]')
        for style in STYLES:
            if spec(pg)['style'] != style:
                tap(pg, f'button[data-style="{style}"]')
            s = spec(pg)
            if s['style'] != style or pg.get_attribute(f'button[data-style="{style}"]', 'aria-pressed') != 'true':
                fail(f'{at}: the {style} tile did not apply')
            blank = pg.evaluate('() => [...document.querySelectorAll(".tile canvas")].filter((c) => c.width < 8).length')
            if blank:
                fail(f'{at}: {blank} style tiles have no live render')
            for fmt in ['1:1', '3:4', '9:16']:
                if spec(pg)['format'] != fmt:
                    tap(pg, f'button[data-format="{fmt}"]')
                cw, ch = pg.evaluate('() => { const c = document.querySelector("[data-testid=stage]"); return [c.width, c.height]; }')
                if (cw, ch) != SIZES[fmt] or spec(pg)['format'] != fmt:
                    fail(f'{at}: format {fmt} not applied, stage {cw}x{ch}')
                f = pg.evaluate('(s) => window.__rstr.check(s)', spec(pg))
                if f:
                    fail(f'{at} {style} {fmt}: {f[:3]}', )
        pg.click('[data-tab="look"]')
        for mode in (['light', 'dark'] if spec(pg)['mode'] == 'dark' else ['dark', 'light']):
            before = spec(pg)
            tap(pg, f'button[data-mode="{mode}"]')
            after = spec(pg)
            if after['mode'] != mode or {**after, 'mode': 0} != {**before, 'mode': 0}:
                fail(f'{at}: Light/Dark on the Look tab did not change only the mode')
        if pg.query_selector('header [data-mode], header [data-testid="mode"]'):
            fail(f'{at}: a Light/Dark control is still in the header')
        tap(pg, 'button[data-finish="grain"]')
        if spec(pg)['finish'] != 'grain':
            fail(f'{at}: Finish not applied')
        tap(pg, 'button[data-finish="clean"]')
        pg.click('[data-chip="1"]')
        tap(pg, 'button[data-marks="light"]')
        if spec(pg)['marks'] != 'light':
            fail(f'{at}: Marks not applied')
        tap(pg, 'button[data-marks="off"]')
        for f in FACETS:
            before = spec(pg)
            tap(pg, f'button[data-reroll="{f}"]')
            after = spec(pg)
            if after['seeds'][f] == before['seeds'][f] or any(after['seeds'][g] != before['seeds'][g] for g in FACETS if g != f):
                fail(f'{at}: New {f} did not change only the {f} seed')
        pg.click('[data-chip="0"]')
        pg.click('[data-tab="text"]')
        before = spec(pg)
        tap(pg, 'button[data-slot="title"]')
        if spec(pg)['text']['title']['on'] == before['text']['title']['on']:
            fail(f'{at}: the title switch did nothing')
        tap(pg, 'button[data-slot="title"]')
        pg.fill('[data-field="title"]', 'Typed title')
        idle(pg)
        if spec(pg)['text']['title']['v'] != 'Typed title':
            fail(f'{at}: typing the title did not reach the design')
        pg.click('[data-tab="style"]')

        # a locked facet survives 50 shuffles: its seed, its pick and what it draws; the other facets change
        for f in FACETS:
            s = spec(pg)
            names = pg.evaluate('(st) => window.__rstr.names(st)', s['style'])
            if f == 'colour':
                s['pick']['palette'] = names['palettes'][-1]['id']
            if f == 'type':
                s['pick']['pairing'] = names['pairings'][0]['id']
            pg.evaluate('(x) => window.__rstr.app.load(x)', s)
            idle(pg)
            pg.click(f'button[data-lock="{f}"]')
            if pg.get_attribute(f'button[data-lock="{f}"]', 'aria-pressed') != 'true':
                fail(f'{at}: the {f} lock does not show as locked')
            first = spec(pg)
            sc0 = pg.evaluate('(x) => window.__rstr.scene(x)', first)
            moved = set()
            for i in range(50):
                prev = spec(pg)
                tap(pg, '[data-testid="shuffle"]')
                now = spec(pg)
                if now['seeds'][f] != first['seeds'][f] or now['pick'][PICK_OF[f]] != first['pick'][PICK_OF[f]]:
                    fail(f'{at}: {f} locked, shuffle {i + 1} changed it', now)
                    break
                sc = pg.evaluate('(x) => window.__rstr.scene(x)', now)
                if f == 'colour' and sc['palette'] != sc0['palette']:
                    fail(f'{at}: colour locked, shuffle {i + 1} drew palette {sc["palette"]} not {sc0["palette"]}', now)
                    break
                if f == 'type' and pg.evaluate('(x) => window.__rstr.fonts.wanted(x)', now) != pg.evaluate('(x) => window.__rstr.fonts.wanted(x)', first):
                    fail(f'{at}: type locked, shuffle {i + 1} asked for another pairing', now)
                    break
                moved |= {g for g in FACETS if now['seeds'][g] != prev['seeds'][g]}
            if moved != set(FACETS) - {f}:
                fail(f'{at}: with {f} locked, 50 shuffles changed only {sorted(moved)}')
            pg.click(f'button[data-lock="{f}"]')
        print(f'{at}: each facet locked survived 50 shuffles')

        # Back restores the previous design exactly: the spec and the stage's pixels, step by step
        steps = [
            ('[data-testid="shuffle"]', None), ('button[data-style="pomo"]', None), ('button[data-format="3:4"]', None),
            ('[data-tab="look"]', 'mode'), (None, 'button[data-finish="grain"]'),
            ('[data-tab="text"]', 'type'), (None, 'button[data-slot="subtitle"]'), ('[data-tab="style"]', 'button[data-style="vapor"]'),
            (None, '[data-testid="shuffle"]'), (None, 'button[data-format="1:1"]'), ('[data-tab="look"]', 'button[data-reroll-page]'),
            ('[data-tab="style"]', '[data-testid="shuffle"]'),
        ]
        hist = []
        for pre, act in steps:
            if pre and act:
                pg.click(pre)
            sel = act or pre
            hist.append((json.dumps(spec(pg), sort_keys=True), pg.evaluate('() => window.__rstr.app.stage()')))
            if sel == 'mode':
                sel = f'button[data-mode="{"light" if spec(pg)["mode"] == "dark" else "dark"}"]'
            if sel == 'type':
                pg.click('[data-field="subtitle"]')
                pg.keyboard.press('End')
                pg.keyboard.type(' xyz')
                idle(pg)
            elif sel == 'button[data-reroll-page]':
                pg.click('[data-chip="1"]')
                tap(pg, 'button[data-reroll="colour"]')
                pg.click('[data-chip="0"]')
            else:
                tap(pg, sel)
            if json.dumps(spec(pg), sort_keys=True) == hist[-1][0]:
                fail(f'{at}: Back test step {sel} did not change the design')
        pg.click('[data-tab="style"]')
        nb = len(pg.evaluate('() => window.__rstr.app.state().back'))
        for i in range(len(steps)):
            pg.click('[data-testid="back"]')
            idle(pg)
            want_spec, want_px = hist.pop()
            got = json.dumps(spec(pg), sort_keys=True)
            if got != want_spec:
                fail(f'{at}: Back {i + 1} did not restore the design: got {got}, want {want_spec}')
                break
            px = pg.evaluate('() => window.__rstr.app.stage()')
            if px != want_px:
                fail(f'{at}: Back {i + 1} restored the spec but the stage drew different pixels')
                break
        if len(pg.evaluate('() => window.__rstr.app.state().back')) != nb - len(steps):
            fail(f'{at}: Back did not take exactly one step per tap')
        print(f'{at}: Back restored {len(steps)} designs exactly (spec and stage pixels), typing in a field is one step')

        # export: all three sizes, JPEG and PNG, files of exactly the format's pixels, named rstr-<seed>-<format>
        pg.click('[data-testid="export"]')
        pg.wait_for_selector('[data-testid="export-sheet"]')
        for f in SIZES:
            if pg.get_attribute(f'button[data-size="{f}"]', 'aria-pressed') != 'true':
                pg.click(f'button[data-size="{f}"]')
        label = pg.inner_text('[data-testid="save"]').strip().lower()
        if '3 files' not in label:
            fail(f'{at}: the Save button says {label!r} with three sizes chosen')
        cur = spec(pg)
        for kind, fmt_name in [('jpeg', 'JPEG'), ('png', 'PNG')]:
            pg.click(f'button[data-kind="{kind}"]')
            downloads.clear()
            pg.click('[data-testid="save"]')
            t0 = time.time()
            while len(downloads) < 3 and time.time() - t0 < 30:
                pg.wait_for_timeout(100)
            if len(downloads) != 3:
                fail(f'{at}: Save {kind} gave {len(downloads)} files, not 3')
                continue
            got = {}
            for d in downloads:
                im = Image.open(d.path())
                got[d.suggested_filename] = (im.format, im.size)
            for f, px in SIZES.items():
                name = pg.evaluate('([s, f, k]) => window.__rstr.app.fileName(s, f, k)', [cur, f, kind])
                if not name.startswith('rstr-') or got.get(name) != (fmt_name, px):
                    fail(f'{at}: export {kind} {f}: want {name} {fmt_name} {px}, got {got}')
        share = pg.query_selector('[data-testid="share"]')
        can = pg.evaluate('() => typeof navigator.canShare === "function" && (() => { try { return navigator.canShare({files: [new File([new Blob(["x"])], "x.jpg", {type: "image/jpeg"})]}); } catch (e) { return false; } })()')
        if bool(share) != bool(can):
            fail(f'{at}: Share shown {bool(share)} but the browser can share files {can}')
        pg.click('[data-testid="close"]')
        print(f'{at}: export gave 1080 x 1080, 1080 x 1440 and 1080 x 1920 files in JPEG and PNG')

        # reload brings back the design, Back steps, Kept, locks and the Simple/Advanced switch
        tap(pg, '[data-testid="shuffle"]')
        pg.click('[data-testid="keep"]')
        tap(pg, '[data-testid="shuffle"]')
        pg.click('button[data-lock="graphic"]')
        pg.click('[data-testid="advanced"]')
        idle(pg)
        st = pg.evaluate('() => window.__rstr.app.state()')
        if len(st['kept']) < 3 or len(st['back']) < 3:
            fail(f'{at}: before reload, {len(st["kept"])} kept and {len(st["back"])} Back steps; the test needs more')
        pg.reload()
        pg.wait_for_function('window.__rstr !== undefined')
        pg.evaluate('() => window.__rstr.ready')
        idle(pg)
        st2 = pg.evaluate('() => window.__rstr.app.state()')
        for k in ['spec', 'back', 'kept', 'locks']:
            if json.dumps(st2[k], sort_keys=True) != json.dumps(st[k], sort_keys=True):
                fail(f'{at}: reload did not bring back {k}')
        if pg.get_attribute('[data-testid="advanced"]', 'aria-pressed') != 'true':
            fail(f'{at}: reload did not bring back Advanced')
        if len(pg.query_selector_all('[data-tab]')) != 3:
            fail(f'{at}: Advanced should show Simple\'s three tabs until R10')
        if pg.evaluate('() => window.__rstr.app.stage()') == '':
            fail(f'{at}: after reload the stage is empty')
        pg.click('[data-testid="back"]')
        idle(pg)
        if json.dumps(spec(pg), sort_keys=True) != json.dumps(st['back'][-1], sort_keys=True):
            fail(f'{at}: after reload, Back did not restore the step before')
        pg.click('[data-testid="advanced"]')
        pg.click('button[data-lock="graphic"]')
        print(f'{at}: reload brought back the design, {len(st["back"])} Back steps, {len(st["kept"])} kept, the locks and Advanced')

        # Kept: tap opens a design, hold deletes it
        kept = pg.evaluate('() => window.__rstr.app.state().kept')
        pg.click('[data-testid="kept"]')
        pg.wait_for_selector('[data-testid="kept-sheet"]')
        cells = pg.query_selector_all('[data-kept]')
        if len(cells) != min(6, len(kept)):
            fail(f'{at}: Kept shows {len(cells)} of {len(kept)}')
        pg.wait_for_timeout(200)
        if pg.evaluate('() => [...document.querySelectorAll("[data-kept] canvas")].filter((c) => c.width < 8).length'):
            fail(f'{at}: a Kept thumbnail is blank')
        pg.click('[data-kept="1"]')
        idle(pg)
        if json.dumps(spec(pg), sort_keys=True) != json.dumps(kept[1], sort_keys=True) or pg.query_selector('[data-testid="kept-sheet"]'):
            fail(f'{at}: tapping a kept design did not open it')
        pg.click('[data-testid="kept"]')
        box = pg.query_selector('[data-kept="0"]').bounding_box()
        pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        pg.mouse.down()
        pg.wait_for_timeout(900)
        pg.mouse.up()
        pg.wait_for_timeout(100)
        k2 = pg.evaluate('() => window.__rstr.app.state().kept')
        if len(k2) != len(kept) - 1 or json.dumps(k2, sort_keys=True) != json.dumps(kept[1:], sort_keys=True):
            fail(f'{at}: holding a kept design did not delete it ({len(kept)} -> {len(k2)})')
        if pg.query_selector('[data-testid="kept-sheet"]') is None:
            fail(f'{at}: holding a kept design opened it')
        pg.click('[data-testid="close"]')
        print(f'{at}: Kept: tap opened a design, hold deleted one')

        if errors:
            fail(f'{at}: page errors {errors[:3]}')
        pg.close()
