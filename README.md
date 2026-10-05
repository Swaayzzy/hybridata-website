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
