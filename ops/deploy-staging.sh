#!/usr/bin/env bash
# Deploy the tip of the repo's staging branch to /srv/hybridata/staging. Run as the agent user.
# Always adds noindex (scripts/staging-noindex.sh); production is built separately by publish.sh.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_agent_user
require_tree
sync_repo
sha=$TIP_SHA

work="$ROOT/.deploy-staging.$$"
new="$ROOT/.staging.new.$$"
cleanup() { rm -rf "$work" "$new"; }
trap cleanup EXIT

log "Deploying $BRANCH @ $sha"
export_tree "$sha" "$work/src" site scripts
bash "$work/src/scripts/staging-noindex.sh"

# Staging must never be indexable: fail instead of shipping a page without the tag.
for f in "$work"/src/site/*.html; do
  grep -q 'name="robots" content="noindex' "$f" || die "noindex missing in ${f##*/}"
done
grep -qiE '^[[:space:]]*Disallow:[[:space:]]*/[[:space:]]*$' "$work/src/site/robots.txt" || die "staging robots.txt is not Disallow-all"

mv -T "$work/src/site" "$new"
swap_dirs "$new" "$ROOT/staging"   # old content ends up in $new and is removed by the trap

printf '%s\n' "$sha" > "$ROOT/.staging.sha.$$"
chmod 640 "$ROOT/.staging.sha.$$"
mv -T "$ROOT/.staging.sha.$$" "$ROOT/staging.sha"

log "Staging now serves $sha ($(find "$ROOT/staging" -type f | wc -l) files)"
