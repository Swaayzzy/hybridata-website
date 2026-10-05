#!/usr/bin/env bash
# Point production at the previous release, or at a named one. Run as the agent user.
#   rollback.sh            previous release
#   rollback.sh <name>     a named release from releases/
#   rollback.sh --list     show releases, newest last, active marked with *
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_agent_user
require_tree

# Oldest first; the 'initial' placeholder counts as the oldest.
mapfile -t releases < <(find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%f\n' \
  | sed 's/^initial$/0initial/' | sort | sed 's/^0initial$/initial/')

before="$(readlink "$ROOT/production" || true)"
[ -n "$before" ] || die "$ROOT/production is not a symlink"
current="$(basename "$before")"

if [ "${1:-}" = "--list" ]; then
  for r in "${releases[@]}"; do
    if [ "$r" = "$current" ]; then printf '* %s\n' "$r"; else printf '  %s\n' "$r"; fi
  done
  exit 0
fi

target=""
if [ -n "${1:-}" ]; then
  [[ $1 =~ ^[A-Za-z0-9._-]+$ ]] || die "invalid release name"
  [ -d "$ROOT/releases/$1" ] || die "no such release: $1 (try --list)"
  target=$1
else
  prev=""
  for r in "${releases[@]}"; do
    if [ "$r" = "$current" ]; then target=$prev; break; fi
    prev=$r
  done
  [ -n "$target" ] || die "no earlier release than $current to roll back to"
fi
[ "$target" != "$current" ] || die "production already points at $current"

swap_symlink "releases/$target" "$ROOT/production"
log "production: $before -> $(readlink "$ROOT/production")"
