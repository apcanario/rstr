"""Row R19: measure the finishes of a build on the seeds of spec 9.4 and of R7's finish tests.

    python3 tools/finishbase.py OUT.json [--bench] [--n=100] [--no-hashes] [--keep]

Writes OUT in the format of tests/fixtures/finish-r7.json, which smoke.py reads (review R19 S2):
- `styles`: per style, per seed of finishcases.r19_specs, the text items and each finish's change against Clean
  (finishstats.ts): `grain`, `grunge`, `glitch` the mean over the page, `vhs` the mean outside the held text,
  `grungeMid` and `grungeRest` the shares of pixels past 24 levels inside and outside the middle; `restored` per
  finish, the items the guard put back;
- `glitch`: the pixel hash of every Glitch case of R7's finish tests (finishcases.r7_cases);
- with `--bench`, `bench`: the 9:16 export time of every finish and style (median of three, ms) and one 3:4 Grunge
  render under a 4x CPU throttle (`throttle4 3:4 grunge`); every bench run is also kept, in order, in `benchRuns`.
`--keep` merges into an existing OUT: what this run measured replaces, the rest is kept, and a bench run is added
to `benchRuns` (and becomes `bench`, the figures smoke.py compares with).

Run on the R7 build (commit e41f8ef, with src/engine/finishstats.ts and its line in src/api.ts laid in), first with
`--bench` and then with `--n=0 --no-hashes --bench --keep`, it wrote tests/fixtures/finish-r7.json (27 Nov 2026).
"""
import json, os, sys, time
from common import browser, open_app, served
from finishcases import STYLES, r7_cases, r19_specs

FINS = ['grain', 'grunge', 'vhs', 'glitch']


def fixture_style(items, per):
    """One style's raw finishStats per seed (per[finish] = [stat, ...]) as the fixture holds it."""
    r = lambda v, n: round(v, n)
    return {'items': items,
            'grain': [r(x['mean'], 3) for x in per['grain']],
            'grunge': [r(x['mean'], 3) for x in per['grunge']],
            'grungeMid': [r(x['mid'], 4) for x in per['grunge']],
            'grungeRest': [r(x['rest'], 4) for x in per['grunge']],
            'vhs': [r(x['outside'], 3) for x in per['vhs']],
            'glitch': [r(x['mean'], 3) for x in per['glitch']],
            'restored': {f: [x['restored'] for x in per[f]] for f in FINS}}


def main():
    out, bench = sys.argv[1], '--bench' in sys.argv
    N = next((int(a[4:]) for a in sys.argv if a.startswith('--n=')), 100)
    HASHES = '--no-hashes' not in sys.argv
    res = json.load(open(out)) if '--keep' in sys.argv and os.path.exists(out) else {}
    res.setdefault('source', 'measured by tools/finishbase.py in headless Chrome')
    if N:
        res['seeds'] = f'tools/finishcases.py r19_specs: {N} per style'
        res['styles'] = {}
    with served() as url, browser() as b:
        pg, errors = open_app(b, url)
        t0 = time.time()
        for style in (STYLES if N else []):
            per = {f: [] for f in FINS}
            items = []
            for spec in r19_specs(pg, style, N):
                r = pg.evaluate('(s) => window.__rstr.finishStats(s)', spec)
                items.append(r['items'])
                for f, st in r['stats'].items():
                    per[f].append(st)
            res['styles'][style] = fixture_style(items, per)
            m = lambda f, k: sum(x[k] for x in per[f]) / len(per[f])
            print(f'{style:6} grain {m("grain", "mean"):5.2f}  grunge {m("grunge", "mean"):5.2f} (mid {m("grunge", "mid"):.3f} rest {m("grunge", "rest"):.3f})  vhs outside {m("vhs", "outside"):5.2f}  glitch {m("glitch", "mean"):5.2f}  ({time.time() - t0:.0f} s)', flush=True)
        if HASHES:
            res['glitch'] = [pg.evaluate('(s) => window.__rstr.pixels(s)', spec) for spec in r7_cases(pg, ['glitch'])]
            print(f'glitch hashes: {len(res["glitch"])}', flush=True)
        if bench:
            fig = {}
            for fin in ['clean', 'grain', 'grunge', 'vhs', 'glitch']:
                for style, d in [('swiss', None), ('pomo', 'icecream'), ('pomo', 'photocopy'), ('brutal', None), ('vapor', None)]:
                    spec = pg.evaluate('([s, d, fin]) => { const x = window.__rstr.spec(); x.style = s; x.format = "9:16"; x.finish = fin; x.marks = "full"; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; if (d) x.pick.dialect = d; return x; }', [style, d, fin])
                    runs = sorted([pg.evaluate('(s) => window.__rstr.bench(s)', spec)['total'] for _ in range(3)])
                    fig[f'{fin} {style} {d or ""}'.strip()] = round(runs[1])
                    print(f'export 9:16 {fin:6} {style:6} {d or "":9} {runs[1]:6.0f} ms', flush=True)
            cdp = pg.context.new_cdp_session(pg)
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
            try:
                spec = pg.evaluate('() => { const x = window.__rstr.spec(); x.format = "3:4"; x.finish = "grunge"; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; return x; }')
                t = pg.evaluate('(s) => window.__rstr.bench(s)', spec)['total']
                fig['throttle4 3:4 grunge'] = round(t)
                print(f'4x throttle 3:4 grunge one render {t:.0f} ms', flush=True)
            finally:
                cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
            res['bench'] = fig
            res.setdefault('benchRuns', []).append({'when': time.strftime('%d %b %Y %H:%M UTC', time.gmtime()), 'bench': fig})
        if errors:
            print('page errors:', errors[:3])
    with open(out, 'w') as f:
        json.dump(res, f, separators=(',', ':'))
    print('wrote', out)


if __name__ == '__main__':
    main()
