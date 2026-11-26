"""The app frame and Simple mode in headless Chrome (spec 10.1, 10.2; row R4), at 360 x 640 and 412 x 915.

Each Done-when line of R4 that says "(tested)" is checked here through taps, as Pedro would use the app:
nothing scrolls, every control at least 48 px, no text on a control wraps or overflows (with the longest
palette, pairing and style names), a locked facet survives 50 shuffles, Back restores the previous design
exactly, export gives files of the right pixels for all three sizes, reload brings back the design, Back
steps and Kept.
"""
import json, time, urllib.parse
from PIL import Image
from common import idle, open_app

SIZES = {'1:1': (1080, 1080), '3:4': (1080, 1440), '9:16': (1080, 1920)}
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
TABS = ['style', 'text', 'look', 'photo']
# Advanced's tabs (spec 10.3, R10; Photo with R14)
ADV_TABS = ['style', 'layout', 'graphic', 'type', 'colour', 'text', 'photo']
FACETS = ['layout', 'colour', 'graphic', 'type']
PICK_OF = {'layout': 'layout', 'colour': 'palette', 'graphic': 'motif', 'type': 'pairing'}

# Every problem with the screen as it stands: scrolling, anything outside the viewport, anything outside the
# frame part or sheet that holds it, frame parts that overlap, controls under 48 px, text on a control that
# wraps or overflows or is shortened to almost nothing.
LAYOUT_JS = r'''() => {
  const out = [];
  const name = (el) => (el.dataset && (el.dataset.testid || el.dataset.fit || el.dataset.style || el.dataset.tab || el.dataset.lock || el.dataset.format || el.dataset.chip || el.dataset.reroll || el.dataset.dialect || el.dataset.ctl || el.dataset.ctlNext || el.dataset.colour)) || el.getAttribute('aria-label') || el.className || el.tagName;
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
  // the panel, locks, action row, header and sheets hold their contents: a fixed-height box spilling into its
  // neighbour is neither scrolling nor off screen (review R4 S7)
  for (const box of document.querySelectorAll('.app > .panel, .app > .locks, .app > .actions, .app > header, .app > .sheet')) {
    if (!shown(box)) continue;
    const b = box.getBoundingClientRect();
    for (const el of box.querySelectorAll('*')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < b.left - 0.5 || r.right > b.right + 0.5 || r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5) out.push(`spills out of ${box.className || box.tagName}: ${name(el)}`);
    }
  }
  // the seven parts of the frame (spec 10.1) do not overlap one another
  const parts = [['header', '.app > header'], ['stage', '.app > .stage'], ['format', '.app > .seg'], ['locks', '.app > .locks'], ['panel', '.app > .panel'], ['actions', '.app > .actions'], ['tabs', '.app > .tabs']]
    .map(([n, q]) => [n, document.querySelector(q)]);
  for (const [n, el] of parts) if (!el || !shown(el)) out.push('frame part missing: ' + n);
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const [na, a] = parts[i], [nb, c] = parts[j];
    if (!a || !c) continue;
    const p = a.getBoundingClientRect(), q = c.getBoundingClientRect();
    if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0.5 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0.5) out.push(`frame parts overlap: ${na} and ${nb}`);
  }
  for (const el of document.querySelectorAll('.app button, .app input, .app textarea')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) out.push(`control under 48 px: ${name(el)} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    if (el.tagName === 'BUTTON' && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) out.push('button content overflows: ' + name(el));
  }
  // every shown button can be tapped at its centre and lies inside the row that holds it (review R6 E2): a control
  // covered by a sibling or cut by its row is inside the panel's outer box, so the checks above miss it
  for (const el of document.querySelectorAll('.app button')) {
    const sh = document.querySelector('.app > .sheet');
    if (!shown(el) || (sh && shown(sh) && !sh.contains(el))) continue;
    const r = el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === el || el.contains(hit))) out.push(`control covered at its centre: ${name(el)} under ${hit ? name(hit) : 'nothing'}`);
    const row = el.parentElement && el.parentElement.closest('.seg, .rows > *, .slot, .captioned, .swatches, .chips, .tiles, .locks, .actions, .tabs, header');
    if (row && row !== el) {
      const q = row.getBoundingClientRect();
      if (r.left < q.left - 0.5 || r.right > q.right + 0.5 || r.top < q.top - 0.5 || r.bottom > q.bottom + 0.5) out.push(`control cut by its row: ${name(el)} in ${row.className || row.tagName}`);
    }
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
    if (t !== el.dataset.fit && t.slice(0, -1).trimEnd().length < Math.min(4, el.dataset.fit.length)) out.push(`label shortened to almost nothing: "${t}" for "${el.dataset.fit}"`);
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


def npages(pg):
    """How many pages the panel's tab has: two chips, or a stepper that says how many (review R6 E2)."""
    chips = len(pg.query_selector_all('[data-chip]'))
    if chips:
        return chips
    st = pg.query_selector('[data-step]')
    return int(st.get_attribute('data-pages')) if st else 1


def goto(pg, i):
    """Show page i of the panel: tap its chip, or the stepper until it is shown."""
    if pg.query_selector(f'[data-chip="{i}"]'):
        pg.click(f'[data-chip="{i}"]')
        return
    for _ in range(8):
        st = pg.query_selector('[data-step]')
        if not st or int(st.get_attribute('data-step')) == i:
            return
        pg.click('[data-step]')


def views(pg, tabs=None):
    """Every tab and page, then every sheet: yields a label for each screen as it is shown."""
    for t in tabs or TABS:
        pg.click(f'[data-tab="{t}"]')
        for i in range(npages(pg)):
            goto(pg, i)
            yield f'{t} page {i + 1}'
        goto(pg, 0)
    pg.click('[data-tab="style"]')
    for name in ['export', 'kept']:
        pg.click(f'[data-testid="{name}"]')
        pg.wait_for_selector(f'[data-testid="{name}-sheet"]')
        yield f'{name} sheet'
        pg.click('[data-testid="close"]')


def check_layout(pg, where, fail, tabs=None):
    n = 0
    for v in views(pg, tabs):
        pg.evaluate('() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
        for p in pg.evaluate(LAYOUT_JS)[:6]:
            fail(f'{where}, {v}: {p}')
        n += 1
    return n


# What the Type lock shows of a pairing: its display family (review R4 M6).
def shown_pairing(name):
    return name.split(' / ')[0]


# Rendered width of a lock value in DM Sans 11 px (the lock's own font), not character count (review R4 M1).
WIDTH_JS = '''(ts) => { const c = document.createElement('canvas').getContext('2d'); c.font = '11px "DM Sans"'; return ts.map((t) => c.measureText(t).width); }'''


def longest(pg, style):
    """The palette and pairing of a style whose names on the locks are the widest."""
    names = pg.evaluate('(s) => window.__rstr.names(s)', style)
    pw = pg.evaluate(WIDTH_JS, [p['name'] for p in names['palettes']])
    rw = pg.evaluate(WIDTH_JS, [shown_pairing(p['name']) for p in names['pairings']])
    pal = names['palettes'][pw.index(max(pw))]
    par = names['pairings'][rw.index(max(rw))]
    return pal, par


FRAME_JS = '() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'


def shown_ids(pg, tab, tunes=1):
    """Every control id drawn on an Advanced tab, over all its pages (on the Graphic tab, for each graphic Tune steps to)."""
    pg.click(f'[data-tab="{tab}"]')
    ids = set()
    for _ in range(max(1, tunes)):
        for i in range(npages(pg)):
            goto(pg, i)
            ids |= set(pg.evaluate('() => [...document.querySelectorAll("[data-ctl], [data-ctl-next], [data-row]")].map((e) => e.dataset.ctl || e.dataset.ctlNext || e.dataset.row)'))
        goto(pg, 0)
        if tunes > 1 and find(pg, tab, '[data-tune-next]'):
            pg.click('[data-tune-next]')
            goto(pg, 0)
    return ids


def set_range(pg, cid, v):
    """Move a range control as a thumb would: its value, then an input event."""
    pg.evaluate('([id, v]) => { const el = document.querySelector(`input[data-ctl="${id}"]`); el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); }', [cid, v])
    idle(pg)


def find(pg, tab, sel):
    """Show the page of a tab that holds sel; False if no page does."""
    pg.click(f'[data-tab="{tab}"]')
    for i in range(npages(pg)):
        goto(pg, i)
        if pg.query_selector(sel):
            return True
    goto(pg, 0)
    return False


def run_advanced(pg, at, fail):
    """Advanced (spec 10.3, row R10): six tabs; every control the parts list for the design is drawn; nothing scrolls,
    wraps or is under 48 px on any page of any tab, in every style and both modes; each kind of control writes its value
    to the spec and the stage draws it; the colour edit survives Shuffle with Colour locked and goes without."""
    pg.click('[data-tab="style"]')
    pg.click('[data-testid="advanced"]')
    s0 = spec(pg)
    n = 0
    designs = [('swiss', {}), ('pomo', {'dialect': 'icecream'}), ('pomo', {'dialect': 'photocopy'}), ('brutal', {}), ('vapor', {'layout': 'title-sky'}), ('vapor', {'layout': 'windows'})]
    for style, pk in designs:
        pal, par = longest(pg, style)
        for mode in ['light', 'dark']:
            pg.evaluate('([st, md, pk, pa, pr]) => { const x = window.__rstr.spec(); x.style = st; x.mode = md; x.marks = "light"; x.finish = "grain"; x.pick = { ...x.pick, palette: pa, pairing: pr, motif: null, layout: null, dialect: null, colours: null, ...pk }; window.__rstr.app.load(x); }', [style, mode, pk, pal['id'], par['id']])
            idle(pg)
            where = f'{at} Advanced {style} {pk} {mode}'
            n += check_layout(pg, where, fail, ADV_TABS)
            # every generated control is on its tab (the Graphic tab's parameters through Tune), and nothing else
            adv = pg.evaluate('(x) => window.__rstr.advanced(x)', spec(pg))
            gnames = len({c['id'].split('.')[1] for c in adv['tabs']['graphic'] if c['id'].startswith('g.') and c['kind'] == 'range'})
            for tab in ADV_TABS:
                ids = shown_ids(pg, tab, gnames if tab == 'graphic' else 1)
                missing = {c['id'] for c in adv['tabs'][tab]} - ids
                if missing:
                    fail(f'{where}: the {tab} tab does not draw {sorted(missing)}')
            # each Tune step's pages are checked too
            for _ in range(gnames):
                if find(pg, 'graphic', '[data-tune-next]'):
                    pg.click('[data-tune-next]')
                for i in range(npages(pg)):
                    goto(pg, i)
                    pg.evaluate(FRAME_JS)
                    for p in pg.evaluate(LAYOUT_JS)[:4]:
                        fail(f'{where}, graphic tune page {i + 1}: {p}')
                goto(pg, 0)
            if len(adv['colours']) < 2 or len(adv['colours']) > 5:
                fail(f'{where}: the Colour tab lists {len(adv["colours"])} colours')
    print(f'{at}: Advanced: {n} screens of seven tabs checked in every style and both modes (no scroll, no wrap, controls at least 48 px); every generated control is drawn')

    # each kind of control, tapped as a thumb would: it reaches the spec, and the stage draws it
    pg.evaluate('(x) => window.__rstr.app.load({ ...x, style: "swiss", mode: "light", marks: "light", finish: "grain", params: {}, pick: { ...x.pick, layout: "graphic-above", colours: null, motif: null } })', s0)
    idle(pg)

    def stage():
        return pg.evaluate('() => window.__rstr.app.stage()')

    def tapped(what, sel, test, change=True):
        px, before = stage(), spec(pg)
        tap(pg, sel)
        if not test(spec(pg)):
            fail(f'{at}: Advanced {what} did not reach the spec: {spec(pg)["params"]} {spec(pg)["pick"]}')
        elif change and stage() == px:
            # the design before the tap, so a seed that shows the control but draws the same can be opened (R14)
            fail(f'{at}: Advanced {what} drew the same stage', before)
    if find(pg, 'layout', 'button[data-ctl="layout.size"][data-v="small"]'):
        # the design may already draw its title Small (review R14 E1: a Shuffle that picked small drew the same stage):
        # Over and Small each reach the spec and draw different stages, as for title position Top and Low
        tap(pg, 'button[data-ctl="layout.size"][data-v="oversize"]')
        if spec(pg)['params'].get('layout.size') != 'oversize':
            fail(f'{at}: Advanced title size Over did not reach the spec: {spec(pg)["params"]}')
        px = stage()
        tapped('title size Small', 'button[data-ctl="layout.size"][data-v="small"]', lambda x: x['params'].get('layout.size') == 'small', change=False)
        if stage() == px:
            fail(f'{at}: Advanced title sizes Over and Small drew the same stage', spec(pg))
    else:
        fail(f'{at}: no title size control on the Layout tab')
    if find(pg, 'layout', '[data-ctl-next="pick.layout"]'):
        tapped('layout stepper', '[data-ctl-next="pick.layout"]', lambda x: x['pick']['layout'] not in (None, 'graphic-above'))
    if find(pg, 'type', 'input[data-ctl="type.cap"]'):
        px = stage()
        set_range(pg, 'type.cap', 0.6)
        if spec(pg)['params'].get('type.cap') != 0.6:
            fail(f'{at}: the Size cap range did not reach the spec')
        elif stage() == px:
            fail(f'{at}: the Size cap range drew the same stage')
        tap(pg, '[data-ctl-auto="type.cap"]')
        if 'type.cap' in spec(pg)['params']:
            fail(f'{at}: Auto did not clear the Size cap')
    else:
        fail(f'{at}: no Size cap range on the Type tab')
    if find(pg, 'style', 'input[data-ctl="finish.grain.strength"]'):
        set_range(pg, 'finish.grain.strength', 1.5)
        if spec(pg)['params'].get('finish.grain.strength') != 1.5:
            fail(f'{at}: the finish strength dial did not reach the spec')
    else:
        fail(f'{at}: no finish strength dial on the Style tab')
    if find(pg, 'graphic', 'input[data-ctl^="g."]'):
        cid = pg.get_attribute('input[data-ctl^="g."]', 'data-ctl')
        mx = float(pg.get_attribute(f'input[data-ctl="{cid}"]', 'max'))
        set_range(pg, cid, mx)
        if spec(pg)['params'].get(cid) is None:
            fail(f'{at}: the graphic parameter {cid} did not reach the spec')
    else:
        fail(f'{at}: no graphic parameter range on the Graphic tab')
    if find(pg, 'text', 'button[data-ctl="pos.title"][data-v="low"]'):
        # the seed may already draw the title low: Top and Low each reach the spec and draw different stages
        tap(pg, 'button[data-ctl="pos.title"][data-v="top"]')
        px = stage()
        tapped('title position Low', 'button[data-ctl="pos.title"][data-v="low"]', lambda x: x['text']['title']['pos'] == 'low', change=False)
        if stage() == px:
            fail(f'{at}: Advanced title positions Top and Low drew the same stage')
    else:
        fail(f'{at}: no title position on the Text tab')

    # the colour edit (spec 5): in the spec, drawn, kept with Colour locked, cleared by Shuffle without, reset
    if not find(pg, 'colour', 'input[data-colour="0"]'):
        fail(f'{at}: no colour swatch on the Colour tab')
    else:
        px = stage()
        pg.evaluate('() => { const el = document.querySelector(`input[data-colour="0"]`); el.value = "#3a5f8c"; el.dispatchEvent(new Event("input", { bubbles: true })); }')
        idle(pg)
        cs = spec(pg)['pick'].get('colours') or {}
        if '#3a5f8c' not in (cs.get('light') or {}).values():
            fail(f'{at}: the colour edit did not reach the spec: {cs}')
        elif stage() == px:
            fail(f'{at}: the colour edit drew the same stage')
        palettes = pg.evaluate('() => window.__rstr.names("swiss").palettes')
        # review bundle 4 M6: on the phone the edit is saved under pick.colours only, in the one localStorage key
        pg.wait_for_timeout(600)
        st = pg.evaluate('''() => { const keys = Object.keys(localStorage), raw = localStorage.getItem("rstr.app.v1");
            if (!raw) return { keys, raw: null };
            const x = JSON.parse(raw); for (const t of [x.spec, ...(x.back || []), ...(x.kept || [])]) if (t && t.pick) delete t.pick.colours;
            return { keys, raw, rest: JSON.stringify(x).toLowerCase().includes("#3a5f8c") }; }''')
        if [k for k in st['keys'] if k != 'rstr.app.v1']:
            fail(f'{at}: localStorage keys besides the saved state: {st["keys"]}')
        if not st['raw'] or '#3a5f8c' not in st['raw'].lower():
            fail(f'{at}: the colour edit was not saved')
        elif st['rest']:
            fail(f'{at}: the colour edit is saved outside pick.colours')
        pg.click('button[data-lock="colour"]')
        tap(pg, '[data-testid="shuffle"]')
        if spec(pg)['pick'].get('colours') != cs:
            fail(f'{at}: with Colour locked, Shuffle dropped the colour edit')
        pg.click('button[data-lock="colour"]')
        find(pg, 'colour', '[data-testid="colour-reset"]')
        tap(pg, '[data-testid="colour-reset"]')
        if spec(pg)['pick'].get('colours'):
            fail(f'{at}: Reset did not clear the colour edit')
        find(pg, 'colour', 'input[data-colour="0"]')
        pg.evaluate('() => { const el = document.querySelector(`input[data-colour="0"]`); el.value = "#3a5f8c"; el.dispatchEvent(new Event("input", { bubbles: true })); }')
        idle(pg)
        tap(pg, '[data-testid="shuffle"]')
        if spec(pg)['pick'].get('colours'):
            fail(f'{at}: Shuffle with Colour unlocked kept the colour edit')
        if pg.evaluate('() => window.__rstr.names("swiss").palettes') != palettes:
            fail(f'{at}: a colour edit changed a palette list')
    goto(pg, 0)
    print(f'{at}: Advanced controls tapped: a segment, a stepper, ranges and Auto, a position, a colour edit (kept with Colour locked, cleared by Shuffle and Reset)')
    pg.evaluate('(x) => window.__rstr.app.load(x)', s0)
    idle(pg)
    pg.click('[data-tab="style"]')
    pg.click('[data-testid="advanced"]')
    return n


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
                if pal['name'] not in shown or shown_pairing(par['name']) not in shown:
                    fail(f'{at}: the locks do not show {pal["name"]!r} and {shown_pairing(par["name"])!r}: {shown}')
                n += check_layout(pg, f'{at} {style} {mode} ({pal["name"]}, {par["name"]})', fail)
        print(f'{at}: {n} screens checked: no scroll, nothing spills out of its part, no parts overlap, controls at least 48 px, no text wraps or overflows (widest palette, pairing and style names)')

        # spec 10.1: page chips only when a tab does not fit; four rows fit on a tall screen (review R4 S5)
        if h >= 760:
            # Postmodern adds a fifth Look row (Dialect, R6), so it may page there
            for t in (['text', 'look'] if spec(pg)['style'] != 'pomo' else ['text']):
                pg.click(f'[data-tab="{t}"]')
                if npages(pg) > 1:
                    fail(f'{at}: the {t.title()} tab has page chips where its four rows fit')
            pg.click('[data-tab="style"]')

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
        # Finish and Marks (spec 7, row R7): every button is enabled; each changes only the finish or the marks
        # level, and the stage draws it (its pixels change)
        def find_page(sel):
            for i in range(npages(pg)):
                goto(pg, i)
                if pg.query_selector(sel):
                    return i
            return -1
        for attr, key, values in [('finish', 'finish', ['grain', 'grunge', 'vhs', 'glitch', 'clean']), ('marks', 'marks', ['light', 'full', 'off'])]:
            for v in values:
                if find_page(f'button[data-{attr}="{v}"]') < 0:
                    fail(f'{at}: no {attr} button {v}')
                    continue
                if pg.get_attribute(f'button[data-{attr}="{v}"]', 'disabled') is not None:
                    fail(f'{at}: the {attr} button {v} is disabled')
                before, stage0 = spec(pg), pg.evaluate('() => window.__rstr.app.stage()')
                tap(pg, f'button[data-{attr}="{v}"]')
                idle(pg)
                after, stage1 = spec(pg), pg.evaluate('() => window.__rstr.app.stage()')
                if after[key] != v or {**after, key: 0} != {**before, key: 0}:
                    fail(f'{at}: the {attr} button {v} did not change only {key}')
                if before[key] != v and stage0 == stage1:
                    fail(f'{at}: {attr} {v} drew the same stage as {before[key]}')
            goto(pg, 0)
        goto(pg, 1)
        for f in FACETS:
            before = spec(pg)
            tap(pg, f'button[data-reroll="{f}"]')
            after = spec(pg)
            if after['seeds'][f] == before['seeds'][f] or any(after['seeds'][g] != before['seeds'][g] for g in FACETS if g != f):
                fail(f'{at}: New {f} did not change only the {f} seed')
        goto(pg, 0)
        # Postmodern's Dialect control (spec 8.2, 10.2; R6): on the Look tab for Postmodern only; Shuffle keeps it;
        # in Advanced the Paper edge switch writes pomo.paperEdge
        def find_on_look(sel):
            pg.click('[data-tab="look"]')
            for i in range(npages(pg)):
                goto(pg, i)
                if pg.query_selector(sel):
                    return True
            return False
        if find_on_look('button[data-dialect]'):
            fail(f'{at}: a Dialect control shows for {spec(pg)["style"]}')
        goto(pg, 0)
        s0 = spec(pg)
        pg.evaluate('(x) => window.__rstr.app.load({ ...x, style: "pomo" })', s0)
        idle(pg)
        if not find_on_look('button[data-dialect="photocopy"]'):
            fail(f'{at}: no Dialect control for Postmodern')
        else:
            n += check_layout(pg, f'{at} pomo Dialect row', fail)
            find_on_look('button[data-dialect="photocopy"]')
            for d, want in [('photocopy', 'copy-'), ('icecream', None), ('either', None)]:
                tap(pg, f'button[data-dialect="{d}"]')
                got = spec(pg)['pick'].get('dialect')
                if got != (None if d == 'either' else d):
                    fail(f'{at}: Dialect {d} set pick.dialect {got}')
                frame = pg.evaluate('(x) => window.__rstr.scene(x).frame', spec(pg))
                if d == 'photocopy' and not frame.startswith('copy-') or d == 'icecream' and frame.startswith('copy-'):
                    fail(f'{at}: Dialect {d} drew {frame}')
                if d == 'photocopy':
                    tap(pg, '[data-testid="shuffle"]')
                    if spec(pg)['pick'].get('dialect') != 'photocopy':
                        fail(f'{at}: Shuffle dropped the dialect')
            if pg.query_selector('[data-testid="paper-edge"]'):
                fail(f'{at}: the Paper edge switch shows in Simple')
            # in Advanced it is on the Type tab (spec 10.3, Carried R10 from R6), for a photocopy design
            pg.evaluate('(x) => window.__rstr.app.load({ ...x, style: "pomo", pick: { ...x.pick, dialect: "photocopy", layout: null } })', spec(pg))
            idle(pg)
            pg.click('[data-testid="advanced"]')
            def find_on(tab, sel):
                pg.click(f'[data-tab="{tab}"]')
                for i in range(npages(pg)):
                    goto(pg, i)
                    if pg.query_selector(sel):
                        return True
                return False
            if not find_on('type', '[data-testid="paper-edge"]'):
                fail(f'{at}: no Paper edge switch on the Advanced Type tab')
            else:
                n += check_layout(pg, f'{at} pomo Paper edge row', fail, ADV_TABS)
                find_on('type', '[data-testid="paper-edge"]')
                tap(pg, '[data-testid="paper-edge"]')
                if spec(pg)['params'].get('pomo.paperEdge') is not False:
                    fail(f'{at}: Paper edge off did not reach the spec')
                # the rows are drawn again from the new design: find the switch again before the second tap (in one
                # R14 smoke run it was not found on the page shown and the tap timed out; not seen again)
                if not find_on('type', '[data-testid="paper-edge"]'):
                    fail(f'{at}: the Paper edge switch went away once off')
                else:
                    tap(pg, '[data-testid="paper-edge"]')
                if 'pomo.paperEdge' in spec(pg)['params']:
                    fail(f'{at}: Paper edge on did not clear the value')
                goto(pg, 0)
            pg.click('[data-tab="style"]')
            pg.click('[data-testid="advanced"]')
        pg.click('[data-tab="look"]')
        goto(pg, 0)
        pg.evaluate('(x) => window.__rstr.app.load(x)', s0)
        idle(pg)
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
        run_advanced(pg, at, fail)

        # Back restores the previous design exactly: the spec and the stage's pixels, step by step
        steps = [
            ('[data-testid="shuffle"]', None), ('button[data-style="pomo"]', None), ('button[data-format="3:4"]', None),
            ('[data-tab="look"]', 'mode'), (None, 'mode'),
            ('[data-tab="text"]', 'type'), (None, 'button[data-slot="subtitle"]'), ('[data-tab="style"]', 'button[data-style="vapor"]'),
            (None, '[data-testid="shuffle"]'), (None, 'button[data-format="1:1"]'), ('[data-tab="look"]', 'button[data-reroll-page]'),
            ('[data-tab="style"]', '[data-testid="shuffle"]'),
            # Advanced (review R10 S4): a range dragged (three input events, one Back step, spec 10.1) and a colour
            # edited (two input events, one step)
            (None, 'adv-range'), (None, 'adv-colour'),
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
            elif sel == 'adv-range':
                if pg.get_attribute('[data-testid="advanced"]', 'aria-pressed') != 'true':
                    pg.click('[data-testid="advanced"]')
                    idle(pg)
                cid = None
                for tab in ['type', 'layout', 'graphic', 'style']:
                    if find(pg, tab, 'input[type="range"][data-ctl]'):
                        cid = pg.get_attribute('input[type="range"][data-ctl]', 'data-ctl')
                        break
                if not cid:
                    fail(f'{at}: Back test: no range control in Advanced')
                else:
                    lo, hi = (float(pg.get_attribute(f'input[data-ctl="{cid}"]', k)) for k in ('min', 'max'))
                    for t in (0.2, 0.35, 0.1):
                        set_range(pg, cid, lo + (hi - lo) * t)
            elif sel == 'adv-colour':
                if not find(pg, 'colour', 'input[data-colour="0"]'):
                    fail(f'{at}: Back test: no colour swatch on the Colour tab')
                for col in ('#3a5f8c', '#5c2a7e'):
                    pg.evaluate('(c) => { const el = document.querySelector(`input[data-colour="0"]`); el.value = c; el.dispatchEvent(new Event("input", { bubbles: true })); }', col)
                    idle(pg)
            elif sel == 'button[data-reroll-page]':
                for i in range(npages(pg)):
                    goto(pg, i)
                    if pg.query_selector('button[data-reroll="colour"]'):
                        break
                tap(pg, 'button[data-reroll="colour"]')
                goto(pg, 0)
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
        if pg.get_attribute('[data-testid="advanced"]', 'aria-pressed') == 'true':
            pg.click('[data-testid="advanced"]')
            idle(pg)
        print(f'{at}: Back restored {len(steps)} designs exactly (spec and stage pixels), typing in a field is one step, so is a range drag and a colour edit')

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
        if pg.get_attribute('[data-testid="advanced"]', 'aria-pressed') != 'true':
            fail(f'{at}: before reload, Advanced is not on')
        # wait for the autosave effect to have written this state, or the reload races it (review bundle 2 S1)
        try:
            pg.wait_for_function('''() => {
                const s = JSON.parse(localStorage.getItem('rstr.app.v1') || '{}');
                const want = window.__rstr.app.state(), k = (x) => JSON.stringify(x);
                return s.advanced === true && k(s.spec) === k(want.spec) && k(s.kept) === k(want.kept)
                    && k(s.locks) === k(want.locks) && k(s.back) === k(want.back);
            }''', timeout=5000)
        except Exception:
            fail(f'{at}: before reload, the autosave did not write the design, Kept, locks and Advanced within 5 s')
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
        if [t.get_attribute('data-tab') for t in pg.query_selector_all('[data-tab]')] != ADV_TABS:
            fail(f'{at}: Advanced should show its seven tabs {ADV_TABS} (spec 10.3, R10, R14)')
        if pg.evaluate('() => window.__rstr.app.stage()') == '':
            fail(f'{at}: after reload the stage is empty')
        pg.click('[data-testid="back"]')
        idle(pg)
        if json.dumps(spec(pg), sort_keys=True) != json.dumps(st['back'][-1], sort_keys=True):
            fail(f'{at}: after reload, Back did not restore the step before')
        pg.click('[data-testid="advanced"]')
        pg.click('button[data-lock="graphic"]')
        print(f'{at}: reload brought back the design, {len(st["back"])} Back steps, {len(st["kept"])} kept, the locks and Advanced')

        # a ?s= link over a saved design: the link opens, the saved design is one Back step away; a broken link
        # changes nothing (review R4 S2)
        st = pg.evaluate('() => window.__rstr.app.state()')
        link = {**st['spec'], 'style': 'brutal' if st['spec']['style'] != 'brutal' else 'swiss', 'seeds': {**st['spec']['seeds'], 'layout': 4242}}
        pg.goto(url + '?s=' + urllib.parse.quote(json.dumps(link)))
        pg.wait_for_function('window.__rstr !== undefined')
        pg.evaluate('() => window.__rstr.ready')
        idle(pg)
        now = spec(pg)
        if now['style'] != link['style'] or now['seeds']['layout'] != 4242:
            fail(f'{at}: a ?s= link did not open its design')
        pg.click('[data-testid="back"]')
        idle(pg)
        if json.dumps(spec(pg), sort_keys=True) != json.dumps(st['spec'], sort_keys=True):
            fail(f'{at}: after opening a ?s= link, Back did not bring back the saved design')
        before = pg.evaluate('() => window.__rstr.app.state()')
        pg.goto(url + '?s=garbage')
        pg.wait_for_function('window.__rstr !== undefined')
        pg.evaluate('() => window.__rstr.ready')
        idle(pg)
        if json.dumps(pg.evaluate('() => window.__rstr.app.state()'), sort_keys=True) != json.dumps(before, sort_keys=True):
            fail(f'{at}: a broken ?s= link changed the saved state')
        print(f'{at}: a ?s= link opened over a saved design with that design one Back step away; a broken link changed nothing')

        # storage full: a note says what was not saved; it goes when saving works again (review R4 S3)
        pg.evaluate('''() => { const o = Storage.prototype.setItem; window.__setItem = o;
          Storage.prototype.setItem = function (k, v) { if (JSON.parse(v).back.length) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; }''')
        tap(pg, '[data-testid="shuffle"]')
        t1 = pg.inner_text('[data-testid="save-note"]') if pg.query_selector('[data-testid="save-note"]') else ''
        pg.evaluate('''() => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; }''')
        tap(pg, '[data-testid="shuffle"]')
        t2 = pg.inner_text('[data-testid="save-note"]') if pg.query_selector('[data-testid="save-note"]') else ''
        if 'Back steps not saved' not in t1:
            fail(f'{at}: with Back too big to save, the note says {t1!r}')
        if not t2.startswith('Not saved on this phone'):
            fail(f'{at}: with storage full, the note says {t2!r}')
        for p in pg.evaluate(LAYOUT_JS)[:6]:
            fail(f'{at}, storage note shown: {p}')
        pg.evaluate('() => { Storage.prototype.setItem = window.__setItem; }')
        tap(pg, '[data-testid="shuffle"]')
        if pg.query_selector('[data-testid="save-note"]'):
            fail(f'{at}: the storage note stayed after saving worked again')
        print(f'{at}: storage full showed a note (Back steps dropped first), and it went once saving worked')

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


def test_jpegs(tmp):
    """Two photos as a phone gives them: a landscape picture stored sideways with EXIF orientation 6 (the camera was
    held upright, so the app must show it 1200 x 1600), and a plain landscape one."""
    import os
    from PIL import Image as I, ImageDraw
    out = []
    for name, (w, h), orient in [('upright.jpg', (1600, 1200), 6), ('wide.jpg', (2400, 1500), 1)]:
        im = I.new('RGB', (w, h), (30, 60, 110))
        d = ImageDraw.Draw(im)
        for i in range(0, w, 40):
            d.rectangle([i, h // 2, i + 20, h], fill=(220, 200, 150))
        d.ellipse([w // 3, h // 8, w // 3 + h // 4, h // 8 + h // 4], fill=(255, 240, 200))
        ex = I.Exif()
        ex[0x0112] = orient
        p = os.path.join(tmp, name)
        im.save(p, quality=90, exif=ex.tobytes())
        out.append(p)
    return out


def test_many(tmp, n):
    """n small photos, each a different colour, for the memory check (review R14 S4)."""
    import os
    from PIL import Image as I
    out = []
    for i in range(n):
        p = os.path.join(tmp, f'many{i}.jpg')
        I.new('RGB', (600 + 10 * i, 800), (20 * i, 255 - 20 * i, 90)).save(p, quality=85)
        out.append(p)
    return out


def run_photo(b, url, fail):
    """Row R14 in the app (spec 8.9, 10.2, 10.3): Add a photo from the phone through the Photo tab, its orientation
    corrected; the stage draws it; it survives reload; New crop and Remove; Shuffle with Layout locked holds where it
    sits; export with it; prune keeps what Back or Kept holds and deletes the rest; decoded photos are released; and no
    network request carries image data (every request, the service worker's too, is a GET with no body, no URL over
    2 KB, no query to this host, none to a host but this one and the font hosts; no websocket)."""
    import tempfile
    from urllib.parse import urlparse
    at = 'photo 412x915'
    pg, errors = open_app(b, url, 412, 915)
    host = urlparse(url).netloc
    reqs, sockets, reg, peak = [], [], [], 0
    # on the context, so requests the app's service worker makes itself are seen too (review R14 S3)
    pg.context.on('request', lambda r: reqs.append((r.method, r.url, r.post_data_buffer)))
    pg.on('websocket', lambda w: sockets.append(w.url))
    with tempfile.TemporaryDirectory() as tmp:
        upright, wide = test_jpegs(tmp)
        pg.click('[data-tab="photo"]')
        for p in pg.evaluate(LAYOUT_JS)[:6]:
            fail(f'{at}, Photo tab without a photo: {p}')
        if not pg.query_selector('[data-testid="photo-add"]') or pg.get_attribute('[data-testid="photo-remove"]', 'disabled') is None:
            fail(f'{at}: the Photo tab has no Add, or Remove is live with no photo')
        before = spec(pg)
        pg.set_input_files('[data-testid="photo-input"]', upright)
        try:
            pg.wait_for_function('() => !!window.__rstr.spec().photo', timeout=15000)
        except Exception:
            fail(f'{at}: choosing a photo did not put it on the design')
            pg.close()
            return
        idle(pg)
        s = spec(pg)
        pid = s['photo']['id']
        info = pg.evaluate('(id) => window.__rstr.photo.info(id)', pid)
        if not info or (info['w'], info['h']) != (1200, 1600):
            fail(f'{at}: a 1600 x 1200 photo with EXIF orientation 6 was kept as {info} (want 1200 x 1600, orientation corrected)')
        if {k: v for k, v in s.items() if k != 'photo'} != {k: v for k, v in before.items() if k != 'photo'}:
            fail(f'{at}: adding a photo changed more than the photo')
        sc = pg.evaluate('(s) => window.__rstr.scene(s)', s)
        if not any(i['kind'] == 'graphic' and i['name'] == 'photo' for i in sc['items']):
            fail(f'{at}: the design with a photo draws none')
        for p in pg.evaluate(LAYOUT_JS)[:6]:
            fail(f'{at}, Photo tab with a photo: {p}')
        # New crop moves the crop alone
        tap(pg, '[data-testid="photo-crop"]')
        s2 = spec(pg)
        if not (s2['photo'] and s2['photo']['place'] and 'crop' in s2['photo']['place']) or s2['seeds'] != s['seeds']:
            fail(f'{at}: New crop did not set a crop alone: {s2["photo"]}')
        # Layout locked: Shuffle holds the photo's role and crop
        pg.click('button[data-lock="layout"]')
        g0 = [i for i in pg.evaluate('(s) => window.__rstr.scene(s)', spec(pg))['items'] if i['kind'] == 'graphic' and i['name'] == 'photo']
        tap(pg, '[data-testid="shuffle"]')
        g1 = [i for i in pg.evaluate('(s) => window.__rstr.scene(s)', spec(pg))['items'] if i['kind'] == 'graphic' and i['name'] == 'photo']
        if not g0 or not g1 or (g0[0]['params']['role'], g0[0]['params']['scale']) != (g1[0]['params']['role'], g1[0]['params']['scale']):
            fail(f'{at}: with Layout locked, Shuffle moved the photo')
        pg.click('button[data-lock="layout"]')
        # row R15: the Treatment tiles (spec 10.2) pick a treatment by hand, which the design draws; Auto gives it back
        for i in range(npages(pg)):
            goto(pg, i)
            if pg.query_selector('button[data-treat="threshold"]'):
                break
        if not pg.query_selector('button[data-treat="threshold"]'):
            fail(f'{at}: the Photo tab has no Treatment tiles')
        else:
            px0 = pg.evaluate('() => window.__rstr.pixels(window.__rstr.spec())')
            t0 = [i for i in pg.evaluate('(s) => window.__rstr.scene(s)', spec(pg))['items'] if i['kind'] == 'graphic' and i['name'] == 'photo'][0]['params'].get('treat')
            tap(pg, 'button[data-treat="threshold"]')
            s4 = spec(pg)
            g4 = [i for i in pg.evaluate('(s) => window.__rstr.scene(s)', s4)['items'] if i['kind'] == 'graphic' and i['name'] == 'photo']
            if s4['photo']['treatment'] != 'threshold' or not g4 or g4[0]['params'].get('treat') != 'threshold':
                fail(f'{at}: the Threshold tile did not put the treatment on the design ({s4["photo"]})')
            elif t0 != 'threshold' and pg.evaluate('() => window.__rstr.pixels(window.__rstr.spec())') == px0:
                fail(f'{at}: the Threshold tile drew the same pixels')
            if pg.get_attribute('button[data-treat="threshold"]', 'aria-pressed') != 'true':
                fail(f'{at}: the Threshold tile is not shown as on')
            tap(pg, 'button[data-treat="auto"]')
            if spec(pg)['photo']['treatment'] is not None:
                fail(f'{at}: Auto did not give the treatment back to the graphic stream')
            goto(pg, 0)
        # Advanced: the Photo tab carries role, scale and offset, the treatment tiles and its parameters
        pg.click('[data-testid="advanced"]')
        pg.click('[data-tab="photo"]')
        ids = set()
        for i in range(npages(pg)):
            goto(pg, i)
            ids |= set(pg.evaluate('() => [...document.querySelectorAll("[data-row]")].map((e) => e.dataset.row)'))
            for p in pg.evaluate(LAYOUT_JS)[:6]:
                fail(f'{at}, Advanced Photo tab page {i + 1}: {p}')
        goto(pg, 0)
        want = {'photo-file', 'photo-crop', 'photo-treat-0', 'photo-treat-1', 'photo.role', 'photo.scale', 'photo.x', 'photo.y'}
        if not want <= ids:
            fail(f'{at}: the Advanced Photo tab lacks {sorted(want - ids)}')
        pg.click('[data-testid="advanced"]')
        # reload: the design and its photo come back from the phone
        st = spec(pg)
        pg.wait_for_timeout(400)
        pg.reload()
        pg.wait_for_function('window.__rstr !== undefined')
        pg.evaluate('() => window.__rstr.ready')
        idle(pg)
        s3 = spec(pg)
        info = pg.evaluate('(id) => window.__rstr.photo.info(id)', pid)
        if not s3.get('photo') or s3['photo']['id'] != pid or not info or not info['img']:
            fail(f'{at}: after reload the photo did not come back ({s3.get("photo")}, {info})')
        elif not any(i['kind'] == 'graphic' and i['name'] == 'photo' for i in pg.evaluate('(s) => window.__rstr.scene(s)', s3)['items']):
            fail(f'{at}: after reload the design draws no photo')
        if json.dumps(s3, sort_keys=True) != json.dumps(st, sort_keys=True):
            fail(f'{at}: reload did not bring back the design with its photo')
        # Change: a second photo replaces the first; Remove takes it off the design
        # export with the photo on the design: the other path its pixels take (review R14 S3)
        pg.click('[data-testid="export"]')
        pg.wait_for_selector('[data-testid="export-sheet"]')
        pg.click('button[data-kind="jpeg"]')
        downloads = []
        pg.on('download', lambda d: downloads.append(d))
        pg.click('[data-testid="save"]')
        t0 = time.time()
        while not downloads and time.time() - t0 < 30:
            pg.wait_for_timeout(100)
        if not downloads:
            fail(f'{at}: export with a photo gave no file')
        pg.click('[data-testid="close"]')
        pg.click('[data-tab="photo"]')
        pg.set_input_files('[data-testid="photo-input"]', wide)
        try:
            pg.wait_for_function('(id) => { const p = window.__rstr.spec().photo; return p && p.id !== id; }', arg=pid, timeout=15000)
        except Exception:
            fail(f'{at}: Change did not replace the photo')
        idle(pg)
        tap(pg, '[data-testid="photo-remove"]')
        if spec(pg).get('photo') is not None:
            fail(f'{at}: Remove left a photo on the design')
        pid2 = [x for x in pg.evaluate('() => window.__rstr.photo.stored()') if x != pid]
        # review R14 S5: prune, tested. After a reload no photo is fresh: a photo Back still holds stays past the
        # 3 s wait; one held only by Kept stays; one nothing holds any more leaves the phone
        def reload_and_wait():
            pg.wait_for_timeout(600)
            pg.reload()
            pg.wait_for_function('window.__rstr !== undefined')
            pg.evaluate('() => window.__rstr.ready')
            idle(pg)
            pg.wait_for_timeout(3600)
            return pg.evaluate('() => window.__rstr.photo.stored()')
        stored = reload_and_wait()
        if pid not in stored or not pid2 or pid2[0] not in stored:
            fail(f'{at}: after reload a photo Back holds left the phone ({pid}, {pid2} not all in {stored})')
        # Back once: the design with the second photo, which Kept then holds; Remove; then 32 shuffles push every
        # design with a photo out of Back's 30 steps
        tap(pg, '[data-testid="back"]')
        if not (spec(pg).get('photo') or {}).get('id') in pid2:
            fail(f'{at}: Back did not bring back the design with the second photo: {spec(pg).get("photo")}')
        pg.click('[data-testid="keep"]')
        idle(pg)
        pg.click('[data-tab="photo"]')
        tap(pg, '[data-testid="photo-remove"]')
        for _ in range(32):
            tap(pg, '[data-testid="shuffle"]')
        stored = reload_and_wait()
        back = pg.evaluate('() => JSON.parse(localStorage.getItem("rstr.app.v1")).back.map((s) => s.photo && s.photo.id)')
        if any(back):
            fail(f'{at}: Back still holds a photo after 32 shuffles: {back}')
        if pid in stored:
            fail(f'{at}: a photo no design holds any more was not deleted from the phone ({pid} in {stored})')
        if pid2 and pid2[0] not in stored:
            fail(f'{at}: a photo only Kept holds left the phone ({pid2[0]} not in {stored})')
        # review R14 S4: decoded photos are released; with ten different photos in Back, after stepping back through
        # them only the current design's stays decoded
        many = test_many(tmp, 10)
        pg.click('[data-tab="photo"]')
        for f in many:
            before = (spec(pg).get('photo') or {}).get('id')
            pg.set_input_files('[data-testid="photo-input"]', f)
            try:
                pg.wait_for_function('(id) => { const p = window.__rstr.spec().photo; return p && p.id !== id; }', arg=before, timeout=15000)
            except Exception:
                fail(f'{at}: adding photo {f} did not put it on the design')
            idle(pg)
        peak = len(pg.evaluate('() => window.__rstr.photo.registered()'))
        # Back x 9: through every one of the ten, to the first, whose photo alone stays decoded
        for _ in range(9):
            tap(pg, '[data-testid="back"]')
        reg = pg.evaluate('() => window.__rstr.photo.registered()')
        cur = (spec(pg).get('photo') or {}).get('id')
        if not cur or reg != [cur]:
            fail(f'{at}: after ten photos and Back x 9, {len(reg)} photos stay decoded ({reg}; current {cur})')
    bad = [(m, u[:120]) for (m, u, body) in reqs if m != 'GET' or body or u.startswith('data:') or (urlparse(u).netloc not in (host, 'fonts.googleapis.com', 'fonts.gstatic.com') and not u.startswith('blob:'))]
    # a GET may carry data in its URL: none over 2 KB, and no query string to this host (review R14 S3)
    bad += [('GET long', u[:120]) for (m, u, body) in reqs if len(u) > 2048 and not u.startswith('blob:')]
    bad += [('GET query', u[:120]) for (m, u, body) in reqs if urlparse(u).netloc == host and urlparse(u).query]
    bad += [('websocket', u[:120]) for u in sockets]
    if bad:
        fail(f'{at}: requests that could carry the photo: {bad[:4]}')
    if errors:
        fail(f'{at}: page errors {errors[:3]}')
    print(f'{at}: a photo added through the Photo tab (orientation corrected), drawn, New crop, Layout lock holds it, a Treatment tile and Auto, Advanced role/scale/offset, back after reload, exported, Change and Remove; prune keeps what Back or Kept holds and deletes the rest; ten photos then Back x 9 leave {len(reg)} decoded, the current design (after the ten adds: {peak}); {len(reqs)} requests (service worker included), none with a body, a long URL, a query to this host or to another host; {len(sockets)} websockets')
    pg.close()
