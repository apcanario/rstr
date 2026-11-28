"""Row R19: measure the finishes of a build on the seeds of spec 9.4 and of R7's finish tests.

    python3 tools/finishbase.py OUT.json [--bench] [--n=100] [--no-hashes]

Run on the R7 build (commit e41f8ef, with src/engine/finishstats.ts and its line in src/api.ts laid in) it wrote
tests/fixtures/finish-r7.json: per style, per seed, each finish's change against Clean (finishstats.ts), and the
pixel hash of every Glitch case of R7's finish tests. `--bench` also times the 9:16 export of every finish and
style (median of three) and one 3:4 Grunge render under a 4x CPU throttle.
"""
import json, sys, time
from common import browser, open_app, served
from finishcases import STYLES, r7_cases, r19_specs

out, bench = sys.argv[1], '--bench' in sys.argv
N = next((int(a[4:]) for a in sys.argv if a.startswith('--n=')), 100)
HASHES = '--no-hashes' not in sys.argv
res = {'styles': {}, 'glitch': [], 'bench': {}}
with served() as url, browser() as b:
    pg, errors = open_app(b, url)
    t0 = time.time()
    for style in (STYLES if N else []):
        per = {f: [] for f in ['grain', 'grunge', 'vhs', 'glitch']}
        items = []
        for spec in r19_specs(pg, style, N):
            r = pg.evaluate('(s) => window.__rstr.finishStats(s)', spec)
            items.append(r['items'])
            for f, st in r['stats'].items():
                per[f].append({k: (round(v, 5) if isinstance(v, float) else v) for k, v in st.items() if k != 'hash'})
        res['styles'][style] = {'items': items, **per}
        m = lambda f, k: sum(x[k] for x in per[f]) / len(per[f])
        print(f'{style:6} grain {m("grain", "mean"):5.2f}  grunge {m("grunge", "mean"):5.2f} (mid {m("grunge", "mid"):.3f} rest {m("grunge", "rest"):.3f})  vhs outside {m("vhs", "outside"):5.2f}  glitch {m("glitch", "mean"):5.2f}  ({time.time() - t0:.0f} s)', flush=True)
    for spec in (r7_cases(pg, ['glitch']) if HASHES else []):
        res['glitch'].append(pg.evaluate('(s) => window.__rstr.pixels(s)', spec))
    print(f'glitch hashes: {len(res["glitch"])}', flush=True)
    if bench:
        for fin in ['clean', 'grain', 'grunge', 'vhs', 'glitch']:
            for style, d in [('swiss', None), ('pomo', 'icecream'), ('pomo', 'photocopy'), ('brutal', None), ('vapor', None)]:
                spec = pg.evaluate('([s, d, fin]) => { const x = window.__rstr.spec(); x.style = s; x.format = "9:16"; x.finish = fin; x.marks = "full"; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; if (d) x.pick.dialect = d; return x; }', [style, d, fin])
                runs = sorted([pg.evaluate('(s) => window.__rstr.bench(s)', spec)['total'] for _ in range(3)])
                res['bench'][f'{fin} {style} {d or ""}'.strip()] = round(runs[1])
                print(f'export 9:16 {fin:6} {style:6} {d or "":9} {runs[1]:6.0f} ms', flush=True)
        cdp = pg.context.new_cdp_session(pg)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        try:
            spec = pg.evaluate('() => { const x = window.__rstr.spec(); x.format = "3:4"; x.finish = "grunge"; x.seeds = {layout: 7, colour: 8, graphic: 9, type: 10}; return x; }')
            t = pg.evaluate('(s) => window.__rstr.bench(s)', spec)['total']
            res['bench']['throttle4 3:4 grunge'] = round(t)
            print(f'4x throttle 3:4 grunge one render {t:.0f} ms', flush=True)
        finally:
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    if errors:
        print('page errors:', errors[:3])
with open(out, 'w') as f:
    json.dump(res, f, separators=(',', ':'))
print('wrote', out)
