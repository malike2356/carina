# Prompt 03: Production Compose with Auto-TLS

**Status: COMPLETED 2026-06-21**

## Context

`docker-compose.prod.yml` exists but requires manually provisioned TLS certificates.
The deployment goal is one command that brings up all services AND obtains/renews
Let's Encrypt certs via Certbot (webroot or standalone challenge).

The nginx container already handles TLS termination for `core.carinaai.uk`,
`app.carinaai.uk`, `console.labyrinthscout.com`, and `docs.carinaai.uk`.

## What to Build

### 1. Add Certbot service to `docker-compose.prod.yml`

```yaml
certbot:
  image: certbot/certbot:latest
  restart: unless-stopped
  volumes:
    - certbot-certs:/etc/letsencrypt
    - certbot-webroot:/var/www/certbot
  entrypoint: /bin/sh -c "trap exit TERM; while :; do certbot renew --quiet; sleep 12h & wait $${!}; done"

volumes:
  certbot-certs:
  certbot-webroot:
```

Share `certbot-certs` volume with the nginx service and add:
```yaml
nginx:
  volumes:
    - certbot-certs:/etc/letsencrypt:ro
    - certbot-webroot:/var/www/certbot
```

### 2. Nginx webroot challenge config

In `docker/nginx/conf.d/certbot.conf`:
```nginx
location /.well-known/acme-challenge/ {
  root /var/www/certbot;
}
```

Include this in every server block before the HTTPS redirect so the HTTP-01 challenge passes.

### 3. Initial cert bootstrap script

Create `docker/scripts/init-certs.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

DOMAINS=(
  "core.carinaai.uk"
  "app.carinaai.uk"
  "docs.carinaai.uk"
  "console.labyrinthscout.com"
)

EMAIL="lordsesame@gmail.com"

for domain in "${DOMAINS[@]}"; do
  docker compose -f docker-compose.prod.yml run --rm certbot \
    certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$domain"
done
```

Run this once on first deploy before starting nginx with HTTPS blocks.

### 4. HTTPS nginx template

Each vhost config follows this pattern:
```nginx
server {
  listen 80;
  server_name core.carinaai.uk;
  include /etc/nginx/conf.d/certbot.conf;
  location / { return 301 https://$host$request_uri; }
}

server {
  listen 443 ssl;
  server_name core.carinaai.uk;
  ssl_certificate     /etc/letsencrypt/live/core.carinaai.uk/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/core.carinaai.uk/privkey.pem;
  include /etc/nginx/conf.d/ssl-params.conf;
  # ... proxy_pass upstream ...
}
```

Create `docker/nginx/conf.d/ssl-params.conf`:
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
add_header Strict-Transport-Security "max-age=63072000" always;
```

### 5. Deploy steps documentation

Add a `DEPLOY.md` at the root of `core.carinaai.uk/docker/`:
```
First deploy:
1. Start nginx HTTP-only: docker compose -f docker-compose.prod.yml up -d nginx
2. Bootstrap certs: bash docker/scripts/init-certs.sh
3. Switch nginx to HTTPS configs and reload: docker compose exec nginx nginx -s reload
4. Start all services: docker compose -f docker-compose.prod.yml up -d

Renewal:
- Certbot renews automatically every 12h
- nginx reloads via: docker compose exec nginx nginx -s reload
- Add to cron: 0 6 * * * docker compose exec nginx nginx -s reload
```

## Verification Checklist

- [ ] `bash docker/scripts/init-certs.sh` completes without error on fresh VPS
- [ ] `https://core.carinaai.uk/health` returns 200
- [ ] `curl -I http://core.carinaai.uk/` returns 301 redirect to HTTPS
- [ ] SSL Labs scan scores A or better on all four domains
- [ ] Certbot container logs show renewal check every 12h

## Files to Create or Modify

- MODIFY `docker-compose.prod.yml` - add certbot service + shared volumes
- CREATE `docker/nginx/conf.d/certbot.conf`
- CREATE `docker/nginx/conf.d/ssl-params.conf`
- MODIFY `docker/nginx/conf.d/*.conf` - add HTTP-01 challenge block + HTTPS server blocks
- CREATE `docker/scripts/init-certs.sh`
- CREATE `docker/DEPLOY.md`
