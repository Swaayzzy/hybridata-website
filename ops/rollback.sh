#!/usr/bin/env bash
# Point production at the previous release, or at a named one. Run as the agent user.
#   rollback.sh                          previous release
#   rollback.sh <name>                   a named release from releases/
#   rollback.sh --list                   show releases, newest last, active marked with *
#   rollback.sh --allow-initial [<name>] allow going back to the "initial" placeholder (it is noindex)
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

list=0 allow_initial=0 name=""
for a in "$@"; do
  case $a in
    --list) list=1 ;;
    --allow-initial) allow_initial=1 ;;
    "") die "empty argument" ;;
    -*) die "unknown option: $a" ;;
    *) [ -z "$name" ] || die "only one release name is allowed"; name=$a ;;
  esac
done

require_agent_user
require_tree

# Oldest first; the 'initial' placeholder counts as the oldest.
mapfile -t releases < <(find "$ROOT/releases" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%f\n' \
  | sed 's/^initial$/0initial/' | sort | sed 's/^0initial$/initial/')

before="$(readlink "$ROOT/production" || true)"
[ -n "$before" ] || die "$ROOT/production is not a symlink"
current="$(basename "$before")"

if [ "$list" -eq 1 ]; then
  for r in "${releases[@]}"; do
    if [ "$r" = "$current" ]; then printf '* %s\n' "$r"; else printf '  %s\n' "$r"; fi
  done
  exit 0
fi

target=""
if [ -n "$name" ]; then
  # Only the placeholder or a name publish.sh generates. This rules out ".", "..", ".build.N" and any path.
  [[ $name =~ ^(initial|[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7})$ ]] || die "invalid release name: $name"
  if [ ! -d "$ROOT/releases/$name" ] || [ -L "$ROOT/releases/$name" ]; then die "no such release: $name (try --list)"; fi
  target=$name
else
  prev=""
  for r in "${releases[@]}"; do
    if [ "$r" = "$current" ]; then target=$prev; break; fi
    prev=$r
  done
  [ -n "$target" ] || die "no earlier release than $current to roll back to"
fi
if [ "$target" = "initial" ]; then
  [ "$allow_initial" -eq 1 ] || die "refusing to point production at the 'initial' placeholder (it says \"being set up\" and has noindex). Pass --allow-initial if you really mean it"
  log "WARNING: production will serve the 'initial' placeholder: the site goes dark and carries noindex, so search engines may drop it. Roll forward with: rollback.sh <release> (see --list)"
fi
[ "$target" != "$current" ] || die "production already points at $current"

swap_symlink "releases/$target" "$ROOT/production"
log "production: $before -> $(readlink "$ROOT/production")"
