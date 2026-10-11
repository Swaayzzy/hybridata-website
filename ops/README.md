# Self-hosting kit for hybridatasolutions.com

Server: agents-server (`2.28.98.23`, Ubuntu). Web server: Caddy with automatic HTTPS. The site is static files.
The repo is **public**. Nothing in `ops/` is secret: it publishes the server IP, host names, the `agent` user name and file paths on purpose, and holds no passwords, keys or hashes. Source of truth: this repo. `site/` holds the clean production files; the `staging` branch is what the GitHub Pages staging site serves.

## Layout on the server

```
/srv/hybridata/
  releases/<UTC timestamp>-<sha>/   production releases (newest 5 kept) + releases/initial placeholder
  production -> releases/...        symlink Caddy serves for hybridatasolutions.com
```
Owner `agent`, group `caddy`, directories `2750` (setgid), files `640`. Caddy can only read. `/home/agent` is not readable by Caddy.

**Production only.** Staging is not on this server: it runs on GitHub Pages (`.github/workflows/staging-pages.yml`, branch `staging`). The server serves only the live site, and only after go-live.

## What is in `ops/`

| File | Who runs it | What it does |
|---|---|---|
| `setup-server.sh` | **Adam, as root, once** (safe to re-run) | Installs Caddy (apt key pinned by fingerprint), installs the Python packages, creates `/srv/hybridata`, locks Caddy out of `/home` (systemd `ProtectHome=yes` plus file modes), moves the Caddy admin API to a private unix socket, installs the Caddyfile, opens ufw (80, 443/tcp, 443/udp) if active, prints PASS/FAIL. It serves no site yet and requests no certificate |
| `Caddyfile` | installed by setup | Global options (admin socket), the shared security-header and static-file snippets, and the import of the enabled site |
| `caddy/production.caddy` | installed by setup, enabled at go-live | The apex site and the `www` to apex 308 redirect (the active site config after go-live) |
| `enable-production.sh` | **Adam, as root, at go-live** (installed as `hybridata-enable-production`) | Links `production.caddy` in and reloads Caddy (or unlinks it with `--disable`). **Kept, not folded into setup:** this is the step that makes Caddy request certificates, and it must wait until DNS points at `2.28.98.23` |
| `publish.sh <sha> --yes-adam-approved` | agents, **only with a SHA Adam approved** | Builds a production release from the clean `site/` at that exact commit (full 40-hex SHA, must be on `staging` or `main`) |
| `rollback.sh` | agents or Adam | Points `production` at the previous (or a named) release. Refuses `initial` unless `--allow-initial` |
| `lib.sh` | (sourced) | Shared helpers |
| `DNS.md` | Adam | Exact DNS records |

`deploy-staging.sh` and `staging-noindex.sh` were removed (staging is on GitHub Pages). The repo's own `scripts/staging-noindex.sh` is what the Pages workflow uses.

## Go-live run order: setup, publish, DNS, enable

1. **Adam, on the server, once (setup).** First check who runs what, and the home directory:
   ```
   ps -eo user,cmd | grep -i multica      # the multica daemon should run as "agent"; note any other user
   ls -ld /home/agent                     # setup removes "other" access from this directory
   ```
   If the daemon (or anything else) runs as a user other than `agent` and needs `/home/agent`, stop and ask the Web team. Then, with the SHA from the hand-over comment:
   ```
   git clone https://github.com/Swaayzzy/hybridata-website.git /root/hy && cd /root/hy && git checkout --detach <SHA>
   git log -1 --format=%H            # must print exactly <SHA>
   sudo bash ops/setup-server.sh
   ```
   `git checkout --detach <SHA>` fails if that commit does not exist. Also compare the SHA with the commit page on GitHub (`https://github.com/Swaayzzy/hybridata-website/commit/<SHA>`), not only with the hand-over comment, so a tampered comment cannot send you to a different commit. Clone into a directory only root can write to (`/root/hy`), and do not run the script from a copy anyone else can change.
   While it runs, setup stops Caddy right after installing it (first install only), so the default admin port is not open before our config is in place. After it finishes, `systemctl cat caddy` should show the packaged `ExecReload=… caddy reload --config /etc/caddy/Caddyfile --force` and no `ProtectHome`/`RuntimeDirectory` outside our drop-in; the summary checks the `ExecReload` line for you. Ports 80 and 443 stay closed until step 4: the summary expects that.
   If the summary shows an ownership FAIL after an interrupted first run, stop and send the output to the Web team.
2. **Agents, publish.** `bash ops/publish.sh <full-sha> --yes-adam-approved` as `agent`, with the SHA Adam approved. **Only when Adam's approval is quoted on the issue.** The flag is a speed bump, not the control; the quoted approval is. It needs the full 40-hex SHA, which must be on `staging` or merged to `main`, and refuses if any file contains `noindex` or `robots.txt` disallows everything. Nothing is public yet: Caddy serves no site.
3. **DNS (a Hybridata owner, SystemDNS).** Zone export first, then change the `@` and `www` A records to `2.28.98.23` (`DNS.md`).
4. **Adam, enable.** Once the records point here: `sudo hybridata-enable-production`. Manual equivalent:
   `sudo ln -sfn /etc/caddy/available/production.caddy /etc/caddy/enabled/production.caddy && sudo systemctl reload caddy`
   Then check the site (`DNS.md` step 3, point 6).

The repo is public, so the `agent` user needs no GitHub login to clone it. The scripts clone into `~/hybridata-website-deploy` on first run (`HYBRIDATA_REPO_URL`, `HYBRIDATA_REPO_DIR` override the defaults). No credentials are stored in this repo.

**What happens if the production block is enabled too early** (DNS still on the old server): Caddy tries to get certificates for the apex and `www`, the checks reach the old server instead, and they fail. Caddy keeps retrying with growing pauses, and Let's Encrypt limits repeated failures (5 failed validations per hostname per hour), so the real certificate can be delayed after DNS is fixed. The old site is not affected, but the log fills with errors. Fix: `sudo hybridata-enable-production --disable`, correct DNS, enable again.

## Rollback

- Site content: `bash ops/rollback.sh` (previous release), `bash ops/rollback.sh <name>`, or `--list`. Instant, atomic. Names are `initial` or `YYYYMMDDTHHMMSSZ-<7 hex>` only. Going back to `initial` (a "being set up" page with noindex) needs `--allow-initial` and prints a warning.
- Traffic back to the old server: `DNS.md`, "Rollback".

## How the safety rules work

- Staging (GitHub Pages) carries noindex. Production is built from the clean `site/` at an explicit approved commit, never from a staging copy, and `publish.sh` refuses any release containing `noindex`.
- Least privilege for Caddy: it runs with `ProtectHome=yes` (no access to `/home` at all; the `chmod o-rwx /home/agent` is a second layer) and can only read `/srv/hybridata`.
- The Caddy admin API is on a unix socket (`/run/caddy/admin.sock`, mode 600, in a 700 directory created by `RuntimeDirectory=caddy`), not on `127.0.0.1:2019`, so the `agent` user cannot reconfigure Caddy. `systemctl reload caddy` still works: the packaged unit runs `caddy reload --config /etc/caddy/Caddyfile --force` as the `caddy` user, and `caddy reload` uses the admin address from the config file it loads: the docs say `--address` is only needed when the admin endpoint "is different from the address in the provided config file" ([caddy reload](https://caddyserver.com/docs/command-line#caddy-reload)). Tested with Caddy 2.8.4. The summary checks this.
- The Caddy apt signing key is checked against a fingerprint hard-coded in `setup-server.sh`, and the apt source line is written by the script itself (see the comment at the top of the script for the sources).
- `publish.sh` exports only `site/` and never executes anything from the published commit (file names are treated as data; a name starting with `-` aborts the publish); it refuses commits that are not on `staging` or `main`.
- `setup-server.sh` only sets owners and modes on `/srv/hybridata` when it first creates it; on re-runs it only checks and reports (the tree is writable by `agent`, and root must not follow links inside it).
- Caddy serves static files only: no `browse`, dotfiles, `_headers` and `_redirects` return 404, no `Server` header. Headers are those of `site/_headers`.
- The production switch is atomic (symlink rename), so visitors never see half-written files.
- `setup-server.sh` re-run safety: package installs and `ufw allow` are no-ops when already done; directories use `install -d`; the placeholder release and `production` link are created only if missing (a re-run never repoints production); the new Caddyfile is validated before replacing the old one; Caddy is restarted only if its environment or config changed, otherwise reloaded; ufw is never enabled, and only changed if already active (SSH allowed first).

## How to test (no root needed)

```
export HYBRIDATA_ROOT=$PWD/fake-root HYBRIDATA_REPO_URL=<path or url of the repo> HYBRIDATA_REPO_DIR=$PWD/fake-clone
mkdir -p $HYBRIDATA_ROOT/releases/initial && ln -s releases/initial $HYBRIDATA_ROOT/production
bash ops/publish.sh <full-sha> --yes-adam-approved && bash ops/publish.sh <full-sha> --yes-adam-approved && bash ops/rollback.sh
shellcheck -x ops/*.sh                                   # run from inside ops/
caddy validate --config ops/Caddyfile --adapter caddyfile
```
`setup-server.sh` and `enable-production.sh` can only be tested as root on the server.

## Open items

- SPF/DKIM and a zone export before go-live (`DNS.md`).
- Decisions for Adam (not changed by the Web team): branch protection and 2FA on the GitHub repo (anyone who can push to `staging` or `main` controls what an approved SHA contains, though `publish.sh` never executes code from the repo and the approved full SHA is pinned); whether `ops/` and `DNS.md` should move to a private repo.
- Backups of `/etc/caddy` and the Caddy certificate store (`/var/lib/caddy`) are not set up.
- Caddy is not pinned to a version (apt upgrades it with the system).
