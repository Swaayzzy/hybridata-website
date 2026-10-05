#!/usr/bin/env bash
# Make an exported copy of site/ non-indexable. Run by deploy-staging.sh from this kit, on a directory
# it has just exported:   staging-noindex.sh <exported site/ directory>
# (Same logic as scripts/staging-noindex.sh, which Netlify still uses. This copy lives in ops/ so that
# no code from a deployed commit is ever executed on the server.)
set -euo pipefail

if [ "$#" -ne 1 ] || [ ! -d "$1" ]; then echo "usage: $0 <site directory>" >&2; exit 1; fi
cd "$1"

for f in *.html; do
  [ -e "$f" ] || continue
  grep -q 'name="robots" content="noindex' "$f" && continue
  sed -i 's#</head>#<meta name="robots" content="noindex, nofollow">\n</head>#' "$f"
done

printf 'User-agent: *\nDisallow: /\n' > robots.txt

if [ -f _headers ]; then
  grep -q 'X-Robots-Tag' _headers || sed -i '/^\/\*$/a\  X-Robots-Tag: noindex' _headers
fi

echo "staging-noindex: $(grep -l 'content="noindex' ./*.html | wc -l) pages tagged"
