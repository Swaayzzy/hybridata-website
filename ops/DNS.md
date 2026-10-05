# DNS sheet for hybridatasolutions.com

For Adam. Nameservers are `ns1/2/3.systemdns.com` (SystemDNS); email is hosted at hostedemail.com (MX).
Only the records named below change. **Never touch MX or any TXT record** except where the SPF/DKIM job below says so.

| | |
|---|---|
| New server (agents-server) | `2.28.98.23` |
| Old server (live site today) | `157.230.81.24` |

## Step 0: take a full zone export (before any change)

Ask whoever manages SystemDNS for a full export of the zone (or screenshot every record: type, name, value, TTL).
Keep it somewhere safe. It is the way back if a record is changed by mistake.

## Step 1: now (staging only; does not touch the live site)

| Type | Name / Host | Value | TTL |
|---|---|---|---|
| A | `staging` | `2.28.98.23` | 3600 |

Add this record **before** running `setup-server.sh` if you can. Caddy requests the staging certificate as soon as it starts and retries if the record is not there yet, which is harmless but noisy. Do not add an AAAA record.

Check from any computer after a few minutes: `nslookup staging.hybridatasolutions.com` should show `2.28.98.23`.

## Step 2: a day before go-live: lower the TTL

Lower the TTL of the **existing** `@` (apex) A record and the `www` record to **300** seconds. Do not change their values yet. Wait at least as long as the old TTL (often 1 hour, up to 24) before step 3, so that a rollback takes effect in about 5 minutes.

## Step 3: go-live (only after Adam says publish and the production site has been published)

Order matters:

1. Make sure `publish.sh` has put the approved version in `production` (the Web team does this on request).
2. Change the records:

| Type | Name / Host | Old value | New value | TTL |
|---|---|---|---|---|
| A | `@` | `157.230.81.24` | `2.28.98.23` | 300 |
| A | `www` | `157.230.81.24` | `2.28.98.23` | 300 |

   (`www` may instead be a CNAME to `hybridatasolutions.com`; use the A record if SystemDNS does not allow it.)
3. Check for an **AAAA** record on `@` or `www`. If one exists and points at the old server, delete it (the new server has no IPv6 record), otherwise IPv6 visitors still reach the old server.
4. Check for **CAA** records. If any exist, they must allow `letsencrypt.org` (and `sectigo.com`/`zerossl.com` if listed for Caddy). If there are none, nothing to do.
5. On the server, run once: `sudo hybridata-enable-production` (see `README.md`). Caddy then gets the certificates for the apex and `www`. This takes about a minute.
6. Check: `https://hybridatasolutions.com` loads, `https://www.hybridatasolutions.com/about.html` redirects to `https://hybridatasolutions.com/about.html`, and email still works (send a test message to and from the company address).

Leave every MX and TXT record exactly as it is.

## Rollback (if anything is wrong after go-live)

Put both A records back to `157.230.81.24` (TTL 300 makes this take about 5 minutes). The old server must stay up for at least a week after go-live: ask its owner to keep it running. If the AAAA record was deleted in step 3, restore it from the zone export. Optionally run `sudo hybridata-enable-production --disable` on the new server.

## Email: SPF and DKIM (from the LIGHT-31 audit)

This is a separate job and is **not** part of the move. It is for whoever runs hostedemail for the domain.
Current state, from public lookups: no SPF record, DKIM unconfirmed, DMARC `p=none`.

- SPF: add one TXT record at `@` with the include/mechanism that hostedemail documents: `[unknown: ask hostedemail for the exact SPF value]`. Only one SPF record may exist per domain.
- DKIM: have hostedemail generate the key and give you the TXT record: `[unknown: selector and public key come from hostedemail]`.
- DMARC: keep `p=none` until SPF and DKIM are confirmed working for a couple of weeks, then consider `quarantine`. Do not change it as part of go-live.
- Do all of this separately from the A-record switch, so a problem can be traced to one change.
