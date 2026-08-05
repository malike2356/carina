# carinaai.uk marketing files (Docker nginx mount)

This directory is the **live** document root for `https://carinaai.uk/` and `https://www.carinaai.uk/`.

Docker nginx (`corecarinaaiuk-nginx-1`) bind-mounts this folder read-only:

```text
./public_website  ->  /var/www/public_website
```

Configured in `docker/nginx/carina-prod.conf` and `docker-compose.prod.yml`.

## Deploy source

Canonical site source in this workspace: `shared/marketing-sites/carinaai.uk/`

Typical deploy from repo root:

```bash
bash scripts/deploy-marketing.sh carina
# or full stack:
bash scripts/deploy-carina.sh
```

Both rsync into this `public_website/` path on the VPS.

## WARNING: stale bind mount (403 Forbidden)

**After updating files here, you MUST recreate the nginx container** unless a full stack deploy already did it.

If `public_website/` is deleted and recreated, or replaced in a way that changes the host directory inode, the running nginx container can keep an **empty** mount. The site then returns **403 Forbidden** even though `index.html` exists on the host.

On the VPS:

```bash
cd /home/malike/apps/core.carinaai.uk
bash docker/scripts/reload-marketing-nginx.sh
```

The refresh script writes `public_website/.nginx-reloaded-at`. The healthcheck
uses that stamp to detect homepage edits that were copied into `public_website/`
without a matching nginx refresh.

If the monitor is installed with the provided cron or systemd helper, it will
attempt one self-heal by recreating nginx before failing.

If you rsync into `public_website/` by hand, you must run the reload script
immediately afterward. Otherwise the healthcheck will flag the site as stale.

## Do not

- Do **not** point production `carinaai.uk` only at `/www/wwwroot/carinaai.uk` on host nginx; public traffic uses **Docker nginx** on ports 80/443.
- Do **not** `rm -rf public_website` and `mkdir` without recreating nginx afterward.
- Prefer `rsync` into the existing directory (as `deploy-marketing.sh` does) over replacing the whole folder.

## Verify

```bash
docker exec corecarinaaiuk-nginx-1 test -f /var/www/public_website/index.html && echo OK
curl -fsS -o /dev/null -w '%{http_code}\n' https://carinaai.uk/
bash docker/scripts/check-carina-marketing.sh
```

## Install the monitor on the VPS

Cron mode:

```bash
bash docker/scripts/install-marketing-healthcheck.sh cron
```

Systemd timer mode:

```bash
bash docker/scripts/install-marketing-healthcheck.sh systemd
```

Expect `OK` and `200`.

See also `docker/DEPLOY.md` section **carinaai.uk marketing site**.
