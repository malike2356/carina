# Carina Docker deploy notes

This repo already includes the production TLS wiring used by `docker-compose.prod.yml`.
The current stack is not the older "add certbot and rewrite nginx" prompt shape.

## What is already wired

- `docker-compose.prod.yml` includes a `certbot` renewal service
- `docker/nginx/carina-prod.conf` already serves the ACME webroot path and redirects HTTP to HTTPS
- `docker/nginx/carina-prod.conf` and `docker/nginx/hub.carinaai.uk.conf` already point at the shared `carinaai.uk` certificate layout
- `docker/healthcheck.sh` probes the running web gateway

## Initial certificate bootstrap

Use the helper script in this folder to issue the shared production certificate:

```bash
bash docker/scripts/init-certs.sh
```

The script issues a SAN certificate for:

- `carinaai.uk`
- `www.carinaai.uk`
- `app.carinaai.uk`
- `docs.carinaai.uk`
- `hub.carinaai.uk`
- `skills.carinaai.uk`
- `install.carinaai.uk`
- `ops.carinaai.uk`

The Scout console certificate is managed in the Scout repo, not here.

## Renewal

Certbot renews automatically every 12 hours inside the `certbot` service.
Nginx reads the mounted certificate files from `/etc/carina/ssl`.

If you need to reload nginx after a renewal:

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Current deploy flow

1. Ensure the certificate exists
2. Start the stack with `docker compose -f docker-compose.prod.yml up -d`
3. Verify `https://core.carinaai.uk/health` and `https://app.carinaai.uk/`

If you are changing only application code, use the repo deploy script rather than
reworking the TLS stack.
