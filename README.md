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
- `site/assets/how-we-build.js`: tabs plus the autoplay player. It reads every step name, caption and tag from the `ol.hwb-steps` lists in the HTML, so **edit copy in `how-we-build.html`**, not in the script. Autoplay: about 4 s per step, starts only at 60% visible and from step 1, pauses off screen, on a hidden tab or when the stage is tapped, and never auto-advances with reduced motion.
- `site/assets/stage.css`: styles for the page and teasers.
- Art: the inline SVGs on the page are stand-ins. The player only toggles the `.L[data-from][data-system]` groups and the `data-stage` / `data-focus` attributes on the `svg[data-art]` element, so final art can replace them without touching the script. The teasers use `site/assets/hwb/*-narrow.svg`.
- The old 3D view, its bundles and every `?mode=` switch are gone (history keeps them). `build-home3d/` is reference only.
