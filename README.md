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

## How We Build page (LIGHT-629)
- `site/how-we-build.html`: tabs **Warehouse** (`#warehouse`, Concept A) and **MDF rack** (`#mdf-rack`, Concept B). The Warehouse tab and panel carry `hidden` and a `CONCEPT A SLOT` comment until Concept A lands; remove both `hidden` attributes then. Old `#rack` / `#building` links still resolve (to MDF rack / Warehouse). Linked from the nav on every page, so the nav is unchanged.
- `site/assets/how-we-build.js`: tabs and the step viewer. ‹ › buttons (48 px minimum, "Previous step" / "Next step"), a quick flick on touch (slower drags turn the rack), ←/→ only while focus is inside the viewer. Back is disabled on step 1 and forward on the last (no wrap), the "3 / 8" counter is `aria-live="polite"`, no timers, no autoplay. **Edit step names and captions in the `ol.hwb-steps` list in `how-we-build.html`**, not in the script. It loads the rack only when the picture is within a screen of the viewport: `assets/rack-worker.js` runs the scene in a module worker on a transferred OffscreenCanvas (so three.js never blocks the page); browsers without that fall back to `assets/rack-3d.js` on the page's own thread. If WebGL is missing it shows `assets/hwb/mdf-rack-final.webp` (a render of the final step) instead.
- `site/assets/rack-worker.js` and `rack-3d.js`: the 3D rack, two bundles of one scene (`build-home3d/src/mdf-core.js`, entries `mdf-worker.js` and `mdf-main.js`; build with `cd build-home3d && npm ci --offline && node scripts/build-mdf.mjs`). three.js 0.185.1 is bundled (MIT, notice in `site/LICENSES.md`). The `LAYOUT` table at the top of `mdf-core.js` is the rack, top down, with the step each part appears on; `POSE` holds the camera per step. Colours are the Field Ops `RACK_COL` values. To refresh the fallback image, render step 8 and save it as `assets/hwb/mdf-rack-final.webp`.
- `site/assets/stage.css`: page styles and the home / data center teasers.
- `site/archive/how-we-build-v2/`: the 2D version (tag `archive/how-we-build-v2-2d`), self-contained, `noindex`, not linked from anywhere and not in `sitemap.xml`. v1 (tag `archive/how-we-build-v1-webgl`) was 3D sections on the home and data center pages, never its own page, so it is tag-only. Never delete either tag.
- `scripts/hwb/` (the old SVG art generators) no longer feeds `how-we-build.html`; it still makes the four `assets/hwb/*.svg` teasers.
