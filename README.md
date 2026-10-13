# hybridatasolutions.com

Static website for Hybridata Solutions, hosted on Netlify.

## Layout
- `site/`: the production website, exactly as served. Edit pages and assets here.
- `netlify.toml`: Netlify settings. Publishes `site/`.
- `scripts/staging-noindex.sh`: runs only on staging/preview deploys and hides them from search engines.

## Workflow
1. Make changes on the `staging` branch and push. Netlify updates the staging link.
2. Review on staging.
3. Open a pull request from `staging` to `main` and merge it.
4. Production auto-publishing is locked. The live site changes only when the owner clicks **Publish deploy** in Netlify.

Never add `noindex` tags to files in `site/` by hand, or they will go live with the next production deploy.

## How We Build page (LIGHT-502)
- `site/how-we-build.html`: tabs **Building** and **Data Center Rack** (`#building`, `#rack` deep links). Linked from the top nav on every page, the footer, and a teaser card on `index.html` and the data center page.
- `site/assets/how-we-build.js`: tabs plus the step viewer (LIGHT-545: the autoplay player is gone). Each step is a still frame of the art, reached with the ‹ › buttons (48 px minimum, "Previous step" / "Next step"), a swipe on touch, or ←/→ while focus is inside the viewer. Back is disabled on step 1 and forward on the last step (no wrap). The "3 / 8" counter is `aria-live="polite"`. Switching tabs resets that tab to step 1. It reads every step name, caption and tag from the `ol.hwb-steps` lists in the HTML, so **edit copy in `how-we-build.html`**, not in the script. There are no timers.
- `site/assets/stage.css`: styles for the page and teasers. The only motion left is a 180 ms opacity crossfade between frames, off with reduced motion.
- Art (LIGHT-503): drawn in code, never hand-edited. `scripts/hwb/lib25.py` (projection, `Scene` layers, `Labels` with the bounding-box check), `gen_home.py` (8 stages) and `gen_rack.py` (6 steps). Run `python3 scripts/hwb/build.py` to rewrite the four stills in `site/assets/hwb/` **and** both inline SVGs in `how-we-build.html`; `--check` runs only the label check (no pill overlaps, no crossing leaders, at most 3 callouts per step on phones; it fails the build otherwise).
- Layers: every piece carries the step it appears on and its system (`.L[data-from][data-system]`, plus `.draw` cable runs, `.unit` rack units, `.pop`, `.wrap`, `.rip`). The viewer toggles `.on` and `data-stage` / `data-focus`; `stage.css` only crossfades opacity. Callouts (`.lbl.sN`, `.f-<system>`) show only for the current step or picked system. "(illustrative)" is printed on the coverage ripple and on the test trace at both label sizes. `how-we-build.js` changed in one place only: `activate()` blanks the stage first so step 1 draws in.
- `site/assets/hwb-fx.js`: phone crop only (swaps the viewBox). The parallax was removed in LIGHT-545.
- Teasers use `assets/hwb/home-stage8-narrow.svg` and `rack-step6-narrow.svg` (static, flat, no CSS).
- Without JavaScript the arrows and step text stay hidden (the art shows all layers). Edit copy in the `ol.hwb-steps` lists in `how-we-build.html`.
- The old 3D view, its bundles and every `?mode=` switch are gone (history keeps them). `build-home3d/` is reference only.
