#!/usr/bin/env bash
# Go-live step for Caddy. Installed by setup-server.sh as /usr/local/sbin/hybridata-enable-production (root).
#   hybridata-enable-production            enable the apex/www site
#   hybridata-enable-production --disable  switch it off again
# Run only after the apex and www A records point at this server (ops/DNS.md).
set -euo pipefail

AVAILABLE=/etc/caddy/available/production.caddy
LINK=/etc/caddy/enabled/production.caddy

[ "$(id -u)" -eq 0 ] || { echo "ERROR: run as root (sudo)" >&2; exit 1; }

if [ "${1:-}" = "--disable" ]; then
  rm -f "$LINK"
  systemctl reload caddy
  echo "Production site disabled; only staging is served."
  exit 0
fi

[ -f "$AVAILABLE" ] || { echo "ERROR: $AVAILABLE missing - run setup-server.sh first" >&2; exit 1; }
ln -sfn "$AVAILABLE" "$LINK"
# Reload validates the new config first; if it is rejected the running config stays in place.
if ! systemctl reload caddy; then
  rm -f "$LINK"
  echo "ERROR: Caddy rejected the config; production site NOT enabled" >&2
  exit 1
fi
echo "Production site enabled. Caddy will now request certificates for the apex and www."
echo "Watch: journalctl -u caddy -f"
