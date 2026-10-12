#!/usr/bin/env python3
"""Regenerates every How We Build drawing from the generators.

  python3 scripts/hwb/build.py            # writes the 4 stills and replaces both inline SVGs in how-we-build.html
  python3 scripts/hwb/build.py --check    # label bounding-box check only (no files written)

Run from anywhere. Never hand-edit the output SVGs; edit gen_home.py / gen_rack.py / lib25.py and re-run.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
SITE = os.path.normpath(os.path.join(HERE, '..', '..', 'site'))

import gen_home
import gen_rack


def main():
    check_only = '--check' in sys.argv
    report = []
    out = {}
    for tag, mod, names in (('home', gen_home, ('home-stage8', 'hs8')), ('rack', gen_rack, ('rack-step6', 'rk'))):
        for narrow in (False, True):
            s, rep = mod.svg('still', narrow, ids=(names[1] + '-t', names[1] + '-d'))
            out[names[0] + ('-narrow' if narrow else '') + '.svg'] = s
    home_player, rep_h = gen_home.svg('player')
    rack_player, rep_r = gen_rack.svg('player')
    for r in rep_h + rep_r:
        print('label check:', r)
    if check_only:
        return
    for name, s in out.items():
        with open(os.path.join(SITE, 'assets', 'hwb', name), 'w') as fh:
            fh.write('<?xml version="1.0" encoding="UTF-8"?>\n' + s + '\n')
    p = os.path.join(SITE, 'how-we-build.html')
    h = open(p).read()
    svgs = re.findall(r'<svg class="(?:bld-svg bld|rack-svg rack)".*?</svg>', h, flags=re.S)
    assert len(svgs) == 2, len(svgs)
    h = h.replace(svgs[0], home_player).replace(svgs[1], rack_player)
    open(p, 'w').write(h)
    print('wrote', ', '.join(out), 'and how-we-build.html')


if __name__ == '__main__':
    main()
