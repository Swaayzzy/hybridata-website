#!/usr/bin/env python3
"""LIGHT-922: Fusion page + Process 6 photos from Wikimedia Commons (Security-cleared crops, LIGHT-921).
Crop boxes are exact pixel boxes in the original (x0, y0, x1, y1). Crop only, no retouching, never upscaled; same darken/blue
tint as the existing Wikimedia photos (tint.json, see recrop-light911.py). Run from the repo root with originals in scratch/."""
import json
from PIL import Image, ImageOps
OUT = 'out'
def load(path):
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')
def tint(im, M):
    bands = [b.point(lambda v, s=s, t=t: max(0, min(255, round(v * s + t)))) for b, (s, t) in zip(im.split(), M)]
    return Image.merge('RGB', bands)
def save(im, name):
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=80, method=6)
    im.save(f'{OUT}/{name}.avif', 'AVIF', quality=58, speed=6)
M = json.load(open('scratch/tint.json'))
def export(src, box, size, name):
    c = load(src).crop(box)
    assert size[0] <= c.size[0] and size[1] <= c.size[1], (name, c.size, size)  # never upscale
    save(tint(c.resize(size, Image.LANCZOS), M), name)
    print(name, 'crop', c.size, '->', size)
export('scratch/fiber-splice.jpg', (1207, 1229, 2611, 2107), (1280, 800), 'service-fusion-splice-tray-desktop')
export('scratch/fiber-splice.jpg', (1580, 219, 2699, 1619), (640, 800), 'service-fusion-splice-tray-mobile')
export('scratch/otdr1.jpg', (100, 345, 1468, 1200), (1024, 640), 'process-6-otdr-desktop')
export('scratch/otdr1.jpg', (380, 345, 1013, 1136), (633, 791), 'process-6-otdr-mobile')
