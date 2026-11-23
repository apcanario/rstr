"""tools/fetch_fonts.py: every font of every pairing, for the APK build (spec 6).

Reads src/data/pairings.json, asks Google Fonts' css2 API for exactly the faces each family is used with
(the same URLs the web app builds, src/fontcss.ts), downloads the latin and latin-ext woff2 files, and writes:

  <out>/<file>.woff2      the font files
  <out>/manifest.json     {"faces": [{"family", "weight", "italic", "file", "range"}]}, one entry per file
                          (latin and latin-ext of each face); the app reads
                          fonts/gf/manifest.json and then loads every face from there, not from Google
  <out>/LICENSES.txt      public/LICENSES.txt (the bundled core set) plus the licence of every family
                          fetched, from github.com/google/fonts

Usage:
  python3 tools/fetch_fonts.py [--out public/fonts/gf]   download everything
  python3 tools/fetch_fonts.py --check                   only check that every family and face resolves
  python3 tools/fetch_fonts.py --urls                    print the css2 URLs, no network

The APK build runs it with --out pointing at the app's public/fonts/gf before building, then ships
<out>/LICENSES.txt as public/LICENSES.txt. Needs fonts.googleapis.com, fonts.gstatic.com and
raw.githubusercontent.com. Exit status 1 if anything does not resolve; it never invents a substitute.
"""
import argparse, json, os, re, sys, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data', 'pairings.json')
CSS_HOST = 'https://fonts.googleapis.com'
# css2 serves woff2 to a browser that says it takes it
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
KEEP = {'latin', 'latin-ext', ''}
LICENCE_DIRS = [('ofl', 'OFL.txt'), ('apache', 'LICENSE.txt'), ('ufl', 'UFL.txt')]
ROLES = ['display', 'text', 'label', 'serif', 'mono', 'pixel']


def families(data):
    """{family: set of (weight, italic)} over every pairing; aliases keep their own name."""
    out = {}
    for lst in data['pairings'].values():
        for p in lst:
            for r in ROLES:
                f = p.get(r)
                if f:
                    out.setdefault(f['family'], set()).add((f['weight'], bool(f.get('italic'))))
    return out


def css_url(family, faces, sources):
    """The same URL as src/fontcss.ts cssUrl."""
    src = sources.get(family)
    real = src['family'] if src else family
    wdth = src.get('wdth') if src else None
    ital = any(it for _, it in faces)
    tuples = sorted({tuple(([1 if it else 0] if ital else []) + ([wdth] if wdth is not None else []) + [w]) for w, it in faces})
    axes = ','.join((['ital'] if ital else []) + (['wdth'] if wdth is not None else []) + ['wght'])
    body = ';'.join(','.join(str(x) for x in t) for t in tuples)
    return f'{CSS_HOST}/css2?family={urllib.parse.quote(real).replace("%20", "+")}:{axes}@{body}&display=block', real


def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode('utf8')


def parse_css(css):
    """The same rules as src/fontcss.ts parseCss: subset, style, weight, url, range."""
    out = []
    for m in re.finditer(r'(?:/\*\s*([^*]*?)\s*\*/\s*)?@font-face\s*\{([^}]*)\}', css):
        body = m.group(2)
        g = lambda k: (re.search(k + r'\s*:\s*([^;]+);?', body) or [None, None])[1]
        u = re.search(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", g('src') or '')
        if not u:
            continue
        sub = (m.group(1) or '').strip()
        out.append({'subset': 'n' if re.fullmatch(r'\[\d+\]', sub) else sub, 'italic': (g('font-style') or '').strip() == 'italic',
                    'weight': int((g('font-weight') or '400').split()[0]), 'url': u.group(1), 'range': (g('unicode-range') or '').strip()})
    return out


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def licence(real):
    d = re.sub(r'[^a-z0-9]', '', real.lower())
    for folder, name in LICENCE_DIRS:
        try:
            return get(f'https://raw.githubusercontent.com/google/fonts/main/{folder}/{d}/{name}')
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
    raise RuntimeError(f'no licence found for {real} in google/fonts')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'fonts', 'gf'))
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--urls', action='store_true')
    a = ap.parse_args()
    data = json.load(open(DATA, encoding='utf8'))
    fams = families(data)
    sources = data.get('sources', {})
    if a.urls:
        for fam, faces in sorted(fams.items()):
            print(fam, css_url(fam, faces, sources)[0])
        return 0
    bad, manifest, licences = [], [], {}
    if not a.check:
        os.makedirs(a.out, exist_ok=True)
    for fam, faces in sorted(fams.items()):
        url, real = css_url(fam, faces, sources)
        try:
            rules = parse_css(get(url))
        except Exception as e:  # noqa: BLE001 - report and go on, so one run lists every problem
            bad.append(f'{fam}: {url} -> {e}')
            print('FAIL', bad[-1])
            continue
        for w, it in sorted(faces):
            mine = [r for r in rules if r['weight'] == w and r['italic'] == it]
            kept = [r for r in mine if r['subset'] in KEEP] or mine
            if not kept:
                bad.append(f'{fam} {w}{" italic" if it else ""}: not in the css2 response')
                print('FAIL', bad[-1])
                continue
            for r in kept:
                name = f'{slug(fam)}-{w}-{"italic" if it else "normal"}-{slug(r["subset"] or "all")}.woff2'
                try:
                    body = get(r['url'], binary=True)
                except Exception as e:  # noqa: BLE001
                    bad.append(f'{fam} {w}: {r["url"]} -> {e}')
                    print('FAIL', bad[-1])
                    continue
                if not a.check:
                    with open(os.path.join(a.out, name), 'wb') as f:
                        f.write(body)
                    manifest.append({'family': fam, 'weight': w, 'italic': it, 'file': name, 'range': r['range']})
        print('ok  ', fam, sorted(faces))
        if not a.check and real not in licences:
            try:
                licences[real] = licence(real)
            except Exception as e:  # noqa: BLE001
                bad.append(f'{real}: licence -> {e}')
                print('FAIL', bad[-1])
    if not a.check:
        json.dump({'faces': manifest}, open(os.path.join(a.out, 'manifest.json'), 'w'), indent=1)
        core = open(os.path.join(ROOT, 'public', 'LICENSES.txt'), encoding='utf8').read()
        with open(os.path.join(a.out, 'LICENSES.txt'), 'w', encoding='utf8') as f:
            f.write(core.rstrip() + '\n\nFonts fetched for the APK by tools/fetch_fonts.py, from Google Fonts. Licence texts from github.com/google/fonts.\n')
            for real, text in sorted(licences.items()):
                f.write(f'\n{"=" * 64}\n{real}\n{"=" * 64}\n{text.strip()}\n')
        print(f'wrote {len(manifest)} files, manifest and LICENSES.txt to {a.out}')
    print(f'{len(fams)} families, {sum(len(v) for v in fams.values())} faces, {len(bad)} problems')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
