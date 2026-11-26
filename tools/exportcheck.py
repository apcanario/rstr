"""Row R16 (spec 10.1, 9.4): export in headless Chrome. Every format x size x file type gives a file of exactly the
stated pixels; a strip-rendered export is pixel-identical to a single-canvas one at 3x; the three ways to a file (one
canvas, strips joined, strips written straight into a PNG) give the same pixels, bleed included; the honest failure
on a phone that cannot make a size; marks and finishes drawn at the export size (Carried R16 from R7); text over a
full-size test photo read on pixels at 3x (Carried R16 from R14); and the A3 print render's time and peak memory."""
import base64, io, json, os, time
from PIL import Image
import psutil

MAKE = '([s, z, b, k, lim, force]) => window.__rstr.export.make(s, z, b, k, lim || {}, force || undefined)'
SPEC = '''([style, fmt, fin, marks, i, photo]) => { const x = window.__rstr.spec(); x.style = style; x.format = fmt; x.finish = fin;
  x.marks = marks; x.mode = i % 2 ? "dark" : "light"; x.params = {}; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: style === "pomo" ? (i % 2 ? "photocopy" : "icecream") : null};
  x.seeds = {layout: 1600 + i * 7, colour: 1700 + i, graphic: 1800 + i * 3, type: 1900 + i}; x.photo = photo; return x; }'''
FORMATS = ['1:1', '3:4', '9:16', 'A']
STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
FINISHES = ['clean', 'grain', 'grunge', 'vhs', 'glitch']
KINDS = {'jpeg': ('JPEG', 'image/jpeg'), 'png': ('PNG', 'image/png'), 'webp': ('WEBP', 'image/webp')}


def webp_size(b):
    """Width and height from a WebP file's first bytes (VP8, VP8L or VP8X chunk); None if it is not a WebP."""
    if b[:4] != b'RIFF' or b[8:12] != b'WEBP':
        return None
    c = b[12:16]
    if c == b'VP8X':
        return (1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little'))
    if c == b'VP8L':
        v = int.from_bytes(b[21:25], 'little')
        return (1 + (v & 0x3FFF), 1 + ((v >> 14) & 0x3FFF))
    if c == b'VP8 ':
        return (int.from_bytes(b[26:28], 'little') & 0x3FFF, int.from_bytes(b[28:30], 'little') & 0x3FFF)
    return None


def header(b64):
    """(format, size) read from a file's first bytes: PIL for JPEG and PNG, the RIFF header for WebP."""
    b = base64.b64decode(b64)
    w = webp_size(b)
    if w:
        return 'WEBP', w
    im = Image.open(io.BytesIO(b))
    return im.format, im.size


def spec(pg, style, fmt, fin='clean', marks='off', i=0, photo=None):
    return pg.evaluate(SPEC, [style, fmt, fin, marks, i, photo])


def renderers():
    """The headless Chrome processes that draw: renderers and the GPU process (pid, kind)."""
    out = []
    for p in psutil.process_iter(['pid', 'cmdline']):
        cl = ' '.join(p.info['cmdline'] or [])
        if ('chrom' in cl or 'headless_shell' in cl) and '--type=renderer' in cl:
            out.append((p.info['pid'], 'renderer'))
        elif ('chrom' in cl or 'headless_shell' in cl) and '--type=gpu-process' in cl:
            out.append((p.info['pid'], 'gpu'))
    return out


def hwm(pid):
    """Peak resident memory of a process since its last reset, MB (VmHWM)."""
    try:
        for line in open(f'/proc/{pid}/status'):
            if line.startswith('VmHWM:'):
                return int(line.split()[1]) / 1024
    except OSError:
        return None
    return None


def reset_hwm(pid):
    try:
        with open(f'/proc/{pid}/clear_refs', 'w') as f:
            f.write('5')
        return True
    except OSError:
        return False


def run(pg, fail):
    t0 = time.time()
    # every format x size x file type (and Print with and without its bleed): a file of exactly the stated pixels,
    # of the stated type, read by the browser and by PIL
    ncomb = 0
    for fi, fmt in enumerate(FORMATS):
        sizes = pg.evaluate('(f) => f === "A" ? ["1x", "2x", "3x", "print"] : ["1x", "2x", "3x"]', fmt)
        for zi, z in enumerate(sizes):
            for bleed in ([False, True] if z == 'print' else [False]):
                for ki, k in enumerate(KINDS):
                    j = fi * 7 + zi * 3 + ki
                    photo = {'id': 'test-portrait', 'treatment': None, 'place': None} if j % 3 == 0 else None
                    s = spec(pg, STYLES[j % 4], fmt, FINISHES[j % 5], ['off', 'light', 'full'][j % 3], j, photo)
                    want = pg.evaluate('([f, z, b]) => window.__rstr.export.dims(f, z, b)', [fmt, z, bleed])
                    r = pg.evaluate(MAKE, [s, z, bleed, k, None, None])
                    ncomb += 1
                    label = f'export {fmt} {z}{" bleed" if bleed else ""} {k}'
                    if not r['ok']:
                        fail(f'{label}: {r["error"]}', s)
                        continue
                    hf, hs = header(r['head'])
                    got = (r['w'], r['h'], tuple(r['decoded']), tuple(hs), hf, r['type'])
                    exp = (want['w'], want['h'], (want['w'], want['h']), (want['w'], want['h']), KINDS[k][0], KINDS[k][1])
                    if got != exp:
                        fail(f'{label}: got {got}, want {exp}', s)
                    name = pg.evaluate('([s, z, b, k]) => window.__rstr.export.name(s, z, b, k)', [s, z, bleed, k])
                    ext = {'jpeg': 'jpg', 'png': 'png', 'webp': 'webp'}[k]
                    if not name.startswith('rstr-') or not name.endswith(f'-{fmt.replace(":", "x")}-{want["w"]}.{ext}'):
                        fail(f'{label}: file name {name}')
                    if z in ('3x', 'print'):
                        print(f'{label}: {r["w"]} x {r["h"]} {r["type"]}, {r["bytes"] / 1e6:.1f} MB, {r["ms"]:.0f} ms ({r["how"]})')
    print(f'export sizes: {ncomb} files (4 formats x 1x, 2x, 3x, and Print with and without bleed for A, x JPEG, PNG, WebP), each of exactly its pixels and type, decoded by the browser and by PIL; {time.time() - t0:.0f} s')

    # a strip-rendered export is pixel-identical to a single-canvas one, at 3x: every finish, every style, marks,
    # the photocopy copier pass, a treated photo (ground, box, turned), a guard that puts an item back
    t1 = time.time()
    cases = [('swiss', '9:16', 'clean', 'full', 0, None), ('pomo', 'A', 'grain', 'light', 1, None), ('brutal', '3:4', 'grunge', 'full', 2, None),
             ('vapor', '9:16', 'vhs', 'light', 3, None), ('pomo', '9:16', 'glitch', 'full', 4, None), ('vapor', 'A', 'glitch', 'off', 5, None),
             ('swiss', 'A', 'grain', 'off', 6, {'id': 'test-portrait', 'treatment': 'halftone', 'place': {'role': 'ground'}}),
             ('brutal', '9:16', 'clean', 'light', 7, {'id': 'test-landscape', 'treatment': 'dither', 'place': {'role': 'box'}}),
             ('swiss', '3:4', 'vhs', 'off', 8, {'id': 'test-portrait', 'treatment': 'threshold', 'place': {'role': 'disc'}}),
             ('pomo', 'A', 'clean', 'off', 9, {'id': 'test-landscape', 'treatment': 'duotone', 'place': {'role': 'band'}}),
             ('swiss', '9:16', 'clean', 'off', 10, {'id': 'test-portrait', 'treatment': 'mono', 'place': {'role': 'box'}})]
    # a photocopy design with Grunge and full marks at 9:16
    guard_case = pg.evaluate('() => { const x = window.__rstr.spec(); x.style = "pomo"; x.format = "9:16"; x.mode = "light"; x.marks = "full"; x.finish = "grunge"; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; x.pick = {palette: null, colours: null, pairing: null, motif: null, layout: null, dialect: "photocopy"}; x.params = {}; x.photo = null; return x; }')
    specs = [spec(pg, *c) for c in cases] + [guard_case]
    # a turned photo (the composition tilted): the treated box is drawn through the transform
    turned = spec(pg, 'swiss', '3:4', 'clean', 'off', 11, {'id': 'test-portrait', 'treatment': 'posterise', 'place': {'role': 'box'}})
    turned['params'] = {'layout.transform': 'tilt'}
    specs.append(turned)
    nstr = restored = 0
    for s in specs:
        r = pg.evaluate('([s]) => window.__rstr.export.stripsSame(s, "3x", 512)', [s])
        nstr += 1
        restored += r['restored']
        print(f'strips 3x {s["style"]:6} {s["format"]:4} {s["finish"]:6} marks {s["marks"]:5} {(s["photo"] or {}).get("treatment") or "":9}: {r["w"]} x {r["h"]}, {r["strips"]} strips ({r["drawn"]} drawn), {r["diff"]} channel values differ (max {r["max"]}); one canvas {r["single"]:.0f} ms, strips {r["striped"]:.0f} ms; guard put back {r["restored"]}')
        if r['diff'] != 0:
            fail(f'strips 3x {s["style"]} {s["format"]} {s["finish"]}: {r["diff"]} channel values differ from the single canvas (max {r["max"]}), first rows {r["where"][:4]}', s)
    if restored == 0:
        fail('strips: no case had the guard put an item back, so its rounds over the strips were not tested')
    print(f'strips: {nstr} designs at 3x drawn on one canvas and in strips, pixel-identical; {time.time() - t1:.0f} s')

    # one canvas, strips joined in one canvas, strips written into a PNG: the same file, Print with bleed and 3x
    t1 = time.time()
    for s, z, b in [(spec(pg, 'vapor', 'A', 'grunge', 'full', 12, {'id': 'test-landscape', 'treatment': 'colour', 'place': {'role': 'ground'}}), 'print', True),
                    (spec(pg, 'brutal', '1:1', 'glitch', 'light', 13), '3x', False)]:
        r = pg.evaluate('([s, z, b]) => window.__rstr.export.paths(s, z, b)', [s, z, b])
        print(f'paths {s["style"]} {s["format"]} {z}{" bleed" if b else ""}: {r["w"]} x {r["h"]} via {r["hows"]}; strips joined differ in {r["strips"]["diff"]}, strips into PNG in {r["png"]["diff"]}')
        if r['strips']['diff'] or r['png']['diff'] or (r['strips']['w'], r['strips']['h'], r['png']['w'], r['png']['h']) != (r['w'], r['h'], r['w'], r['h']):
            fail(f'paths {s["format"]} {z}: the three ways to the file differ: {r}', s)
        if r['hows'] != ['single', 'strips', 'strips-png']:
            fail(f'paths: took {r["hows"]}')
    print(f'export paths checked; {time.time() - t1:.0f} s')

    # the honest failure (spec 10.1): a phone that makes no canvas over 6 M pixels cannot make a 3x JPEG of 9:16
    # (18.7 M) and says so; 2x (8.3 M) neither; a PNG at that size is written in strips; one that cannot make even a strip says so
    s = spec(pg, 'swiss', '9:16', 'grain', 'light', 14)
    r = pg.evaluate(MAKE, [s, '3x', False, 'jpeg', {'maxArea': 6_000_000}, None])
    if r['ok']:
        fail(f'failure: a 3x JPEG was made under a 4 M pixel limit ({r["w"]} x {r["h"]}, {r["how"]})', s)
    w = pg.evaluate('([s, k, l]) => window.__rstr.export.working(s, k, ["1x", "2x", "3x"], false, l)', [s, 'jpeg', {'maxArea': 6_000_000}])
    if w != ['1x']:
        fail(f'failure: working JPEG sizes under 6 M pixels {w}, want ["1x"] (2x is 8.3 M)')
    r2 = pg.evaluate(MAKE, [s, '3x', False, 'png', {'maxArea': 6_000_000}, None])
    if not r2['ok'] or r2['how'] != 'strips-png' or tuple(r2['decoded']) != (3240, 5760):
        fail(f'failure: a 3x PNG under 6 M pixels should be written in strips: {r2}', s)
    r3 = pg.evaluate(MAKE, [s, '3x', False, 'png', {'maxArea': 1_000_000}, None])
    if r3['ok']:
        fail('failure: a PNG was made where no strip canvas can be', s)
    print(f'honest failure: under 6 M px a 3x JPEG says "{r.get("error")}", JPEG sizes that work {w}, a 3x PNG is written in strips ({r2.get("how")}, {r2.get("ms", 0):.0f} ms); under 1 M px: "{r3.get("error")}"')

    # Carried R16 (from R7): marks and finishes drawn at the export size
    nsc = 0
    for i, (st, fmt, fin) in enumerate([('swiss', '3:4', 'grain'), ('brutal', '9:16', 'grunge'), ('vapor', 'A', 'grain'), ('pomo', '1:1', 'grunge')]):
        for z in ['2x', '3x']:
            s = spec(pg, st, fmt, fin, 'full', 20 + i)
            r = pg.evaluate('([s, z]) => window.__rstr.export.scale(s, z)', [s, z])
            nsc += 1
            if r['marks'] == 0 or r['iou'] < 0.9 or r['pairs'] < 0.9:
                fail(f'scale {st} {fmt} {fin} {z}: {r["marks"]} marks, their coverage against 1x {r["iou"]:.3f} (want 0.9), side-by-side pixel pairs that differ {r["pairs"]:.3f} (want 0.9)', s)
            else:
                print(f'scale {st:6} {fmt:4} {fin:6} {z}: {r["marks"]} marks cover what they cover at 1x ({r["iou"]:.3f}); {r["pairs"] * 100:.0f}% of side-by-side pixels differ (a finish scaled up from 1x would leave at most {100 // int(z[0]) + 1}%)')
    # the test of the test: marks drawn at their 1x size into a 3x file, and a finish made at 1x and scaled up, fail it
    s = spec(pg, 'swiss', '3:4', 'grain', 'full', 20)
    r = pg.evaluate('([s, z]) => window.__rstr.export.scale(s, z, true)', [s, '3x'])
    if r['iou'] >= 0.9 or r['pairs'] >= 0.9:
        fail(f'scale check: marks at 1x size and a finish scaled up from 1x passed it ({r})', s)
    print(f'marks and finishes at the export size: {nsc} renders checked; marks at 1x size in a 3x file score {r["iou"]:.3f} and a finish scaled up from 1x {r["pairs"]:.3f}, both failing as they should')

    # Carried R16 (from R14): text over a full-size test photo (decoded at its full 3000 x 4000, not the grid) read on
    # pixels at 3x, every style, every role, measured and plated
    t1 = time.time()
    info = pg.evaluate('() => window.__rstr.photo.full("full-portrait", 3000, 4000, 7)')
    pg.evaluate('() => window.__rstr.photo.full("full-landscape", 4000, 2600, 11)')
    nfp = meas = 0
    for k, style in enumerate(STYLES):
        for j, role in enumerate(['ground', 'box', 'disc', 'column', 'band']):
            for t in (['colour', 'mono'] if j % 2 == 0 else ['colour']):
                s = spec(pg, style, FORMATS[(k + j) % 4], 'clean', 'off', 30 + k * 5 + j, {'id': 'full-portrait' if (k + j) % 2 else 'full-landscape', 'treatment': t, 'place': {'role': role, 'scale': 2.5, 'x': 0.5, 'y': (k + j) % 3 / 2}})
                r = pg.evaluate('(s) => window.__rstr.photo.pixels(s, "3x")', s)
                nfp += r['items']
                meas += r['measured']
                if r['low']:
                    fail(f'photo 3x {style} {role} {t}: {r["low"]} of {r["masked"]} text pixels over the full-size photo under spec 5 {r["lows"]}', s)
    # and the calm sky and the hills close in (as review R14 S7), so text is measured on the photo, not plated, often
    for k, style in enumerate(STYLES):
        for i in range(3):
            for y in (0, 0.7):
                s = spec(pg, style, FORMATS[(k + i) % 4], 'clean', 'off', 60 + k * 3 + i, {'id': 'full-landscape' if i % 2 else 'full-portrait', 'treatment': 'colour', 'place': {'role': 'ground', 'scale': 2.5, 'x': 0.5, 'y': y}})
                r = pg.evaluate('(s) => window.__rstr.photo.pixels(s, "3x")', s)
                nfp += r['items']
                meas += r['measured']
                if r['low']:
                    fail(f'photo 3x calm {style}: {r["low"]} of {r["masked"]} text pixels over the full-size photo under spec 5 {r["lows"]}', s)
    if meas < 10:
        fail(f'photo 3x: only {meas} text items measured over the full-size photo, want at least 10')
    print(f'photo at 3x over the full-size picture ({info["w"]} x {info["h"]}): {nfp} text items read on pixels ({meas} measured, not plated), none under spec 5; {time.time() - t1:.0f} s')
    print(f'export checks took {time.time() - t0:.0f} s')


def bench(b, url, fail, open_app):
    """The A3 print render in a fresh page: time and peak memory of the renderer (VmHWM, reset first) and the JS heap."""
    from common import idle  # noqa: F401
    pg, errors = open_app(b, url)
    pg.evaluate('() => window.__rstr.photo.full("bench-photo", 4000, 3000, 5)')
    s = spec(pg, 'vapor', 'A', 'grunge', 'full', 40, {'id': 'bench-photo', 'treatment': 'halftone', 'place': {'role': 'ground'}})
    rows = []
    for label, z, bl, k, force in [('A3 print JPEG, one canvas', 'print', False, 'jpeg', None), ('A3 print + bleed PNG, one canvas', 'print', True, 'png', None),
                                   ('A3 print + bleed PNG, strips into PNG', 'print', True, 'png', 'strips-png'), ('A 3x JPEG, one canvas', '3x', False, 'jpeg', None)]:
        procs = renderers()
        before = {p: hwm(p) for p, _ in procs}
        ok = all(reset_hwm(p) for p, _ in procs)
        base = {p: hwm(p) for p, _ in procs}
        t = time.time()
        r = pg.evaluate('([s, z, b, k, f]) => window.__rstr.export.bench(s, z, b, k, f || undefined)', [s, z, bl, k, force])
        wall = time.time() - t
        peak = {kind: max([hwm(p) or 0 for p, kk in procs if kk == kind] or [0]) for kind in ('renderer', 'gpu')}
        base_r = max([base[p] or 0 for p, kk in procs if kk == 'renderer'] or [0])
        rows.append((label, r, peak, base_r, ok, wall))
        print(f'bench {label}: {r["w"]} x {r["h"]}, {r["ms"]:.0f} ms to make and encode ({r["how"]}, {r["strips"]} strips), file {r["bytes"] / 1e6:.1f} MB; renderer peak {peak["renderer"]:.0f} MB resident (from {base_r:.0f} MB at reset{"" if ok else ", peak NOT reset: since the process started"}), GPU process peak {peak["gpu"]:.0f} MB; JS heap after {(r["heap"] or 0) / 1e6:.0f} MB')
        if r['ms'] > 120000:
            fail(f'bench {label}: {r["ms"]:.0f} ms')
    if errors:
        fail('bench page errors: ' + '; '.join(errors[:3]))
    pg.close()
    return rows
