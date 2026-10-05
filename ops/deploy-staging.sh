#!/usr/bin/env bash
# Deploy a commit of the repo's staging branch to /srv/hybridata/staging. Run as the agent user.
#   deploy-staging.sh <sha>   deploy that reviewed commit (7-40 hex digits; must be on the staging branch)
#   deploy-staging.sh         deploy the tip of staging (its SHA and subject are printed first)
# Only site/ is exported from the commit, and nothing from it is executed. The noindex step is
# ops/staging-noindex.sh from this kit. Production is built separately by publish.sh.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ "$#" -le 1 ] || die "usage: $0 [<sha>]"
require_agent_user
require_tree
sync_repo

if [ "$#" -eq 1 ]; then
  [[ $1 =~ ^[0-9a-f]{7,40}$ ]] || die "not a commit SHA (7-40 lowercase hex digits): $1"
  sha="$(git -C "$REPO_DIR" rev-parse --verify --quiet "$1^{commit}")" || die "no such commit: $1"
  require_on_branch "$sha"
  log "Deploying the requested commit"
else
  sha=$TIP_SHA
  log "No SHA given: deploying the tip of $BRANCH"
fi
log "  commit:  $sha"
log "  subject: $(commit_subject "$sha")"

work="$(mktemp -d -p "$ROOT" ".deploy-staging.XXXXXX")"
new="$(mktemp -d -p "$ROOT" ".staging.new.XXXXXX")"
sha_tmp=""
cleanup() { rm -rf "$work" "$new" "$new.old"; [ -z "$sha_tmp" ] || rm -f "$sha_tmp"; }
trap cleanup EXIT

export_tree "$sha" "$work/src" site
if [ -n "$(find "$work/src/site" -name '-*' -print -quit)" ]; then
  die "the commit has a file whose name starts with '-'; refusing to deploy it"
fi
bash "$OPS_DIR/staging-noindex.sh" "$work/src/site"

# Staging must never be indexable: fail instead of shipping a page without the tag.
for f in "$work"/src/site/*.html; do
  grep -q 'name="robots" content="noindex' "$f" || die "noindex missing in ${f##*/}"
done
grep -qiE '^[[:space:]]*Disallow:[[:space:]]*/[[:space:]]*$' "$work/src/site/robots.txt" || die "staging robots.txt is not Disallow-all"

mv -T "$work/src/site" "$new"      # replaces the empty directory mktemp created
swap_dirs "$new" "$ROOT/staging"   # old content ends up in $new and is removed by the trap

sha_tmp="$(mktemp -p "$ROOT" ".staging.sha.XXXXXX")"
printf '%s\n' "$sha" > "$sha_tmp"
chmod 640 "$sha_tmp"
mv -T "$sha_tmp" "$ROOT/staging.sha"
sha_tmp=""

log "Staging now serves $sha ($(find "$ROOT/staging" -type f | wc -l) files)"
