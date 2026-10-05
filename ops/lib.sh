#!/usr/bin/env bash
# Shared helpers, sourced by deploy-staging.sh, publish.sh and rollback.sh. Not run directly.
# shellcheck disable=SC2034  # variables are used by the scripts that source this file

# ops/ code always comes from the checked-out kit (this directory), never from a deployed commit.
OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${HYBRIDATA_ROOT:-/srv/hybridata}"
REPO_URL="${HYBRIDATA_REPO_URL:-https://github.com/Swaayzzy/hybridata-website.git}"
REPO_DIR="${HYBRIDATA_REPO_DIR:-$HOME/hybridata-website-deploy}"
BRANCH="${HYBRIDATA_BRANCH:-staging}"
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
  for d in "$ROOT" "$ROOT/releases" "$ROOT/staging"; do
    [ -d "$d" ] || die "$d is missing - has setup-server.sh been run?"
  done
}

# Clone on first use, then fetch the branch. Sets TIP_SHA to the branch tip.
sync_repo() {
  if [ ! -d "$REPO_DIR/.git" ]; then
    git clone --quiet --no-checkout "$REPO_URL" "$REPO_DIR"
  fi
  git -C "$REPO_DIR" fetch --quiet origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
  TIP_SHA="$(git -C "$REPO_DIR" rev-parse --verify "refs/remotes/origin/$BRANCH^{commit}")"
}

# require_on_branch <sha> - the commit must be reachable from the fetched branch tip.
require_on_branch() {
  git -C "$REPO_DIR" merge-base --is-ancestor "$1" "refs/remotes/origin/$BRANCH" \
    || die "commit $1 is not on the $BRANCH branch; refusing to use it"
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

# swap_dirs <new> <live> - atomically exchange two directories (renameat2 RENAME_EXCHANGE).
# Afterwards <live> holds the new content and <new> holds the old content.
# Falls back to two renames (a very short gap) if the filesystem cannot exchange.
swap_dirs() {
  local new=$1 live=$2
  if [ ! -e "$live" ]; then
    mv -T "$new" "$live"
    return
  fi
  if python3 - "$new" "$live" <<'PY' 2>/dev/null
import ctypes, os, sys
libc = ctypes.CDLL(None, use_errno=True)
rc = libc.renameat2(-100, os.fsencode(sys.argv[1]), -100, os.fsencode(sys.argv[2]), 2)
sys.exit(0 if rc == 0 else 1)
PY
  then
    return
  fi
  log "WARNING: atomic directory exchange unavailable; using two renames"
  mv -T "$live" "$new.old"
  mv -T "$new" "$live"
  mv -T "$new.old" "$new"
}
