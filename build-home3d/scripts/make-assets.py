#!/usr/bin/env python3
"""Make the shipped derivatives from the Security-passed quarantine (LIGHT-476).

Reads ONLY the Color / NormalGL / Roughness / Metalness JPGs out of each zip, in memory.
Never extracts .blend / .usdc / .mtlx / .tres / .png preview files. Writes WebP maps and
two small RGBE environment maps, then prints SHA-256 for LICENSES.md.
"""
import hashlib, io, math, os, zipfile
from PIL import Image

Q = os.path.expanduser('~/quarantine-light474')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'site', 'assets', '3d', 'home')
SETS = {  # set -> maps used
    'Asphalt031': ['Color', 'NormalGL', 'Roughness'],
    'Concrete034': ['Color', 'NormalGL', 'Roughness'],
    'Metal027': ['Color', 'NormalGL', 'Roughness', 'Metalness'],
    'PaintedMetal004': ['Color', 'NormalGL', 'Roughness', 'Metalness'],
}
SIZES = {'s': 256, 'm': 512}  # s = phones, m = desktop
QUAL = {'Color': 72, 'NormalGL': 78, 'Roughness': 70, 'Metalness': 70}

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def textures():
    rows = []
    for name, maps in SETS.items():
        z = zipfile.ZipFile(os.path.join(Q, 'textures', name + '_1K-JPG.zip'))
        for m in maps:
            member = '%s_1K-JPG_%s.jpg' % (name, m)
            im = Image.open(io.BytesIO(z.read(member)))
            for k, px in SIZES.items():
                d = os.path.join(OUT, 'tex' + k)
                os.makedirs(d, exist_ok=True)
                img = im.convert('L' if m in ('Roughness', 'Metalness') else 'RGB').resize((px, px), Image.LANCZOS)
                p = os.path.join(d, '%s_%s.webp' % (name, m))
                img.save(p, 'WEBP', quality=QUAL[m], method=6)
                rows.append((os.path.relpath(p, os.path.join(OUT, '..', '..', '..')), os.path.getsize(p), sha(p)))
    return rows

def read_rgbe(path):
    """Decode Radiance RGBE (new-style RLE) into rows of linear [r,g,b] floats (pure Python)."""
    f = open(path, 'rb')
    while True:
        l = f.readline()
        if l.startswith(b'-Y') or l.startswith(b'+Y'):
            _, h, _, w = l.split(); h = int(h); w = int(w); break
    rows = []
    for y in range(h):
        a, b, c, d = f.read(4)
        planes = [bytearray(w) for _ in range(4)]
        if a == 2 and b == 2 and (c << 8 | d) == w:
            for ch in range(4):
                x = 0
                while x < w:
                    n = f.read(1)[0]
                    if n > 128:
                        n -= 128; planes[ch][x:x + n] = bytes([f.read(1)[0]]) * n
                    else:
                        planes[ch][x:x + n] = f.read(n)
                    x += n
        else:
            raise SystemExit('flat RGBE not expected')
        row = []
        for x in range(w):
            e = planes[3][x]
            s = 0.0 if e == 0 else math.ldexp(1.0, e - 136)
            row.append((planes[0][x] * s, planes[1][x] * s, planes[2][x] * s))
        rows.append(row)
    return rows

def write_rgbe(path, rows):
    h, w = len(rows), len(rows[0])
    buf = bytearray()
    for row in rows:
        for r, g, b in row:
            m = max(r, g, b)
            if m < 1e-32:
                buf += b'\0\0\0\0'
            else:
                mant, ex = math.frexp(m)
                f = mant * 256.0 / m
                buf += bytes((min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)), ex + 128))
    with open(path, 'wb') as o:
        o.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (h, w))
        o.write(bytes(buf))

def hdri():
    src = os.path.join(Q, 'hdri', 'studio_small_09_1k.hdr')
    img = read_rgbe(src)
    H, W = len(img), len(img[0])
    rows = []
    for k, (w, h) in {'s': (256, 128), 'm': (512, 256)}.items():
        fy, fx = H // h, W // w
        small = []
        for y in range(h):
            row = []
            for x in range(w):
                r = g = b = 0.0
                for yy in range(y * fy, (y + 1) * fy):
                    line = img[yy]
                    for xx in range(x * fx, (x + 1) * fx):
                        p = line[xx]; r += p[0]; g += p[1]; b += p[2]
                n = fx * fy
                row.append((r / n, g / n, b / n))
            small.append(row)
        d = os.path.join(OUT, 'env'); os.makedirs(d, exist_ok=True)
        p = os.path.join(d, 'studio_small_09_%dx%d.hdr' % (w, h))
        write_rgbe(p, small)
        rows.append((os.path.relpath(p, os.path.join(OUT, '..', '..', '..')), os.path.getsize(p), sha(p)))
    return rows

if __name__ == '__main__':
    rows = hdri() + textures()
    tot = {'s': 0, 'm': 0}
    for r in rows:
        print('%s  %7d  %s' % (r[2], r[1], r[0]))
        if '/texs/' in r[0] or '256x128' in r[0]: tot['s'] += r[1]
        if '/texm/' in r[0] or '512x256' in r[0]: tot['m'] += r[1]
    print('phone assets (tex s + env 256):', tot['s'], ' desktop (tex m + env 512):', tot['m'])
