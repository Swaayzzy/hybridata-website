# 3D bundles

Both sections ship a 2D SVG view. The 3D view plugs in here without touching the page markup.

- Mount element: `[data-3d-mount]` inside each `.stage-frame` (`#inside-the-building` on `index.html`, `#build-the-rack` on the data center page). It is hidden until a bundle mounts.
- Loader: `window.HybStage.load3D(name, el, options)` in `assets/stage-core.js`. It dynamic-imports `assets/3d/<file>` and nothing 3D downloads on first load. The home page requests its bundle when the section comes within 400 px of the screen (or when the visitor presses "3D view"). Register a bundle in `BUNDLES` in `assets/stage-core.js`.
- Bundle contract: an ES module exporting `mount(el, { reduceMotion }) -> Promise<{ setState(stage, focus), check(), destroy() }>`. It renders on demand, self-hosts every asset, and keeps the CSP (`script-src 'self'`, `connect-src 'self'`, `img-src 'self'`) unchanged.
- The 2D view is forced (3D button disabled) for reduced motion, Save-Data, no WebGL, screens 360 px and narrower, and low-memory or low-core devices.
- Testing switches (not linked anywhere): `?mode=2d` forces the simple view, `?mode=3d` skips the size and hardware checks (the bundle still loads lazily), and adding `&eager=1` mounts it at once, which the QA gate uses so the canvas exists when it starts measuring. Motion, Save-Data and WebGL checks still apply.
- Scene state for QA: `window.__hybHome` (`stage`, `setStage`, `view()`), `window.__hybHome3d` (`frames`, `calls()`, `tris()`, `tier`), `window.__hybLabelCheck.home()`, and `data-tier="2d|3d"` on `<html>`.

## Files

| Path | What |
| --- | --- |
| `home-building.3d.js` | Home "Inside the building" bundle (three 0.185.1, tree-shaken and minified). Built from `build-home3d/`. |
| `home/env/` | One HDRI at 256x128 (phones) and 512x256 (desktop). |
| `home/texs/`, `home/texm/` | WebP PBR maps, 256 px (phones) and 512 px (desktop). |

Licences and SHA-256 of every shipped file are in `site/LICENSES.md`.
