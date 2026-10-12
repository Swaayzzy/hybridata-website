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
| `rack.3d.js` | Data center "Build the rack" bundle (three 0.185.1, tree-shaken and minified). Built from `build-home3d/src/rack.js` with `npm run build:rack`. Reuses `home/env/` and the Metal027, PaintedMetal004 and Concrete034 maps in `home/tex*/`. |
| `rack/texs/`, `rack/texm/` | WebP PBR maps for the rack only (Plastic010, Rubber004), 256 px (phones) and 512 px (desktop). |
| `home/env/` | One HDRI at 256x128 (phones) and 512x256 (desktop). |
| `home/texs/`, `home/texm/` | WebP PBR maps, 256 px (phones) and 512 px (desktop). |

Licences and SHA-256 of every shipped file are in `site/LICENSES.md`.

## Rack bundle (`rack.3d.js`)

- `mount(el, { reduceMotion }) -> { setState(stop), check(), destroy() }`. `setState(1..6)` sets the target stop; one build value drives every part, so dragging the slider fast or slow both ways always eases to and lands on a clean stop, and the scene draws no frames when it is at rest or off screen.
- State for QA: `window.__hybRack3d` (`frames`, `p`, `calls()`, `tris()`, `tier`), `window.__hybRack` (`stop`, `set`, `view()`), `window.__hybLabelCheck.rack()`.
- The rack page loads the bundle when the section comes within 400 px of the screen. The one-time auto-build waits up to 5 s for it, so the first thing a visitor sees is the 3D build.
- Same testing switches as the home page: `?mode=3d` (skip size and hardware checks), `&eager=1` (mount at once).
