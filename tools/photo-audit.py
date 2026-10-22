#!/usr/bin/env python3
"""Duplicate-photo audit for the redesign preview (LIGHT-888 / LIGHT-889).

For each version (a, b) it finds every photo used on every page (<img> and
<source> in assets/, logo/favicon/share image excluded), hashes each file with
sha256 (exact) and a 64-bit DCT pHash (perceptual, distance <= 8 counts as the
same photo, so different crops of one photo are caught), and prints:
  1. photo -> every page/slot it appears on
  2. repeats (photos on more than one slot)
Files inside one <picture> (desktop/mobile, avif/webp) are one photo.
Exit status 1 if any version has a photo on more than one slot.

Usage: tools/photo-audit.py [--root .] [--versions a b] [--max-dist 8]
Needs Pillow (with AVIF support for .avif; .webp is used otherwise).
"""
import argparse, hashlib, math, os, re, sys
from html.parser import HTMLParser
from PIL import Image

EXEMPT = ("logo", "favicon", "share")


class Pics(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pics, self.cur, self.n = [], None, 0

    def _add(self, url):
        if url and "assets/" in url and not any(x in os.path.basename(url) for x in EXEMPT) \
                and re.search(r"\.(avif|webp|jpe?g|png)$", url.split("?")[0]):
            (self.cur if self.cur is not None else self.pics_new()).append(url.split("?")[0])

    def pics_new(self):
        self.n += 1
        self.pics.append([])
        return self.pics[-1]

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "picture":
            self.n += 1
            self.cur = []
            self.pics.append(self.cur)
        elif tag in ("img", "source"):
            if a.get("src"):
                self._add(a["src"])
            for part in (a.get("srcset") or "").split(","):
                if part.strip():
                    self._add(part.split()[0])

    def handle_endtag(self, tag):
        if tag == "picture":
            self.cur = None


def dct_phash(path):
    im = Image.open(path).convert("L").resize((32, 32), Image.LANCZOS)
    px = list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())
    m = [px[i * 32:(i + 1) * 32] for i in range(32)]
    c = [[math.cos((2 * x + 1) * u * math.pi / 64) for x in range(32)] for u in range(8)]
    rows = [[sum(m[y][x] * c[u][x] for x in range(32)) for u in range(8)] for y in range(32)]
    d = [[sum(rows[y][u] * c[v][y] for y in range(32)) for u in range(8)] for v in range(8)]
    flat = [d[v][u] for v in range(8) for u in range(8)]
    med = sorted(flat[1:])[len(flat[1:]) // 2]
    return sum(1 << i for i, val in enumerate(flat) if val > med)


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    ap.add_argument("--versions", nargs="*", default=["a", "b"])
    ap.add_argument("--max-dist", type=int, default=8)
    o = ap.parse_args()
    bad = 0
    for v in o.versions:
        vroot = os.path.join(o.root, v)
        pages = sorted(f for f in os.listdir(vroot) if f.endswith(".html"))
        slots = []  # (page, n, files)
        for pg in pages:
            p = Pics()
            p.feed(open(os.path.join(vroot, pg), encoding="utf-8").read())
            n = 0
            for files in p.pics:
                if files:
                    n += 1
                    slots.append((pg, n, sorted(set(files))))
        info = {}
        for _, _, files in slots:
            for f in files:
                path = os.path.join(vroot, f)
                if f not in info and os.path.exists(path):
                    try:
                        info[f] = (sha(path), dct_phash(path))
                    except Exception as e:  # unreadable format
                        info[f] = (sha(path), None)
        # union-find over slots: same slot variants are one photo; link slots sharing sha or pHash <= dist
        parent = list(range(len(slots)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        flat = [(i, f) for i, (_, _, fs) in enumerate(slots) for f in fs if f in info]
        for x in range(len(flat)):
            for y in range(x + 1, len(flat)):
                (i, f), (j, g) = flat[x], flat[y]
                if find(i) == find(j):
                    continue
                (s1, h1), (s2, h2) = info[f], info[g]
                if s1 == s2 or (h1 is not None and h2 is not None and bin(h1 ^ h2).count("1") <= o.max_dist):
                    parent[find(i)] = find(j)
        groups = {}
        for i, s in enumerate(slots):
            groups.setdefault(find(i), []).append(s)
        print(f"\n=== Version /{v}/: {len(slots)} photo slots, {len(groups)} distinct photos ===")
        print(f"{'photo (desktop file / sha256[:12] / pHash)':72} slots")
        dup = 0
        for g in sorted(groups.values(), key=lambda g: (-len(g), g[0][2][0])):
            first = next((f for f in g[0][2] if "desktop" in f), g[0][2][0])
            s, h = info.get(first, ("?", None))
            label = f"{os.path.basename(first)} / {s[:12]} / {h:016x}" if h is not None else f"{first} / {s[:12]}"
            where = ", ".join(f"{pg}[{n}]" for pg, n, _ in g)
            flag = "  <-- REPEAT" if len(g) > 1 else ""
            print(f"{label:72} {where}{flag}")
            if len(g) > 1:
                dup += 1
                files = sorted({f for _, _, fs in g for f in fs})
                print(f"{'':72}   files: {', '.join(os.path.basename(f) for f in files)}")
        print(f"/{v}/ photos used on more than one slot: {dup}")
        bad += dup
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
