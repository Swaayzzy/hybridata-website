#!/usr/bin/env python3
"""Retired-photo check (LIGHT-936). Fails if any retired photo is still referenced or shipped in built /a/ or /b/.

For each prefix in RETIRED it (1) greps every file under a/ and b/ for the string `photos/<prefix>` (same as
`grep -r "photos/testing-" a b`) and (2) fails if a file named `<prefix>*` still exists in assets/photos/.
To retire another photo, add its filename prefix (for example "testing-") to RETIRED.

Usage: tools/retired-photos.py [--root .] [--versions a b]      Exit status 1 on any hit.
"""
import argparse, glob, os, sys

RETIRED = ["testing-"]  # filename prefixes under assets/photos/ that must not appear in a/ or b/


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    ap.add_argument("--versions", nargs="*", default=["a", "b"])
    o = ap.parse_args()
    hits = []
    for v in o.versions:
        vroot = os.path.join(o.root, v)
        for dirpath, _, files in os.walk(vroot):
            for fn in files:
                path = os.path.join(dirpath, fn)
                data = open(path, "rb").read()
                for r in RETIRED:
                    if ("photos/" + r).encode() in data:
                        hits.append(f"{os.path.relpath(path, o.root)}: references photos/{r}")
        for r in RETIRED:
            for f in glob.glob(os.path.join(vroot, "assets", "photos", r + "*")):
                hits.append(f"{os.path.relpath(f, o.root)}: retired file still shipped")
    for h in hits:
        print("FAIL", h)
    print(f"retired prefixes {RETIRED}: {len(hits)} hit(s) in {', '.join('/' + v + '/' for v in o.versions)}")
    sys.exit(1 if hits else 0)


if __name__ == "__main__":
    main()
