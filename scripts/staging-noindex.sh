#!/usr/bin/env bash
# Runs only on Netlify branch deploys and deploy previews (see netlify.toml).
# Changes the build copy of site/ so staging is never indexed. Never commit its output.
set -euo pipefail
cd "$(dirname "$0")/../site"

for f in *.html; do
  grep -q 'name="robots" content="noindex' "$f" && continue
  sed -i 's#</head>#<meta name="robots" content="noindex, nofollow">\n</head>#' "$f"
done

# GitHub Pages ignores _headers, so staging would send no CSP. Mirror the _headers policy as a meta tag.
# frame-ancestors is left out on purpose: a meta tag cannot enforce it (only a real header can).
CSP="default-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; img-src 'self'; connect-src 'self'; font-src 'self'; style-src 'self'; script-src 'self'"
for f in *.html; do
  grep -q 'http-equiv="Content-Security-Policy"' "$f" && continue
  sed -i "s#<meta charset=\"utf-8\">#<meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"$CSP\">#" "$f"
done

printf 'User-agent: *\nDisallow: /\n' > robots.txt

grep -q 'X-Robots-Tag' _headers || sed -i '/^\/\*$/a\  X-Robots-Tag: noindex' _headers

echo "staging-noindex: $(grep -l 'content="noindex' *.html | wc -l) pages tagged, $(grep -l 'http-equiv="Content-Security-Policy"' *.html | wc -l) with CSP meta"
