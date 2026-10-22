#!/usr/bin/env python3
"""LIGHT-891: crop + export the Security-cleared photos (AVIF + WebP, desktop + mobile)."""
import glob, hashlib, os, sys, json
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = None
ORIG = 'scratch/orig'
OUT = 'out/photos'
# name: (pexels id, desktop (w,h), mobile (w,h), (cx, cy, z) desktop, (cx, cy, z) mobile)
S = {
 'process-1-context':  ('8470059', (1024,640), (800,600), (.42,.50,.85), (.40,.50,.80)),
 'process-2-scope':    ('3862374', (1024,640), (800,600), (.55,.45,1), (.55,.45,1)),
 'process-3-coordinate':('3862370',(1024,640), (800,600), (.50,.55,.95), (.50,.55,.95)),
 'process-4-prepare':  ('9606949', (1024,640), (800,600), (.60,.50,1), (.62,.50,1)),
 'process-5-install':  ('442151',  (1024,640), (800,600), (.42,.50,1), (.40,.50,.9)),
 'process-6-records':  ('4818711', (1024,640), (800,600), (.50,.50,1), (.50,.50,1)),
 'process-7-handoff':  ('4716292', (1024,640), (800,600), (.40,.50,1), (.40,.50,1)),
 'services-engineering': ('442152', (1536,1024), (780,976), (.72,.55,.58), (.73,.5,1)),
 'service-engineering-page': ('2881232', (1600,1000), (800,1000), (.5,.5,1), (.40,.5,1)),
 'service-datacenter-page': ('19166565', (1600,1000), (800,1000), (.5,.5,1), (.5,.5,1)),
 'service-fusion-page': ('37564550', (1280,800), (640,800), (.5,.5,1), (.45,.5,1)),
 'service-access-left': ('13657444', (800,800), (640,640), (.62,.55,.8), (.62,.55,.8)),
 'service-access-right': ('13422379', (800,800), (640,640), (.36,.55,1), (.36,.55,1)),
 'service-wireless-page': ('6342345', (1600,1000), (800,1000), (.5,.38,1), (.5,.45,1)),
 'service-osp-page': ('5273262', (1600,1000), (800,1000), (.775,.52,.45), (.84,.55,.6)),
 'industry-data-centers': ('4508751', (512,384), (390,330), (.5,.5,1), (.45,.5,1)),
 'industry-distribution-centers': ('36398150', (512,384), (390,330), (.6,.55,1), (.6,.55,1)),
 'industry-commercial-environments': ('8776326', (512,384), (390,330), (.5,.55,1), (.5,.55,1)),
 'industry-healthcare': ('11288653', (512,384), (390,330), (.6,.5,1), (.6,.5,1)),
 'industry-government': ('36900080', (512,384), (390,330), (.5,.55,1), (.5,.55,1)),
 'industry-airports': ('12940671', (512,384), (390,330), (.5,.6,1), (.5,.6,1)),
}
def crop(im, size, cx, cy, z):
    W, H = im.size; ar = size[0]/size[1]
    w = min(W, H*ar); h = w/ar
    w *= z; h *= z
    x = min(max(cx*W - w/2, 0), W-w); y = min(max(cy*H - h/2, 0), H-h)
    return im.crop((round(x), round(y), round(x+w), round(y+h))).resize(size, Image.LANCZOS)
def src(pid):
    return glob.glob(f'{ORIG}/*pexels-{pid}.jpeg')[0]
def load(pid):
    im = ImageOps.exif_transpose(Image.open(src(pid))).convert('RGB')
    return im
def save(im, path):
    im.save(path + '.webp', 'WEBP', quality=80, method=6)
    im.save(path + '.avif', 'AVIF', quality=58, speed=6)
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    for name, (pid, dsz, msz, dc, mc) in S.items():
        if only and name not in only: continue
        if name.startswith('industry-'): continue
        im = load(pid)
        for kind, sz, c in (('desktop', dsz, dc), ('mobile', msz, mc)):
            save(crop(im, sz, *c), f'{OUT}/{name}-{kind}')
    if not only or 'industries-composite' in only:
        tiles = [n for n in S if n.startswith('industry-')]  # order = page order
        for kind, cols, rows, k in (('desktop', 3, 2, 0), ('mobile', 2, 3, 1)):
            tw, th = S[tiles[0]][1 + k]
            canvas = Image.new('RGB', (tw*cols, th*rows), (4, 16, 28))
            for i, n in enumerate(tiles):
                pid, _, _, dc, mc = S[n]
                canvas.paste(crop(load(pid), (tw, th), *(dc, mc)[k]), ((i % cols)*tw, (i//cols)*th))
            from PIL import ImageDraw
            d = ImageDraw.Draw(canvas)
            for c in range(1, cols): d.rectangle((c*tw-1, 0, c*tw, th*rows), fill=(4, 16, 28))
            for r in range(1, rows): d.rectangle((0, r*th-1, tw*cols, r*th), fill=(4, 16, 28))
            save(canvas, f'{OUT}/industries-composite-{kind}')
    print('done')
