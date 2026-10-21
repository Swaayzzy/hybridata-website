#!/usr/bin/env bash
# Shared helpers, sourced by publish.sh and rollback.sh. Not run directly.
# shellcheck disable=SC2034  # variables are used by the scripts that source this file

# ops/ code always comes from the checked-out kit (this directory), never from a deployed commit.
OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${HYBRIDATA_ROOT:-/srv/hybridata}"
REPO_URL="${HYBRIDATA_REPO_URL:-https://github.com/Swaayzzy/hybridata-website.git}"
REPO_DIR="${HYBRIDATA_REPO_DIR:-$HOME/hybridata-website-deploy}"
# A published commit must be on one of these branches (staging while under review, main once merged).
BRANCHES=(staging main)
KEEP_RELEASES=5

# New files: owner rw, group (caddy, via the setgid directories) r, others nothing.
umask 027

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*"; }

require_agent_user() {
  [ "$(id -u)" -ne 0 ] || die "run this as the agent user, not root (root would break file ownership)"
}

require_tree() {
  local d
  for d in "$ROOT" "$ROOT/releases"; do
    [ -d "$d" ] || die "$d is missing - has setup-server.sh been run?"
  done
}

# Clone on first use, then fetch the allowed branches.
sync_repo() {
  local b
  if [ ! -d "$REPO_DIR/.git" ]; then
    git clone --quiet --no-checkout "$REPO_URL" "$REPO_DIR"
  fi
  for b in "${BRANCHES[@]}"; do
    git -C "$REPO_DIR" fetch --quiet origin "+refs/heads/$b:refs/remotes/origin/$b"
  done
}

# require_on_branch <sha> - the commit must be reachable from the tip of a branch in BRANCHES.
require_on_branch() {
  local b
  for b in "${BRANCHES[@]}"; do
    if git -C "$REPO_DIR" merge-base --is-ancestor "$1" "refs/remotes/origin/$b" 2>/dev/null; then return 0; fi
  done
  die "commit $1 is not on the staging or main branch; refusing to use it"
}

# commit_subject <sha> - the subject line with control characters removed (safe to print).
commit_subject() {
  git -C "$REPO_DIR" log -1 --format=%s "$1" | tr -d '[:cntrl:]'
}

# export_tree <sha> <dest> <path>...  - unpack the given paths of a commit into dest.
export_tree() {
  local sha=$1 dest=$2
  shift 2
  mkdir -p "$dest"
  git -C "$REPO_DIR" archive --format=tar "$sha" "$@" | tar -x -C "$dest" --no-same-owner --no-same-permissions
  # A symlink in the repo could point Caddy at files outside the web root.
  if [ -n "$(find "$dest" -type l -print -quit)" ]; then
    die "the export contains a symlink; refusing to deploy it"
  fi
  find "$dest" -type f -exec chmod 640 {} +
}

# swap_symlink <target> <link> - atomically point <link> at <target>.
# The temporary link lives in a fresh mktemp directory next to <link>, so no name can be guessed or reused.
swap_symlink() {
  local target=$1 link=$2 d
  d="$(mktemp -d -p "$(dirname "$link")" ".swap.XXXXXX")"
  if ln -s "$target" "$d/link" && mv -T "$d/link" "$link"; then
    rmdir "$d"
  else
    rm -rf "$d"
    die "could not switch $link"
  fi
}
