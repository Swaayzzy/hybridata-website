# Self-hosting kit for hybridatasolutions.com

Server: agents-server (`2.28.98.23`, Ubuntu). Web server: Caddy with automatic HTTPS. The site is static files.
The repo is **public**. Nothing in `ops/` is secret: it publishes the server IP, host names, the `agent` and `review` user names and file paths on purpose, and holds no passwords, keys or hashes (the staging hash is created on the server only). Source of truth: this repo. `site/` holds the clean production files; the `staging` branch is what staging serves.

## Layout on the server

```
/srv/hybridata/
  releases/<UTC timestamp>-<sha>/   production releases (newest 5 kept) + releases/initial placeholder
  production -> releases/...        symlink Caddy serves for hybridatasolutions.com
  staging/                          served at staging.hybridatasolutions.com (noindex + login)
  staging.sha                       commit currently on staging
```
Owner `agent`, group `caddy`, directories `2750` (setgid), files `640`. Caddy can only read. `/home/agent` is not readable by Caddy.

## What is in `ops/`

| File | Who runs it | What it does |
|---|---|---|
| `setup-server.sh` | **Adam, as root, once** (safe to re-run) | Installs Caddy (apt key pinned by fingerprint), installs the Python packages, creates `/srv/hybridata`, locks Caddy out of `/home` (systemd `ProtectHome=yes` plus file modes), moves the Caddy admin API to a private unix socket, installs the Caddyfile, asks for the staging password, opens ufw (80, 443/tcp, 443/udp) if active, prints PASS/FAIL |
| `Caddyfile` | installed by setup | Staging site (login + noindex) and the shared security headers |
| `caddy/production.caddy` | installed by setup, enabled at go-live | Apex site and the `www` to apex 308 redirect |
| `enable-production.sh` | **Adam, as root, at go-live** (installed as `hybridata-enable-production`) | Switches the apex/www site on (or off with `--disable`) |
| `deploy-staging.sh [<sha>]` | agents | Puts a commit of `staging` on the staging site: the given reviewed SHA (must be on the `staging` branch), or the tip, printing its SHA and subject first. Exports only `site/` and runs nothing from it |
| `staging-noindex.sh` | (run by deploy-staging) | Adds noindex to the exported copy. Lives here, so no code from a deployed commit is executed |
| `publish.sh` | agents, **only after Adam says "publish"** | Builds a production release from the clean `site/` at the staged commit |
| `rollback.sh` | agents or Adam | Points `production` at the previous (or a named) release. Refuses `initial` unless `--allow-initial` |
| `lib.sh` | (sourced) | Shared helpers |
| `DNS.md` | Adam | Exact DNS records |

## Run order

1. **Adam, DNS:** add the `staging` A record (`DNS.md`, step 1).
2. **Adam, on the server, once.** First check who runs what, and the home directory:
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
   The script asks for a staging password once (user name `review`, minimum 12 characters, input hidden). Only a bcrypt hash is stored, in `/etc/caddy/staging.env` (root only, mode 600). Read the PASS/FAIL list at the end; send it to the Web team if anything says FAIL.
3. **Agents:** `bash ops/deploy-staging.sh <sha>` as `agent` (the reviewed commit; without a SHA it deploys the tip of `staging` and prints it first). Open `https://staging.hybridatasolutions.com` and log in as `review`.
4. **Agents, per change:** commit to the `staging` branch, run `deploy-staging.sh <sha>`, Adam reviews.
5. **Go-live** (needs Adam's approval): see "Go-live" below.

The repo is public, so the `agent` user needs no GitHub login to clone it. The scripts clone into `~/hybridata-website-deploy` on first run (`HYBRIDATA_REPO_URL`, `HYBRIDATA_REPO_DIR`, `HYBRIDATA_BRANCH` override the defaults). No credentials are stored in this repo.

## Go-live

1. `DNS.md` steps 0 and 2 done (zone export, TTL 300 a day ahead).
2. Agents run `bash ops/publish.sh --yes-adam-approved`. **Only when Adam's word "publish" is quoted on the issue.** The flag is a speed bump, not the control; the quoted approval is. It refuses if any file contains `noindex` or `robots.txt` disallows everything.
3. Adam changes the `@` and `www` A records (`DNS.md` step 3).
4. Adam runs `sudo hybridata-enable-production`. Manual equivalent:
   `sudo ln -sfn /etc/caddy/available/production.caddy /etc/caddy/enabled/production.caddy && sudo systemctl reload caddy`

**What happens if the production block is enabled too early** (DNS still on the old server): Caddy tries to get certificates for the apex and `www`, the checks reach the old server instead, and they fail. Caddy keeps retrying with growing pauses, and Let's Encrypt limits repeated failures (5 failed validations per hostname per hour), so the real certificate can be delayed after DNS is fixed. The old site is not affected, but the log fills with errors. Fix: `sudo hybridata-enable-production --disable`, correct DNS, enable again.

## Rollback

- Site content: `bash ops/rollback.sh` (previous release), `bash ops/rollback.sh <name>`, or `--list`. Instant, atomic. Names are `initial` or `YYYYMMDDTHHMMSSZ-<7 hex>` only. Going back to `initial` (a "being set up" page with noindex) needs `--allow-initial` and prints a warning.
- Traffic back to the old server: `DNS.md`, "Rollback".

## How the safety rules work

- Staging has noindex (meta tag, `robots.txt` Disallow-all, `X-Robots-Tag`) and a login. Production is built from the clean `site/` at the staged commit, never from the staging copy, so noindex cannot reach it.
- Least privilege for Caddy: it runs with `ProtectHome=yes` (no access to `/home` at all; the `chmod o-rwx /home/agent` is a second layer) and can only read `/srv/hybridata`.
- The Caddy admin API is on a unix socket (`/run/caddy/admin.sock`, mode 600, in a 700 directory created by `RuntimeDirectory=caddy`), not on `127.0.0.1:2019`, so the `agent` user cannot reconfigure Caddy. `systemctl reload caddy` still works: the packaged unit runs `caddy reload --config /etc/caddy/Caddyfile --force` as the `caddy` user, and `caddy reload` uses the admin address from the config file it loads: the docs say `--address` is only needed when the admin endpoint "is different from the address in the provided config file" ([caddy reload](https://caddyserver.com/docs/command-line#caddy-reload)). Tested with Caddy 2.8.4. The summary checks this.
- The Caddy apt signing key is checked against a fingerprint hard-coded in `setup-server.sh`, and the apt source line is written by the script itself (see the comment at the top of the script for the sources).
- `deploy-staging.sh` exports only `site/` and never executes anything from the deployed commit; with `<sha>` it refuses commits that are not on `staging`.
- `setup-server.sh` only sets owners and modes on `/srv/hybridata` when it first creates it; on re-runs it only checks and reports (the tree is writable by `agent`, and root must not follow links inside it).
- Caddy serves static files only: no `browse`, dotfiles, `_headers` and `_redirects` return 404, no `Server` header. Headers are those of `site/_headers`.
- Staging and production switches are atomic (directory exchange / symlink rename), so visitors never see half-written files.
- `setup-server.sh` re-run safety: package installs and `ufw allow` are no-ops when already done; directories use `install -d`; the placeholder release and `production` link are created only if missing (a re-run never repoints production); an existing staging password is kept unless `RESET_STAGING_PASSWORD=1`; the new Caddyfile is validated before replacing the old one; Caddy is restarted only if its environment or config changed, otherwise reloaded; ufw is never enabled, and only changed if already active (SSH allowed first).

## How to test (no root needed)

```
export HYBRIDATA_ROOT=$PWD/fake-root HYBRIDATA_REPO_URL=<path or url of the repo> HYBRIDATA_REPO_DIR=$PWD/fake-clone
mkdir -p $HYBRIDATA_ROOT/releases/initial $HYBRIDATA_ROOT/staging && ln -s releases/initial $HYBRIDATA_ROOT/production
bash ops/deploy-staging.sh && bash ops/publish.sh --yes-adam-approved && bash ops/rollback.sh
shellcheck -x ops/*.sh                                   # run from inside ops/
STAGING_AUTH_HASH=$(printf 'pw\npw\n' | caddy hash-password) caddy validate --config ops/Caddyfile
```
`setup-server.sh` itself can only be tested as root on the server.

## Open items

- Adam: keep or remove `adam@velaramarketing.com` as a contact-form recipient (LIGHT-26).
- SPF/DKIM and a zone export before go-live (`DNS.md`).
- Decisions for Adam (not changed by the Web team): branch protection and 2FA on the GitHub repo (anyone who can push to `staging` controls what `deploy-staging.sh` deploys, though it never executes code from the repo: only `site/` is exported, and the kit's own `staging-noindex.sh` treats every file name as data); whether `ops/` and `DNS.md` should move to a private repo.
- Backups of `/etc/caddy` and the Caddy certificate store (`/var/lib/caddy`) are not set up.
- Caddy is not pinned to a version (apt upgrades it with the system).
