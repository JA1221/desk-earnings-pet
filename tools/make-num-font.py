# Makes vendor\fonts\QJZNum-<weight>.ttf: Fredoka's digits 0-9 with tabular widths, one static font per weight the
# page uses (400 500 600 700). Fredoka has no tabular figures (no tnum feature: font-variant-numeric:tabular-nums does
# nothing) and its 1 is two thirds as wide as its 2, so a time or an amount changed width every second. In these fonts
# every digit is as wide as the widest one at that weight, its outline centred in it. base.css puts the family
# ("QJZ Num", unicode-range the digits only) before Fredoka: the digits come from here, everything else from Fredoka.
# The output is committed (the build needs no Python); run again only when Fredoka-Variable.ttf changes:
#   python tools\make-num-font.py            (fontTools 4.x)
# A Modified Version under the SIL Open Font License 1.1 (vendor\fonts\OFL.txt), as Fredoka itself: Fredoka declares
# no Reserved Font Name; the new family name is its own all the same.
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'vendor', 'fonts', 'Fredoka-Variable.ttf')
DIGITS = '0123456789'
WEIGHTS = (400, 500, 600, 700)


def make(weight):
    f = instancer.instantiateVariableFont(TTFont(SRC), {'wght': weight, 'wdth': 100})
    opts = subset.Options()
    opts.layout_features = []          # no kerning, no ligatures: a digit is a digit
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=[ord(c) for c in DIGITS])
    s.subset(f)
    cmap, hmtx, glyf = f.getBestCmap(), f['hmtx'], f['glyf']
    names = [cmap[ord(c)] for c in DIGITS]
    width = max(hmtx[g][0] for g in names)
    for g in names:
        adv, lsb = hmtx[g]
        dx = int(round((width - adv) / 2.0))
        gl = glyf[g]
        if dx and gl.numberOfContours:
            gl.coordinates.translate((dx, 0))
            gl.recalcBounds(glyf)
        hmtx[g] = (width, lsb + dx)
    f['hhea'].advanceWidthMax = max(f['hhea'].advanceWidthMax, width)
    fam = 'QJZ Num'
    sub = {400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold'}[weight]
    name = f['name']
    for rec in list(name.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 25):
            name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, fam + (' ' + sub if sub not in ('Regular', 'Bold') else '')), (2, sub if sub in ('Regular', 'Bold') else 'Regular'),
                     (3, 'QJZNum-' + str(weight)), (4, fam + ' ' + sub), (6, 'QJZNum-' + sub), (16, fam), (17, sub)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    f['OS/2'].usWeightClass = weight
    out = os.path.join(ROOT, 'vendor', 'fonts', 'QJZNum-%d.ttf' % weight)
    f.save(out)
    return out, width, os.path.getsize(out)


if __name__ == '__main__':
    for w in WEIGHTS:
        print('%s  digit width %d  %d bytes' % make(w))
