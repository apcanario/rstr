"""Helpers shared by sheet.py and tune.py: render a spec to an image, and lay images out in a labelled strip."""
import base64, io
from PIL import Image, ImageDraw


def img(pg, spec):
    r = pg.evaluate('(s) => window.__rstr.exportImage(s, "image/jpeg")', spec)
    return Image.open(io.BytesIO(base64.b64decode(r['url'].split(',')[1]))).convert('RGB')


def strip(rows, h=560, gap=12, label_h=0):
    """rows: list of lists of (image, label)."""
    rows = [[(im.resize((int(im.width * h / im.height), h)), lab) for im, lab in row] for row in rows]
    W = max(sum(i.width + gap for i, _ in row) + gap for row in rows)
    H = len(rows) * (h + gap + 22) + gap
    sh = Image.new('RGB', (W, H), (34, 34, 38))
    d = ImageDraw.Draw(sh)
    y = gap
    for row in rows:
        x = gap
        for im, lab in row:
            sh.paste(im, (x, y))
            d.text((x, y + h + 4), lab, fill=(200, 200, 200))
            x += im.width + gap
        y += h + gap + 22
    return sh
