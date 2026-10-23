# Third-party assets and licences

What `site/` actually serves.

## Served and third-party

| Asset | Where | Licence |
| --- | --- | --- |
| Barlow Condensed 600/700/800 (latin woff2) | `assets/fonts/barlow-condensed-*.woff2` | SIL Open Font License 1.1 (the families' published licence; the intake record is not in this repo: [unknown]) |
| Inter (latin woff2) | `assets/fonts/inter-latin.woff2` | SIL Open Font License 1.1 (same note as above) |
| Site photographs (AVIF/WebP) | `assets/photos/` | Per-photo licences and credits are on `photo-credits.html` |

## Served and original to this project

- `assets/hwb/*.svg` (How We Build stills, LIGHT-501) and the inline SVG drawings on `how-we-build.html`: drawn in code by `scripts/hwb/` (generic building and rack, unbranded). No third-party artwork.
- `assets/rack-worker.js` and `assets/rack-3d.js` apart from the bundled three.js: the MDF rack scene, built in code from `build-home3d/src/mdf-core.js` (generic, unbranded, no model file). `assets/hwb/mdf-rack-final.webp` is a render of that scene.
- `assets/how-we-build.js`, `assets/stage.css`, `assets/site.js`, `assets/site.bundle.css`, logo and share image: Hybridata's own.

No other JavaScript library or icon set is shipped, and nothing loads from a third-party host.
