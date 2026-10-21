#!/usr/bin/env python3
"""Rack section textures (LIGHT-478): Plastic010 and Rubber004 from the Security-passed quarantine (LIGHT-476).

Reads ONLY the Color / NormalGL / Roughness JPGs out of each zip, in memory (never .blend/.usdc/.mtlx/.tres/previews).
Writes 256 px (phones) and 512 px (desktop) WebP into site/assets/3d/rack/. The HDRI and the Metal027 / PaintedMetal004 /
Concrete034 maps are shared with the home bundle (site/assets/3d/home/), so they are not duplicated.
"""
import hashlib, io, os, zipfile
from PIL import Image

Q = os.path.expanduser('~/quarantine-light474')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'site', 'assets', '3d', 'rack')
SETS = {'Plastic010': ['Color', 'NormalGL', 'Roughness'], 'Rubber004': ['Color', 'NormalGL', 'Roughness']}
SIZES = {'s': 256, 'm': 512}
QUAL = {'Color': 72, 'NormalGL': 78, 'Roughness': 70}

for name, maps in SETS.items():
    z = zipfile.ZipFile(os.path.join(Q, 'textures', name + '_1K-JPG.zip'))
    for m in maps:
        im = Image.open(io.BytesIO(z.read('%s_1K-JPG_%s.jpg' % (name, m))))
        for k, px in SIZES.items():
            d = os.path.join(OUT, 'tex' + k); os.makedirs(d, exist_ok=True)
            img = im.convert('L' if m == 'Roughness' else 'RGB').resize((px, px), Image.LANCZOS)
            p = os.path.join(d, '%s_%s.webp' % (name, m))
            img.save(p, 'WEBP', quality=QUAL[m], method=6)
            print('%s  %7d  %s' % (hashlib.sha256(open(p, 'rb').read()).hexdigest(), os.path.getsize(p), os.path.relpath(p, os.path.join(OUT, '..', '..', '..'))))
