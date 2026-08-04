# Admin IP allowlist (Docker nginx)

**Phase: after GTM setup** (`docker/config/gtm-rollout.json`, env `NGINX_ADMIN_IP_ALLOWLIST=false`)

IP geo blocking is **off for GTM launch**. `admin.carinaai.uk` and `staging.*` are open at nginx; protection is admin TOTP plus blocking `/api/admin/*` on `core.carinaai.uk`.

Enable only after public GTM is live (`app.carinaai.uk` / `admin.hireaiva.co.uk` funnel stable).

## When enabling (post-GTM)

1. Set `NGINX_ADMIN_IP_ALLOWLIST=true` (and `NGINX_STAGING_IP_ALLOWLIST=true` if needed) in `.env.docker.runtime` on the VPS.
2. Restore a `geo` block and `if ($admin_allowed = 0) { return 403; }` in:
   - `docker/nginx/admin.carinaai.uk.conf`
   - `docker/nginx/staging.carinaai.uk.conf` (use `geo $staging_allowed`)
3. Add team IPs (and UptimeRobot probes if monitoring admin health).
4. `nginx -t` and reload.

Add one line per IP in the geo block:

```nginx
geo $admin_allowed {
  default 0;
  203.0.113.10 1; # VERLOX office
}
```

Inside the `server` block:

```nginx
  if ($admin_allowed = 0) { return 403; }
```

## UptimeRobot probes (admin health monitor)

When the allowlist is on, add probe IPs so `GET /api/health` is not blocked:

```nginx
216.144.248.16 1; # UptimeRobot
216.144.248.17 1;
216.144.248.18 1;
216.144.248.19 1;
216.144.248.20 1;
```

Full list: https://uptimerobot.com/help/locations/

```bash
cd /home/malike/apps/core.carinaai.uk
docker compose -f docker-compose.prod.yml exec nginx nginx -t
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```
