#!/usr/bin/env bash
# Publish the exact commit that staging is on (staging.sha) to production. Run as the agent user,
# and only after Adam has said "publish".
#
# The release is built from the clean site/ at that commit. It is NOT a copy of the staging
# directory with noindex stripped out, so noindex cannot reach production.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ "${1:-}" = "--yes-adam-approved" ] || die "refusing to publish. Run only after Adam says publish: $0 --yes-adam-approved"
require_agent_user
require_tree

[ -f "$ROOT/staging.sha" ] || die "$ROOT/staging.sha not found - run deploy-staging.sh first"
sha="$(head -n1 "$ROOT/staging.sha")"
[[ $sha =~ ^[0-9a-f]{40}$ ]] || die "staging.sha does not hold a full commit SHA"

sync_repo
git -C "$REPO_DIR" cat-file -e "$sha^{commit}" 2>/dev/null || die "commit $sha is not in the repo (staging branch rewritten?)"
[ "$TIP_SHA" = "$sha" ] || log "NOTE: $BRANCH has moved on to $TIP_SHA; publishing the staged commit $sha"

name="$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:7}"
final="$ROOT/releases/$name"
build="$ROOT/releases/.build.$$"
cleanup() { rm -rf "$build"; }
trap cleanup EXIT
[ ! -e "$final" ] || die "release $name already exists"

# Only site/ is exported - staging-noindex.sh is never run here.
export_tree "$sha" "$build/x" site
mv -T "$build/x/site" "$build/site"
rel="$build/site"

[ -f "$rel/index.html" ] || die "release has no index.html"
if hits="$(grep -rIli 'noindex' "$rel")" && [ -n "$hits" ]; then
  printf '%s\n' "$hits" >&2
  die "noindex found in the release; refusing to publish"
fi
[ -f "$rel/robots.txt" ] || die "release has no robots.txt"
if grep -Eiq '^[[:space:]]*Disallow:[[:space:]]*/[[:space:]]*$' "$rel/robots.txt"; then
  die "robots.txt disallows everything; refusing to publish"
fi
log "Checks passed: no noindex anywhere, robots.txt allows crawling"

before="$(readlink "$ROOT/production" || true)"
mv -T "$rel" "$final"
swap_symlink "releases/$name" "$ROOT/production"
log "production: ${before:-<none>} -> $(readlink "$ROOT/production")"

# Keep the newest $KEEP_RELEASES timestamped releases (and never the active one). 'initial' is kept.
mapfile -t all < <(find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*Z-*' -printf '%f\n' | sort)
if [ "${#all[@]}" -gt "$KEEP_RELEASES" ]; then
  active="$(basename "$(readlink "$ROOT/production")")"
  for old in "${all[@]:0:${#all[@]}-KEEP_RELEASES}"; do
    [ "$old" = "$active" ] && continue
    rm -rf -- "${ROOT:?}/releases/$old"
    log "Pruned old release $old"
  done
fi
log "Published $sha as $name"
