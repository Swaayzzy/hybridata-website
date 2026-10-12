# 3D bundle mount point (not installed yet)

Both sections ship as a 2D SVG view. The 3D view plugs in here without touching the page markup.

- Mount element: `[data-3d-mount]` inside each `.stage-frame` (`#inside-the-building` on `index.html`, `#build-the-rack` on the data center page). It is hidden until a bundle mounts.
- Loader: `window.HybStage.load3D(name, el, options)` in `assets/stage-core.js`. It dynamic-imports `assets/3d/<file>` only when the visitor presses "3D view", so nothing 3D downloads on first load.
- Register a bundle by adding its file name to `BUNDLES` in `assets/stage-core.js` (`home` or `rack`), e.g. `BUNDLES.home = 'home-building.3d.js'`.
- Bundle contract: an ES module exporting `mount(el, { reduceMotion }) -> Promise<{ destroy() }>`. It must render on demand, self-host every asset under `assets/3d/`, and keep the CSP (`script-src 'self'`, `connect-src 'self'`) unchanged unless Security Reviewer has passed the change.
- The 2D view is forced (3D button disabled) for reduced motion, Save-Data, no WebGL, screens 360 px and narrower, and low-memory or low-core devices.
- Scene state: `window.__hybHome` / `window.__hybRack` and `window.__hybLabelCheck.home()` / `.rack()` expose the current stage and the label overlap check for the QA gate.
