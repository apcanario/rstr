"""The reference specs of the spike (docs/archive/spike/shots.py) as v1 specs."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def imul(x, y):
        return ((x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)) & 0xFFFFFFFF

    def r():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return r


def text(kind):
    info = {"on": True, "v": [{"k": "Where", "v": "Lisboa"}, {"k": "When", "v": "23 Nov 2026"}, {"k": "Seed", "v": "0C4F-2A19"}], "pos": None}
    if kind == 'tx' or kind == 'off':
        t = ["Signal and noise", "A modular identity system", "Vol. 01 — generated, not drawn"]
    else:
        t = kind
    out = {"title": {"on": True, "v": t[0], "pos": None}, "subtitle": {"on": True, "v": t[1], "pos": None}, "info": info, "caption": {"on": True, "v": t[2], "pos": None}}
    if kind == 'off':
        for k in out:
            out[k]["on"] = False
    return out


DEFAULT_PAIRING = {p_style: lst[0]['id'] for p_style, lst in json.load(open(os.path.join(os.path.dirname(HERE), 'src', 'data', 'pairings.json')))['pairings'].items()}


def ref_specs():
    data = json.load(open(os.path.join(HERE, 'refs.json')))
    out = []
    for r in data['refs']:
        s = r['s']
        seeds = {"layout": s * 7919 + 1, "colour": s * 104729 + 3, "graphic": s * 1299709 + 5, "type": 1}
        pick = {"palette": None, "pairing": None, "motif": None, "layout": None}
        pick.update(r['pick'])
        if r['style'] == 'brutal':
            pick['pairing'] = 'br-anton' if mulberry32(seeds['layout'])() < 0.5 else 'br-archivo-black'
        else:
            # the spike had one pairing per style; with R3's lists the type seed would choose another (R3)
            pick['pairing'] = DEFAULT_PAIRING[r['style']]
        # R13: the first approved Swiss look had no transform, normal title and no cut-in; pin those
        params = {"layout.transform": "none", "layout.size": "normal", "graphics.cut": 0} if r['style'] == 'swiss' else {}
        spec = {"v": 1, "style": r['style'], "format": r['format'], "mode": r.get("mode", "light"), "finish": "clean", "marks": "off",
                "seeds": seeds, "pick": pick, "params": params, "text": text(r['text'])}
        out.append((r['name'], spec))
    return out
