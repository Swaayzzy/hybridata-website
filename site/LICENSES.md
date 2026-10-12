# Third-party assets and licences

What `site/` actually serves. Updated for LIGHT-502, which removed the 3D view: three.js, the Poly Haven HDRI and the ambientCG textures (all CC0 / MIT) are **no longer served** and are not listed. They remain in git history (commits `42cf8cb`, `bf9463d`, `894dc58`) and their Security intake record is LIGHT-476.

## Served and third-party

| Asset | Where | Licence |
| --- | --- | --- |
| Barlow Condensed 600/700/800 (latin woff2) | `assets/fonts/barlow-condensed-*.woff2` | SIL Open Font License 1.1 (the families' published licence; the intake record is not in this repo: [unknown]) |
| Inter (latin woff2) | `assets/fonts/inter-latin.woff2` | SIL Open Font License 1.1 (same note as above) |
| Site photographs (AVIF/WebP) | `assets/photos/` | Per-photo licences and credits are on `photo-credits.html` |

## Served and original to this project

- `assets/hwb/*.svg` (How We Build stills, LIGHT-501) and the inline SVG drawings on `how-we-build.html`: drawn in code by `scripts/hwb/` (generic building and rack, unbranded). No third-party artwork.
- `assets/how-we-build.js`, `assets/stage.css`, `assets/site.js`, `assets/site.bundle.css`, logo and share image: Hybridata's own.

No JavaScript library, icon set, WebGL or canvas code is shipped, and nothing loads from a third-party host.

## Not shipped

`build-home3d/` holds the old 3D build tooling and sources for reference only. Its `licenses.py` and `licenses-rack.py` are disabled (renamed `*.disabled`) so they can't overwrite this file.
