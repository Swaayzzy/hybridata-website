# Self-hosting kit for hybridatasolutions.com

Server: agents-server (`2.28.98.23`, Ubuntu). Web server: Caddy with automatic HTTPS. The site is static files.
Source of truth: this repo. `site/` holds the clean production files; the `staging` branch is what staging serves.

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
| `setup-server.sh` | **Adam, as root, once** (safe to re-run) | Installs Caddy and the Python packages, creates `/srv/hybridata`, locks Caddy out of `/home/agent`, installs the Caddyfile, asks for the staging password, opens ufw if active, prints PASS/FAIL |
| `Caddyfile` | installed by setup | Staging site (login + noindex) and the shared security headers |
| `caddy/production.caddy` | installed by setup, enabled at go-live | Apex site and the `www` to apex 308 redirect |
| `enable-production.sh` | **Adam, as root, at go-live** (installed as `hybridata-enable-production`) | Switches the apex/www site on (or off with `--disable`) |
| `deploy-staging.sh` | agents | Puts the tip of `staging` on the staging site |
| `publish.sh` | agents, **only after Adam says "publish"** | Builds a production release from the clean `site/` at the staged commit |
| `rollback.sh` | agents or Adam | Points `production` at the previous (or a named) release |
| `lib.sh` | (sourced) | Shared helpers |
| `DNS.md` | Adam | Exact DNS records |

## Run order

1. **Adam, DNS:** add the `staging` A record (`DNS.md`, step 1).
2. **Adam, on the server, once:** check the commit SHA the Web team gave you, then
   ```
   git clone -b staging https://github.com/Swaayzzy/hybridata-website.git /root/hy && cd /root/hy
   git log -1 --format=%H            # must match the SHA in the hand-over comment
   sudo bash ops/setup-server.sh
   ```
   The script asks for a staging password once (user name `review`, minimum 12 characters, input hidden). Only a bcrypt hash is stored, in `/etc/caddy/staging.env` (root only, mode 600). Read the PASS/FAIL list at the end; send it to the Web team if anything says FAIL.
   Root runs this script, so run it from a copy you have checked, not from a directory that anyone else can change while it runs.
3. **Agents:** `bash ops/deploy-staging.sh` as `agent`. Open `https://staging.hybridatasolutions.com` and log in as `review`.
4. **Agents, per change:** commit to the `staging` branch, run `deploy-staging.sh`, Adam reviews.
5. **Go-live** (needs Adam's approval): see "Go-live" below.

The `agent` user needs read access to the GitHub repo (it is private). The scripts clone into `~/hybridata-website-deploy` on first run (`HYBRIDATA_REPO_URL`, `HYBRIDATA_REPO_DIR`, `HYBRIDATA_BRANCH` override the defaults). No credentials are stored in this repo.

## Go-live

1. `DNS.md` steps 0 and 2 done (zone export, TTL 300 a day ahead).
2. Agents run `bash ops/publish.sh --yes-adam-approved` (after Adam says "publish"). It refuses if any file contains `noindex` or `robots.txt` disallows everything.
3. Adam changes the `@` and `www` A records (`DNS.md` step 3).
4. Adam runs `sudo hybridata-enable-production`. Manual equivalent:
   `sudo ln -sfn /etc/caddy/available/production.caddy /etc/caddy/enabled/production.caddy && sudo systemctl reload caddy`

**What happens if the production block is enabled too early** (DNS still on the old server): Caddy tries to get certificates for the apex and `www`, the checks reach the old server instead, and they fail. Caddy keeps retrying with growing pauses, and Let's Encrypt limits repeated failures (5 failed validations per hostname per hour), so the real certificate can be delayed after DNS is fixed. The old site is not affected, but the log fills with errors. Fix: `sudo hybridata-enable-production --disable`, correct DNS, enable again.

## Rollback

- Site content: `bash ops/rollback.sh` (previous release), `bash ops/rollback.sh <name>`, or `--list`. Instant, atomic.
- Traffic back to the old server: `DNS.md`, "Rollback".

## How the safety rules work

- Staging has noindex (meta tag, `robots.txt` Disallow-all, `X-Robots-Tag`) and a login. Production is built from the clean `site/` at the staged commit, never from the staging copy, so noindex cannot reach it.
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
- Backups of `/etc/caddy` and the Caddy certificate store (`/var/lib/caddy`) are not set up.
- Caddy is not pinned to a version (apt upgrades it with the system).
