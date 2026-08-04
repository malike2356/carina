# carinaai.uk marketing files (Docker nginx mount)

This directory is the **live** document root for `https://carinaai.uk/` and `https://www.carinaai.uk/`.

Docker nginx (`corecarinaaiuk-nginx-1`) bind-mounts this folder read-only:

```text
./public_website  ->  /var/www/public_website
```

Configured in `docker/nginx/carina-prod.conf` and `docker-compose.prod.yml`.

## Deploy source

Canonical site source in git: `frontends/marketing/carinaai.uk/`

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

## Do not

- Do **not** point production `carinaai.uk` only at `/www/wwwroot/carinaai.uk` on host nginx; public traffic uses **Docker nginx** on ports 80/443.
- Do **not** `rm -rf public_website` and `mkdir` without recreating nginx afterward.
- Prefer `rsync` into the existing directory (as `deploy-marketing.sh` does) over replacing the whole folder.

## Verify

```bash
docker exec corecarinaaiuk-nginx-1 test -f /var/www/public_website/index.html && echo OK
curl -fsS -o /dev/null -w '%{http_code}\n' https://carinaai.uk/
```

Expect `OK` and `200`.

See also `docker/DEPLOY.md` section **carinaai.uk marketing site**.
