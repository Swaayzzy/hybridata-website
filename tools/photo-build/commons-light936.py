#!/usr/bin/env python3
"""LIGHT-936: Services card 03 photo from Wikimedia Commons (Fujikura-Fusion Splicer 70S-Splice-01ASD, Asurnipal, CC BY-SA 4.0).
Crop boxes are Security's cleared boxes (LIGHT-921), exact pixel boxes in the original (x0, y0, x1, y1). Crop only, no retouching,
never upscaled; same darken/blue tint as the existing Wikimedia photos (scratch/tint.json, see commons-light922.py).
Run from the repo root with the original in scratch/splicer.jpg."""
import json
from PIL import Image, ImageOps
OUT = 'out'
def save(im, name):
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=80, method=6)
    im.save(f'{OUT}/{name}.avif', 'AVIF', quality=58, speed=6)
M = json.load(open('scratch/tint.json'))
def tint(im):
    return Image.merge('RGB', [b.point(lambda v, s=s, t=t: max(0, min(255, round(v * s + t)))) for b, (s, t) in zip(im.split(), M)])
src = ImageOps.exif_transpose(Image.open('scratch/splicer.jpg')).convert('RGB')
for box, size, name in (((640, 660, 2544, 1850), (1024, 640), 'service-fusion-splicer-desktop'),
                        ((1350, 660, 2302, 1850), (546, 683), 'service-fusion-splicer-mobile')):
    c = src.crop(box)
    assert size[0] <= c.size[0] and size[1] <= c.size[1], (name, c.size, size)  # never upscale
    save(tint(c.resize(size, Image.LANCZOS)), name)
    print(name, 'box', box, 'crop', c.size, '->', size)
