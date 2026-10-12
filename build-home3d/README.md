# build-home3d

Dev-only tooling for the home page 3D bundle (`site/assets/3d/home-building.3d.js`). Nothing in this folder is served.

```
cd build-home3d
npm ci                 # three 0.185.1 (shipped, bundled) and esbuild 0.28.2 (dev only), pinned by package-lock.json
npm run assets         # textures + HDRI derivatives from ~/quarantine-light474 (python3 + Pillow, no network)
npm run build          # esbuild -> site/assets/3d/home-building.3d.js, prints size, SHA-256 and an eval / new Function check
npm run licenses       # rewrites site/LICENSES.md with the SHA-256 of every shipped file
```

- `src/home.js`: the scene, story poses, labels and render-on-demand loop. `src/util.js`: geometry helpers (merged parts, tinted materials, instancing).
- The model is built in code: no model file. Only Color / NormalGL / Roughness / Metalness maps are read out of the Security-passed zips, in memory; `.blend`, `.usdc`, `.mtlx` and `.tres` files are never extracted.
- `npm ci` is run with the integrity values Security passed (LIGHT-476): three, esbuild and @esbuild/linux-x64 all match the manifest. Do not set `ESBUILD_BINARY_PATH`.

## How to change the story

- Camera poses and floor lifts per stage: `POSES` at the top of `src/home.js` (`pos`, `tgt`, `off` = [floor 2, floor 3, roof] lift in metres, `glass` opacity).
- Label text and anchors: `STAGE_LABELS` and `FOCUS_LABELS` (world coordinates inside a floor; `f` = floor index, -1 = ground).
- Copy for the steps and the picker lives in `site/index.html`, not here.

## Scale note

Hardware is drawn at realistic proportions except readers, cameras and J-hooks, which are enlarged about 1.5 to 2 times so they read at building scale. Coverage and view cones are illustrative.
