Hybridata redesign preview (not the live site). Noindex everywhere.

- `/` landing page, `/a/` Version A, `/b/` Version B
- `_headers`, `robots.txt`: noindex and security headers
- `tools/textdiff`: compares every page's wording on `main` against `/a/` and `/b/`; exits non-zero on any difference
