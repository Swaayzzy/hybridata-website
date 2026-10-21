#!/usr/bin/env bash
# Publish one explicit commit to production. Run as the agent user, and only with a SHA that Adam
# approved (a commit on the staging branch, or merged to main).
#   publish.sh <full-40-hex-sha> --yes-adam-approved
#
# The release is built from the clean site/ at that commit. Nothing is taken from a staging copy,
# so noindex cannot reach production.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

sha="" approved=0
for a in "$@"; do
  case $a in
    --yes-adam-approved) approved=1 ;;
    "") die "empty argument" ;;
    -*) die "unknown option: $a" ;;
    *) [ -z "$sha" ] || die "only one SHA is allowed"; sha=$a ;;
  esac
done
[ -n "$sha" ] || die "usage: $0 <full-40-hex-sha> --yes-adam-approved"
[[ $sha =~ ^[0-9a-f]{40}$ ]] || die "the SHA must be the full 40 lowercase hex digits: $sha"
[ "$approved" -eq 1 ] || die "refusing to publish. Run only with the SHA Adam approved: $0 $sha --yes-adam-approved"
require_agent_user
require_tree

sync_repo
git -C "$REPO_DIR" cat-file -e "$sha^{commit}" 2>/dev/null || die "no such commit: $sha"
require_on_branch "$sha"
log "Publishing commit $sha"
log "  subject: $(commit_subject "$sha")"

name="$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:7}"
final="$ROOT/releases/$name"
build="$(mktemp -d -p "$ROOT" ".publish.XXXXXX")"
cleanup() { rm -rf "$build"; }
trap cleanup EXIT
[ ! -e "$final" ] || die "release $name already exists"

# Only site/ is exported; nothing from the commit is executed.
export_tree "$sha" "$build/x" site
if [ -n "$(find "$build/x" -name '-*' -print -quit)" ]; then
  die "the commit has a file whose name starts with '-'; refusing to publish it"
fi
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
