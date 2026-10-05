#!/usr/bin/env bash
# Runs only on Netlify branch deploys and deploy previews (see netlify.toml).
# Changes the build copy of site/ so staging is never indexed. Never commit its output.
set -euo pipefail
cd "$(dirname "$0")/../site"

for f in *.html; do
  grep -q 'name="robots" content="noindex' "$f" && continue
  sed -i 's#</head>#<meta name="robots" content="noindex, nofollow">\n</head>#' "$f"
done

printf 'User-agent: *\nDisallow: /\n' > robots.txt

grep -q 'X-Robots-Tag' _headers || sed -i '/^\/\*$/a\  X-Robots-Tag: noindex' _headers

echo "staging-noindex: $(grep -l 'content="noindex' *.html | wc -l) pages tagged"
