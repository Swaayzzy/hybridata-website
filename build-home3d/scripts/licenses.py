#!/usr/bin/env python3
"""Write site/LICENSES.md for the home 3D section: every shipped derivative with its SHA-256, plus credits."""
import hashlib, os, glob

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'site')
Q_ZIP = {  # SHA-256 of the quarantined source zips, as passed by Security in LIGHT-476
    'Asphalt031': 'f98114b8fb083fc65925c3b4568b131e37c9a23357d432a16e59676dbc69f964',
    'Concrete034': '5839d284d94ffb8d2a56df742ec522b13dd311c52dbd42b8fd33f0409ceedb81',
    'Metal027': '12b2d9996d532cf8a31820d24f2ea83e3217b89da060c4fb29c3c5177535ac72',
    'PaintedMetal004': '02c243e8e8441f0ee24e68645f5d8c9bd6d8ee0a3b9bfa3d952840902653f978',
}
HDR_SRC = 'e7cfda5f4e98e623db12b8bfd0184e048488e4855d9c83e2751fb44a32e80c45'

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def rows(pattern):
    out = []
    for p in sorted(glob.glob(os.path.join(ROOT, pattern))):
        out.append((os.path.relpath(p, ROOT), os.path.getsize(p), sha(p)))
    return out

L = []
L.append('# Third-party assets and licences\n')
L.append('## Home page: "Inside the building" 3D section (LIGHT-477)\n')
L.append('The 3D building is built in code (no model file). Everything below is self-hosted under `assets/3d/`; nothing loads from a third-party host.\n')
L.append('### Credits (courtesy lines)\n')
L.append('- Environment lighting: "Studio Small 09" HDRI by Sergej Majboroda, from Poly Haven (https://polyhaven.com/a/studio_small_09), CC0 1.0.')
L.append('- Surface textures: Asphalt031, Concrete034, Metal027 and PaintedMetal004 from ambientCG (https://ambientcg.com), CC0 1.0.')
L.append('- Three.js 0.185.1 (MIT), bundled and minified into `assets/3d/home-building.3d.js`.\n')
L.append('### Sources (as passed by Security in LIGHT-476)\n')
L.append('| Source file | Licence | SHA-256 |\n| --- | --- | --- |')
L.append('| `studio_small_09_1k.hdr` (Poly Haven) | CC0 1.0 | `%s` |' % HDR_SRC)
for k, v in Q_ZIP.items():
    L.append('| `%s_1K-JPG.zip` (ambientCG) | CC0 1.0 | `%s` |' % (k, v))
L.append('\nOnly the Color, NormalGL, Roughness and Metalness maps were read out of each zip; the `.blend`, `.usdc`, `.mtlx`, `.tres` and preview files were never extracted.\n')
L.append('### Shipped derivatives\n')
L.append('Made by `build-home3d/scripts/make-assets.py`: maps resized to 256 px (phones) and 512 px (desktop) and saved as WebP; the HDRI box-filtered to 256x128 (phones) and 512x256 (desktop) in linear light and saved as Radiance RGBE.\n')
L.append('| File | Bytes | SHA-256 |\n| --- | --- | --- |')
for r in rows('assets/3d/home/env/*') + rows('assets/3d/home/texs/*') + rows('assets/3d/home/texm/*'):
    L.append('| `%s` | %d | `%s` |' % r)
L.append('\n### Built bundle\n')
L.append('| File | Bytes | SHA-256 |\n| --- | --- | --- |')
for r in rows('assets/3d/home-building.3d.js'):
    L.append('| `%s` | %d | `%s` |' % r)
L.append('\nRebuild: `cd build-home3d && npm ci && npm run assets && npm run build`. esbuild 0.28.2 is a dev-only dependency; the lockfile carries the integrity values Security passed (three 0.185.1, esbuild 0.28.2, @esbuild/linux-x64 0.28.2).\n')
open(os.path.join(ROOT, 'LICENSES.md'), 'w').write('\n'.join(L) + '\n')
print('wrote LICENSES.md', len(L), 'lines')
