"""The specs the finish checks walk, shared by smoke.py and finishbase.py (rows R7, R19).

r7_cases(pg): R7's finish test seeds (every style x format x finish, light and dark, Postmodern in both dialects,
marks on for half, the designs review R7 found broken, and review R17 S6's layer lists), as (finish, spec) pairs.
r19_specs(pg, style): the 100 seeds per style of spec 9.4's finish thresholds (row R19): formats in turn, light and
dark in pairs, marks full on every third, the dialect left to the layout stream.
"""

STYLES = ['swiss', 'pomo', 'brutal', 'vapor']
FORMATS = ['1:1', '3:4', '9:16', 'A']
FINISHES = ['grain', 'grunge', 'vhs', 'glitch']


def r7_cases(pg, finishes=FINISHES):
    cases = []
    for style in STYLES:
        for fmt in FORMATS:
            for fin in finishes:
                for i in range(4):
                    cases.append(('([s, f, i, fin]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = i % 2 ? "dark" : "light"; x.finish = fin; x.marks = i < 2 ? "off" : "full"; x.seeds = {layout: 51 + i, colour: 52 + i, graphic: 53 + i, type: 54 + i}; if (s === "pomo") x.pick.dialect = i % 2 ? "photocopy" : "icecream"; return x; }', [style, fmt, i, fin]))
    found = [('vapor', '9:16', 'dark', 'off', None, {'layout': 1000 + 11 * 7919, 'colour': 2000 + 11 * 104729, 'graphic': 3000 + 11 * 1299709, 'type': 4000 + 11 * 31}),
             ('pomo', '3:4', 'dark', 'light', 'photocopy', {'layout': 8932, 'colour': 106729, 'graphic': 1302709, 'type': 4031})]
    for fin in finishes:
        for st, fm, md, mk, d, seeds in found:
            cases.append(('([s, f, md, mk, d, seeds, fin]) => { const x = window.__rstr.spec(); x.style = s; x.format = f; x.mode = md; x.marks = mk; x.finish = fin; x.seeds = seeds; x.pick = {palette: null, pairing: null, motif: null, layout: null, dialect: d}; x.params = {}; return x; }', [st, fm, md, mk, d, seeds, fin]))
    # review R17 S6: layer lists through every finish, two per style, format and finish
    for style in STYLES:
        for fmt in FORMATS:
            for fin in finishes:
                mfin = fin if fin != 'clean' else 'grain'
                for spec in pg.evaluate('(o) => window.__rstr.specs(o)', {'styles': [style], 'formats': [fmt], 'modes': ['light'] if mfin in ['grain', 'vhs'] else ['dark'], 'n': 2, 'start': 64 + FORMATS.index(fmt) * 2, 'variants': 'cycle', 'layers': True, 'finish': fin, 'marks': 'full' if mfin in ['vhs', 'grunge'] else 'off'}):
                    cases.append(('(s) => s', spec))
    return [pg.evaluate(js, args) for js, args in cases]


R19 = '''([style, n]) => { const out = []; for (let i = 0; i < n; i++) {
  const [x] = window.__rstr.specs({styles: [style], formats: [["1:1", "3:4", "9:16", "A"][i % 4]], modes: [(i >> 2) % 2 ? "dark" : "light"], n: 1, start: 300 + i, variants: "cycle"});
  x.marks = i % 3 === 0 ? "full" : "off"; out.push(x); } return out; }'''


def r19_specs(pg, style, n=100):
    return pg.evaluate(R19, [style, n])
