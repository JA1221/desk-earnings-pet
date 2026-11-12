"""Per-pixel analysis of a verify.ps1 run (needs Python 3 + Pillow + numpy). See README.md.
usage: python -I analyze.py <run dir> <backdrop x> <backdrop y> <scale> <out dir> <prefix>
Writes <out dir>/<prefix>-over-wallpaper.png and <prefix>-zoom-*.png; prints the numbers.
Region coordinates are spike.html CSS px.
"""
import os, re, sys
import numpy as np
from PIL import Image

run, bdx, bdy, scale, outdir, prefix = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4]), sys.argv[5], sys.argv[6]
res = open(os.path.join(run, 'result.txt'), encoding='utf-8', errors='replace').read()
wx, wy, ww, wh = map(int, re.search(r'RECT (-?\d+) (-?\d+) (\d+) (\d+)', res).groups())
ox, oy = wx - bdx, wy - bdy   # window origin inside the captures

base = np.asarray(Image.open(os.path.join(run, 'base.png')).convert('RGB')).astype(int)
over = np.asarray(Image.open(os.path.join(run, 'over.png')).convert('RGB')).astype(int)

def box(cx0, cy0, cx1, cy1):
    """CSS box -> slice into the capture."""
    return (slice(oy + int(cy0 * scale), oy + int(cy1 * scale)), slice(ox + int(cx0 * scale), ox + int(cx1 * scale)))

def changed(region):
    d = np.abs(over[region] - base[region]).max(axis=2)
    return int((d > 0).sum()), int(d.size), int(d.max())

print('window rect', wx, wy, ww, wh, 'expected size', round(520 * scale), round(340 * scale))
print('--- transparent regions (changed pixels / total / max channel diff): expect 0 changed')
for name, b in [('top-left corner', (0, 0, 10, 10)), ('gap card|pet', (274, 20, 286, 200)),
                ('below card shadow', (160, 207, 280, 232)), ('bottom-right', (410, 225, 515, 335)),
                ('right of P0', (505, 0, 520, 340))]:
    print('  %-18s %s' % (name, changed(box(*b))))
print('--- opaque regions: expect all changed')
for name, b in [('card interior', (30, 30, 250, 60)), ('P0 belly', (380, 140, 410, 160))]:
    print('  %-18s %s' % (name, changed(box(*b))))

# Fringe test on the soft glow (un-outlined, alpha 0..0.95). For each pixel fit out = a*G + (1-a)*U with
# U = the real background (true per-pixel alpha) or U = a colour key (colour-key fringe).
G = np.array([255, 200, 87]); K = np.array([61, 44, 37])
sl = box(176, 236, 268, 328)
o, b = over[sl].reshape(-1, 3), base[sl].reshape(-1, 3)
def fit(under):
    d = G - under
    a = np.clip(((o - under) * d).sum(1) / np.maximum((d * d).sum(1), 1), 0, 1)
    pred = a[:, None] * G + (1 - a[:, None]) * under
    return np.abs(pred - o).mean(), a
err_bg, a_bg = fit(b)
err_key, _ = fit(np.broadcast_to(K, o.shape))
print('--- glow fringe model fit (mean abs error, lower = better): over-background %.2f  over-key-colour %.2f  semi-transparent px %d'
      % (err_bg, err_key, ((a_bg > 0.05) & (a_bg < 0.9)).sum()))

def zoom(name, b, f=4):
    s = box(*b)
    im = Image.fromarray(over[s].astype('uint8')).resize(((s[1].stop - s[1].start) * f, (s[0].stop - s[0].start) * f), Image.NEAREST)
    p = os.path.join(outdir, '%s-zoom-%s.png' % (prefix, name))
    im.save(p)
    print('zoom', p)
zoom('glow-s4', (20, 210, 280, 336), 3)
zoom('p0-ear', (300, 8, 420, 90), 4)
zoom('card-corner', (200, 150, 290, 215), 4)
p = os.path.join(outdir, '%s-over-wallpaper.png' % prefix)
Image.fromarray(over[max(oy - 40, 0):oy + wh + 40, max(ox - 40, 0):ox + ww + 40].astype('uint8')).save(p)
print('window over wallpaper', p)
