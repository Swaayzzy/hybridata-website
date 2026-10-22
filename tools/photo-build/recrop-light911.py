#!/usr/bin/env python3
"""LIGHT-911: Process 4 photo, OSP 'pathway' re-crop, services-engineering mobile re-crop.
Boxes are in a 1400px-wide reference frame of each original (x0, y0, x1, y1)."""
import glob, json
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = None
OUT = 'out'
def load(path):
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')
def ref_crop(im, box, size):
    k = im.size[0] / 1400
    return im.crop(tuple(round(v * k) for v in box)).resize(size, Image.LANCZOS)
def save(im, name):
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=80, method=6)
    im.save(f'{OUT}/{name}.avif', 'AVIF', quality=58, speed=6)
def tint(im, M):  # same darken/blue tint as the existing Wikimedia photo set
    bands = [b.point(lambda v, s=s, t=t: max(0, min(255, round(v * s + t)))) for b, (s, t) in zip(im.split(), M)]
    return Image.merge('RGB', bands)
reel = load(glob.glob('orig/*pexels-35226802.jpeg')[0])
save(ref_crop(reel, (640, 180, 1400, 655), (1024, 640)), 'process-4-prepare-desktop')
save(ref_crop(reel, (640, 140, 1400, 710), (800, 600)), 'process-4-prepare-mobile')
M = json.load(open('tint.json'))
osp = load('orig/acutech.jpg')
save(tint(ref_crop(osp, (470, 470, 1400, 1051), (1024, 640)), M), 'pathway-desktop')
save(tint(ref_crop(osp, (640, 470, 1104, 1050), (614, 768)), M), 'pathway-mobile')
eng = load(glob.glob('orig/*pexels-442152.jpeg')[0])
save(ref_crop(eng, (1010, 230, 1400, 717), (780, 976)), 'services-engineering-mobile')
