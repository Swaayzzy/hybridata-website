# Third-party assets and licences

What `site/` actually serves. Updated for LIGHT-629 (How We Build, Concept B): `assets/rack-3d.js` bundles three.js 0.185.1 (MIT) in both `assets/rack-worker.js` and `assets/rack-3d.js`. The HDRI and the ambientCG textures from the earlier 3D version (LIGHT-476 intake) are **not** used and not served; the new scene has no textures or environment map.

## Served and third-party

| Asset | Where | Licence |
| --- | --- | --- |
| Barlow Condensed 600/700/800 (latin woff2) | `assets/fonts/barlow-condensed-*.woff2` | SIL Open Font License 1.1 (the families' published licence; the intake record is not in this repo: [unknown]) |
| Inter (latin woff2) | `assets/fonts/inter-latin.woff2` | SIL Open Font License 1.1 (same note as above) |
| Site photographs (AVIF/WebP) | `assets/photos/` | Per-photo licences and credits are on `photo-credits.html` |
| three.js 0.185.1, bundled and minified | `assets/rack-worker.js`, `assets/rack-3d.js` | MIT. Notice below. Same package version and lockfile integrity Security passed in LIGHT-476 (see `build-home3d/`) |

## Served and original to this project

- `assets/hwb/*.svg` (How We Build stills, LIGHT-501) and the inline SVG drawings on `how-we-build.html`: drawn in code by `scripts/hwb/` (generic building and rack, unbranded). No third-party artwork.
- `assets/rack-worker.js` and `assets/rack-3d.js` apart from the bundled three.js: the MDF rack scene, built in code from `build-home3d/src/mdf-core.js` (generic, unbranded, no model file). `assets/hwb/mdf-rack-final.webp` is a render of that scene.
- `assets/how-we-build.js`, `assets/stage.css`, `assets/site.js`, `assets/site.bundle.css`, logo and share image: Hybridata's own.

No other JavaScript library or icon set is shipped, and nothing loads from a third-party host.

## Not shipped

`build-home3d/` holds the 3D build tooling (`scripts/build-mdf.mjs` builds `assets/rack-3d.js`) and the earlier v1 sources, kept for reference. Its `licenses.py` and `licenses-rack.py` are disabled (renamed `*.disabled`) so they can't overwrite this file.

## three.js licence notice (MIT)

Three.js 0.185.1 is bundled and minified into `assets/rack-worker.js` and `assets/rack-3d.js`. Its licence text, as shipped in the package:

> The MIT License
>
> Copyright © 2010-2026 three.js authors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
