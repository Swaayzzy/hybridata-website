#!/usr/bin/env bash
# One-time (and safe to re-run) server setup for hybridatasolutions.com. Run as root by Adam:
#   sudo bash ops/setup-server.sh
# Installs Caddy and Python packages, creates /srv/hybridata, locks Caddy out of /home/agent,
# installs the Caddyfile, opens the firewall if ufw is active, and prints a PASS/FAIL summary.
set -euo pipefail

AGENT_USER="${AGENT_USER:-agent}"
AGENT_HOME="${AGENT_HOME:-/home/$AGENT_USER}"
BASE=/srv/hybridata
OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=/etc/caddy/staging.env
DROPIN_DIR=/etc/systemd/system/caddy.service.d
DROPIN=$DROPIN_DIR/staging-env.conf
KEYRING=/usr/share/keyrings/caddy-stable-archive-keyring.gpg
APT_LIST=/etc/apt/sources.list.d/caddy-stable.list
# Primary-key fingerprint of the Caddy "stable" apt repo signing key (Caddy Web Server <contact@caddyserver.com>).
# Hard-coded on purpose; the downloaded key must match it exactly. Sources, checked 2026-10-05:
#  1. Cloudsmith, host of the official Caddy repo: https://api.cloudsmith.io/v1/repos/caddy/stable/gpg/ ("fingerprint")
#  2. Ubuntu keyserver: https://keyserver.ubuntu.com/pks/lookup?op=vindex&fingerprint=on&search=0x65760C51EDEA2017CEA2CA15155B6D79CA56EA34
# Caddy's own install docs (https://caddyserver.com/docs/install) do not publish this fingerprint.
CADDY_KEY_FPR=65760C51EDEA2017CEA2CA15155B6D79CA56EA34
ADMIN_SOCK=/run/caddy/admin.sock
RESTART_NEEDED=0
FAILS=0

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"
command -v apt-get >/dev/null || die "this script supports Debian/Ubuntu (apt) only"
id "$AGENT_USER" >/dev/null 2>&1 || die "user '$AGENT_USER' does not exist"
for f in Caddyfile caddy/production.caddy enable-production.sh; do
  [ -f "$OPS_DIR/$f" ] || die "$OPS_DIR/$f not found - run this from a full checkout of the repo"
done

# Reads the Caddy user's view of a path: run a command as the caddy user.
as_caddy() {
  if command -v sudo >/dev/null 2>&1; then sudo -n -u caddy "$@"; else runuser -u caddy -- "$@"; fi
}

# ---------------------------------------------------------------- 1. Caddy
say "Installing Caddy from the official Cloudsmith apt repo"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gpg ca-certificates
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
curl --proto '=https' --proto-redir '=https' --tlsv1.2 -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' -o "$tmp_dir/caddy.asc"
# Primary-key fingerprints of every key in a file (armored or binary), one per line.
key_fprs() { gpg --batch --show-keys --with-colons "$1" 2>/dev/null | awk -F: '$1=="pub"{p=1;next} $1=="fpr"&&p{print $10;p=0}'; }
got="$(key_fprs "$tmp_dir/caddy.asc")" || true
[ "$got" = "$CADDY_KEY_FPR" ] || die "Caddy apt key fingerprint mismatch (expected $CADDY_KEY_FPR, got: ${got:-none}); nothing was installed"
gpg --batch --yes --dearmor -o "$tmp_dir/caddy.gpg" "$tmp_dir/caddy.asc"
got="$(key_fprs "$tmp_dir/caddy.gpg")" || true
[ "$got" = "$CADDY_KEY_FPR" ] || die "dearmored Caddy key does not match the pinned fingerprint; nothing was installed"
install -m 644 -o root -g root "$tmp_dir/caddy.gpg" "$KEYRING"
# Our own apt line, not the list file downloaded from the vendor.
printf 'deb [signed-by=%s] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main\n' "$KEYRING" > "$tmp_dir/caddy-stable.list"
install -m 644 -o root -g root "$tmp_dir/caddy-stable.list" "$APT_LIST"
apt-get update -qq
apt-get install -y -qq caddy

# ---------------------------------------------------------------- 2. Python packages
say "Installing python3-venv python3-pip python3-full (for the App Builder / LIGHT-37)"
apt-get install -y -qq python3-venv python3-pip python3-full

# ---------------------------------------------------------------- 3. Directory tree
# Root only sets owner and modes when $BASE is first created. On a re-run the tree is agent-owned and
# agent-writable, so root must not chown/chmod/write inside it (a swapped-in symlink could redirect that);
# the summary at the end only checks and reports.
first_run=0
if [ ! -e "$BASE" ] && [ ! -L "$BASE" ]; then
  first_run=1
  say "Creating $BASE (owner $AGENT_USER, group caddy, dirs 2750, files 640)"
  install -d -o root -g caddy -m 2750 "$BASE" "$BASE/releases" "$BASE/staging" "$BASE/releases/initial"
  cat > "$BASE/releases/initial/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<title>Coming soon</title></head><body><p>This site is being set up.</p></body></html>
HTML
  cat > "$BASE/staging/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<title>Staging</title></head><body><p>Staging is set up. Nothing has been deployed yet.</p></body></html>
HTML
  ln -s releases/initial "$BASE/production"
  # Nothing else exists in the new tree yet, so this cannot race with anyone.
  chown -hR "$AGENT_USER:caddy" "$BASE"
  find "$BASE" -type d ! -type l -exec chmod 2750 {} +
  find "$BASE" -type f ! -type l -exec chmod 640 {} +
else
  say "$BASE already exists: not changing owners or modes (checked in the summary)"
  if [ ! -d "$BASE" ] || [ -L "$BASE" ]; then die "$BASE is not a plain directory; fix it by hand"; fi
  [ -L "$BASE/production" ] || die "$BASE/production is not a symlink; fix it by hand"
fi

# ---------------------------------------------------------------- 4. Keep Caddy out of the agent's home
say "Checking that the caddy user cannot read $AGENT_HOME"
before="$(stat -c '%a %U:%G' "$AGENT_HOME")"
echo "before: mode/owner = $before"
mode="$(stat -c '%a' "$AGENT_HOME")"
if (( (8#$mode & 8#007) != 0 )); then
  chmod o-rwx "$AGENT_HOME"       # owner and group unchanged
fi
if [ "$(stat -c '%G' "$AGENT_HOME")" = "caddy" ] && (( (8#$(stat -c '%a' "$AGENT_HOME") & 8#070) != 0 )); then
  chmod g-rwx "$AGENT_HOME"       # home must not be group-readable by caddy either
fi
echo "after:  mode/owner = $(stat -c '%a %U:%G' "$AGENT_HOME")"

# ---------------------------------------------------------------- 5. Staging password (bcrypt hash only)
say "Staging login"
mkdir -p /etc/caddy /etc/caddy/available /etc/caddy/enabled
if [ -s "$ENV_FILE" ] && grep -Eq "^STAGING_AUTH_HASH='[$]2[aby][$]" "$ENV_FILE" && [ "${RESET_STAGING_PASSWORD:-0}" != 1 ]; then
  echo "Keeping the existing staging password (set RESET_STAGING_PASSWORD=1 to change it)."
else
  [ -t 0 ] || die "need a terminal to ask for the staging password"
  echo "Choose the staging password (user name: review). Minimum 12 characters. Input is hidden."
  read -r -s -p "Password: " pw1; echo
  read -r -s -p "Again:    " pw2; echo
  [ "$pw1" = "$pw2" ] || die "passwords do not match"
  [ "${#pw1}" -ge 12 ] || die "password too short"
  hash="$(printf '%s\n%s\n' "$pw1" "$pw1" | caddy hash-password)"
  unset pw1 pw2
  [[ $hash =~ ^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$ ]] || die "unexpected output from caddy hash-password"
  old_umask="$(umask)"; umask 077
  printf "STAGING_AUTH_HASH='%s'\n" "$hash" > "$ENV_FILE.new"
  umask "$old_umask"
  chown root:root "$ENV_FILE.new"; chmod 600 "$ENV_FILE.new"
  mv -T "$ENV_FILE.new" "$ENV_FILE"
  unset hash
  RESTART_NEEDED=1
fi
chown root:root "$ENV_FILE"; chmod 600 "$ENV_FILE"

mkdir -p "$DROPIN_DIR"
# EnvironmentFile: the staging hash. ProtectHome: Caddy cannot see /home whatever the file modes are.
# RuntimeDirectory: /run/caddy, owned by caddy and closed to everyone else, holds the admin socket.
want_dropin=$'[Service]\nEnvironmentFile='"$ENV_FILE"$'\nProtectHome=yes\nRuntimeDirectory=caddy\nRuntimeDirectoryMode=0700\n'
if [ "$(cat "$DROPIN" 2>/dev/null || true)" != "${want_dropin%$'\n'}" ]; then
  printf '%s' "$want_dropin" > "$DROPIN"
  chmod 644 "$DROPIN"
  RESTART_NEEDED=1
fi
systemctl daemon-reload

# ---------------------------------------------------------------- 6. Caddyfile
say "Installing the Caddyfile"
install -m 644 -o root -g root "$OPS_DIR/caddy/production.caddy" /etc/caddy/available/production.caddy
install -m 755 -o root -g root "$OPS_DIR/enable-production.sh" /usr/local/sbin/hybridata-enable-production
install -m 644 -o root -g root "$OPS_DIR/Caddyfile" /etc/caddy/Caddyfile.new
if [ -f /etc/caddy/Caddyfile ] && ! cmp -s /etc/caddy/Caddyfile /etc/caddy/Caddyfile.new && [ ! -e /etc/caddy/Caddyfile.dist ]; then
  cp -p /etc/caddy/Caddyfile /etc/caddy/Caddyfile.dist      # keep the package default once
fi
# shellcheck source=/dev/null
# Validate the candidate (with the staging hash in the environment) before it replaces the live file.
if ! ( set -a; . "$ENV_FILE"; set +a; caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile >/dev/null 2>&1 ); then
  rm -f /etc/caddy/Caddyfile.new
  die "caddy validate failed on the new Caddyfile; the old one is untouched"
fi
if ! cmp -s /etc/caddy/Caddyfile /etc/caddy/Caddyfile.new 2>/dev/null; then RESTART_NEEDED=1; fi
mv -T /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile
# shellcheck source=/dev/null
( set -a; . "$ENV_FILE"; set +a; caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 ) || die "caddy validate failed"
echo "caddy validate: OK"

# ---------------------------------------------------------------- 7. Firewall (never enable it)
say "Firewall"
if command -v ufw >/dev/null 2>&1 && ufw status | head -n1 | grep -qi '^Status: active'; then
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null    # SSH first, so you cannot lock yourself out
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null        # HTTP/3
  echo "ufw is active: allowed SSH, 80/tcp, 443/tcp, 443/udp (HTTP/3)"
else
  echo "ufw is not active: left untouched (not enabling it)."
  echo "If the Hetzner Cloud Firewall is attached to this server, it must allow 80/tcp, 443/tcp and 443/udp (HTTP/3) too."
fi

# ---------------------------------------------------------------- 8. Start Caddy
say "Starting Caddy"
systemctl enable caddy >/dev/null 2>&1
if systemctl is-active --quiet caddy && [ "$RESTART_NEEDED" -eq 0 ]; then
  systemctl reload caddy
else
  systemctl restart caddy      # needed when the environment file or drop-in changed
fi

# ---------------------------------------------------------------- 9. Summary
check() { # check <label> <command...>
  local label=$1; shift
  if "$@" >/dev/null 2>&1; then printf 'PASS  %s\n' "$label"; else printf 'FAIL  %s\n' "$label"; FAILS=$((FAILS + 1)); fi
}
listening() { ss -ltn "( sport = :$1 )" | grep -q LISTEN; }
no_loose_modes() {
  [ -z "$(find "$BASE" -type f ! -perm 640 -print -quit)" ] \
    && [ -z "$(find "$BASE" -type d ! -perm 2750 -print -quit)" ] \
    && [ -z "$(find "$BASE" ! -type l ! -user "$AGENT_USER" -print -quit)" ] \
    && [ -z "$(find "$BASE" ! -type l ! -group caddy -print -quit)" ]
}
setgid_inherits() {   # the file is created and removed by the agent user, not by root
  local t rc=1
  t="$(runuser -u "$AGENT_USER" -- mktemp -p "$BASE/staging" .setup-check.XXXXXX)" || return 1
  if [ "$(stat -c '%G' "$t")" = caddy ]; then rc=0; fi
  runuser -u "$AGENT_USER" -- rm -f "$t"
  return $rc
}
prod_target_ok() {
  local t; t="$(readlink -f "$BASE/production")"
  [[ $t == "$BASE"/releases/* ]] && [ -f "$t/index.html" ]
}
env_file_ok() { [ "$(stat -c '%a %U' "$ENV_FILE")" = "600 root" ]; }
caddy_cannot_read_home() { as_caddy test ! -r "$AGENT_HOME" && as_caddy test ! -x "$AGENT_HOME"; }
caddy_read_only() { as_caddy test -r "$BASE/staging/index.html" && as_caddy test ! -w "$BASE/staging" && as_caddy test ! -w "$BASE/releases"; }
# The admin API must not be reachable by the agent user, on TCP or through the socket.
admin_not_on_tcp() { ! listening 2019; }
agent_cannot_reach_admin_tcp() { ! runuser -u "$AGENT_USER" -- curl -s --max-time 3 http://127.0.0.1:2019/config/; }
admin_socket_private() {
  [ "$(stat -c '%a %U' "$ADMIN_SOCK")" = "600 caddy" ] \
    && [ "$(stat -c '%a %U' "$(dirname "$ADMIN_SOCK")")" = "700 caddy" ] \
    && ! runuser -u "$AGENT_USER" -- test -e "$ADMIN_SOCK" \
    && ! runuser -u "$AGENT_USER" -- curl -s --max-time 3 --unix-socket "$ADMIN_SOCK" http://127.0.0.1/config/
}
reload_works() { systemctl reload caddy && sleep 1 && systemctl is-active --quiet caddy; }
protect_home_set() { [ "$(systemctl show caddy -p ProtectHome --value)" = yes ]; }
python_ok() { dpkg -s python3-venv python3-pip python3-full && python3 -c 'import venv, ensurepip'; }
# shellcheck source=/dev/null
validate_ok() { ( set -a; . "$ENV_FILE"; set +a; caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile ); }

# Caddy needs a moment to bind its ports.
for _ in 1 2 3 4 5 6 7 8 9 10; do listening 80 && listening 443 && break; sleep 1; done

say "Summary"
check "Caddy service is active" systemctl is-active --quiet caddy
check "Caddyfile validates" validate_ok
check "port 80 is listening" listening 80
check "port 443 is listening" listening 443
check "$BASE owned by $AGENT_USER:caddy, dirs 2750, files 640 (checked only$( [ "$first_run" -eq 1 ] && echo '; set at creation'))" no_loose_modes
check "new files in staging/ inherit group caddy (setgid)" setgid_inherits
check "caddy can read the tree but not write to it" caddy_read_only
check "sudo -u caddy test ! -r $AGENT_HOME (and no traverse)" caddy_cannot_read_home
check "Caddy service has ProtectHome=yes (no access to /home at all)" protect_home_set
check "admin API is not listening on TCP 2019" admin_not_on_tcp
check "agent cannot reach the admin API: curl http://127.0.0.1:2019/config/ fails" agent_cannot_reach_admin_tcp
check "admin socket $ADMIN_SOCK is 600 caddy, in a 700 caddy directory; agent cannot open it" admin_socket_private
check "systemctl reload caddy works with the admin socket" reload_works
check "$ENV_FILE is mode 600, owned by root" env_file_ok
check "production symlink -> $(readlink "$BASE/production") (exists, has index.html)" prod_target_ok
check "Python packages: python3-venv, python3-pip, python3-full, ensurepip" python_ok
echo
echo "$AGENT_HOME now: $(stat -c '%a %U:%G' "$AGENT_HOME")"
if [ "$FAILS" -eq 0 ]; then
  echo "RESULT: ALL CHECKS PASSED"
else
  echo "RESULT: $FAILS CHECK(S) FAILED - send this output to the Web team"
  exit 1
fi
