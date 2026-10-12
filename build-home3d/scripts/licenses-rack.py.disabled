#!/usr/bin/env python3
"""Add or refresh the "Build the rack" section of site/LICENSES.md (LIGHT-478), between the rack:start / rack:end markers.
The home section (written by licenses.py) is left alone."""
import hashlib, os, glob

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'site')
START, END = '<!-- rack:start -->', '<!-- rack:end -->'
Q_ZIP = {  # SHA-256 of the quarantined source zips, as passed by Security in LIGHT-476
    'Plastic010': '46a2504dbef278475b85c846713804a36823c7151cb79c90728d5c6eab283a19',
    'Rubber004': 'd8933e73c3b983892209bb143ca4bc13a48e4d55720ab12f6e6a303c96c84a31',
}

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def rows(pattern):
    return [(os.path.relpath(p, ROOT), os.path.getsize(p), sha(p)) for p in sorted(glob.glob(os.path.join(ROOT, pattern)))]

L = [START, '## Data center page: "Build the rack" 3D section (LIGHT-478)\n']
L.append('The rack is built in code (no model file). Everything below is self-hosted under `assets/3d/`; nothing loads from a third-party host.\n')
L.append('### Credits (courtesy lines)\n')
L.append('- Environment lighting: "Studio Small 09" HDRI by Sergej Majboroda, from Poly Haven (https://polyhaven.com/a/studio_small_09), CC0 1.0. The same two derivative files as the home section are reused (`assets/3d/home/env/`).')
L.append('- Surface textures from ambientCG (https://ambientcg.com), CC0 1.0: Plastic010 and Rubber004 (new for this section), plus Metal027, PaintedMetal004 and Concrete034, reused from the home section (`assets/3d/home/texs/`, `texm/`; hashes listed above).')
L.append('- Three.js 0.185.1 (MIT), bundled and minified into `assets/3d/rack.3d.js`.\n')
L.append('### Sources (as passed by Security in LIGHT-476)\n')
L.append('| Source file | Licence | SHA-256 |\n| --- | --- | --- |')
for k, v in Q_ZIP.items():
    L.append('| `%s_1K-JPG.zip` (ambientCG) | CC0 1.0 | `%s` |' % (k, v))
L.append('\nOnly the Color, NormalGL and Roughness maps were read out of each zip; the `.blend`, `.usdc`, `.mtlx`, `.tres` and preview files were never extracted.\n')
L.append('### Shipped derivatives\n')
L.append('Made by `build-home3d/scripts/make-assets-rack.py`: maps resized to 256 px (phones) and 512 px (desktop) and saved as WebP.\n')
L.append('| File | Bytes | SHA-256 |\n| --- | --- | --- |')
for r in rows('assets/3d/rack/texs/*') + rows('assets/3d/rack/texm/*'):
    L.append('| `%s` | %d | `%s` |' % r)
L.append('\n### Built bundle\n')
L.append('| File | Bytes | SHA-256 |\n| --- | --- | --- |')
for r in rows('assets/3d/rack.3d.js'):
    L.append('| `%s` | %d | `%s` |' % r)
L.append('\nRebuild: `cd build-home3d && npm ci && python3 scripts/make-assets-rack.py && node scripts/build-rack.mjs`, then `python3 scripts/licenses-rack.py`. Same pinned, lockfile-verified esbuild 0.28.2 (dev only) as the home section.\n')
L.append(END)
block = '\n'.join(L) + '\n'

path = os.path.join(ROOT, 'LICENSES.md')
txt = open(path).read()
if START in txt:
    a, b = txt.index(START), txt.index(END) + len(END) + 1
    txt = txt[:a] + block + txt[b:]
else:
    txt = txt.rstrip('\n') + '\n\n' + block
open(path, 'w').write(txt)
print('updated LICENSES.md rack section')
