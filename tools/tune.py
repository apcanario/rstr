"""The tuning pass of row R5: python3 tools/tune.py [style] [n]. Builds nothing: run `vite build` first (npm run
sheet or smoke does). Shuffles n designs of a style across the three formats with the real fonts, prints the ones
the rules of proof.clumsyOf flag, each with its spec, and writes shots/tune-<style>.jpg of the first 24 flagged.
The rules only find candidates; whether a design is clumsy is for a person to say (spec 9.5)."""
import json, os, sys
from common import ROOT, browser, open_app, served
from sheet_lib import img, strip

style = sys.argv[1] if len(sys.argv) > 1 else 'swiss'
n = int(sys.argv[2]) if len(sys.argv) > 2 else 300
with served() as url, browser() as b:
    pg, errors = open_app(b, url)
    r = pg.evaluate('([s, n]) => window.__rstr.proof.tune(s, n)', [style, n])
    print(f'tune {style}: {r["count"]} designs, {len(r["flagged"])} flagged; by rule {json.dumps(r["byRule"])}')
    for f in r['flagged']:
        print(f'  {f["spec"]["format"]:4} {f["spec"]["mode"]:5} {f["frame"]:13} {f["transform"]:7} {"+".join(f["graphics"][:3]):24} {f["palette"]:8} {"; ".join(f["why"])}')
        print('    spec:', json.dumps({'format': f['spec']['format'], 'mode': f['spec']['mode'], 'seeds': f['spec']['seeds']}))
    cells = [(img(pg, f['spec']), f'{f["frame"]} {f["transform"]} {"; ".join(f["why"])}') for f in r['flagged'][:24]]
    if cells:
        os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
        strip([cells[i:i + 8] for i in range(0, len(cells), 8)], h=420).save(os.path.join(ROOT, 'shots', f'tune-{style}.jpg'), quality=85)
        print(f'wrote shots/tune-{style}.jpg')
    if errors:
        print('page errors:', errors)
        sys.exit(1)
