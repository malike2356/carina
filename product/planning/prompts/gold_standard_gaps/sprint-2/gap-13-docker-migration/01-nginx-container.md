# Gap 13 - Prompt 01: Nginx Container Config

**Gap:** 13 Docker Migration
**Prompt number:** 01 of 05
**Name:** Nginx Container - Vhost Configs and Shared Proxy Network
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** README.md (read it first)

---

## Read First

Before writing anything, read these files IN FULL:

1. `/home/malike/apps/core.carinaai.uk/docker-compose.prod.yml` - the existing compose
   (SSH to VPS or read the local copy in the repo)
2. `/home/malike/apps/core.carinaai.uk/docker/nginx/` - list this directory and read every
   file. These are the existing nginx configs for the Docker nginx container.
3. All current bare-metal nginx vhosts (SSH to VPS):
   - `/etc/nginx/conf.d/app.carinaai.uk.conf`
   - `/etc/nginx/conf.d/core.carinaai.uk.conf`
   - `/etc/nginx/conf.d/hub.carinaai.uk.conf`
   - `/etc/nginx/conf.d/ops.carinaai.uk.conf`
   - `/etc/nginx/conf.d/console.labyrinthscout.com.conf`
   - `/etc/nginx/conf.d/labyrinthscout.com.conf`
   - `/etc/nginx/conf.d/carinaai.uk.conf`

The goal is to understand what configs already exist in `core.carinaai.uk/docker/nginx/`
and what needs to be added or updated before relying on the Docker nginx container.

---

## Context

The existing `core.carinaai.uk/docker-compose.prod.yml` already defines an nginx service.
It currently mounts:
- `./docker/nginx/carina-prod.conf` as the main default config
- `./docker/nginx/hub.carinaai.uk.conf` for the hub vhost
- SSL dir from `${CARINA_SSL_DIR:-/etc/carina/ssl}`
- certbot challenge dir

The SSL mount path in the compose file needs to change: SSL certs are managed by the
host's certbot at `/etc/letsencrypt/live/`. The Docker nginx should mount that host path
directly (read-only). No certbot container is needed for SSL - the host already renews certs.

The Scout domains (`console.labyrinthscout.com`, `labyrinthscout.com`) are served by the
bare-metal nginx today. The Docker nginx must also serve these once it takes over.

---

## Step 1: Create the proxy Docker network definition

The nginx container needs to reach both Carina services and Scout services. Because Carina
and Scout run as separate Compose stacks, they cannot share a network defined inside either
compose file. The solution is a pre-created external network.

Add this to the deploy instructions (not to any compose file yet - this is a one-time setup
command that will be run during prompt 04 cutover):

```bash
docker network create proxy
```

Document this command at the top of `04-cutover.md` (already there as Step 0).

---

## Step 2: Write the Scout vhost nginx configs

The `core.carinaai.uk/docker/nginx/` directory has Carina vhosts. It needs Scout vhosts added.

Check the directory first. If `console.labyrinthscout.com.conf` already exists there, read it
and verify it uses Docker service names (not 127.0.0.1:PORT). If it does not exist, create it.

Create `core.carinaai.uk/docker/nginx/console.labyrinthscout.com.conf`:

```nginx
server {
    listen 80;
    server_name console.labyrinthscout.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://console.labyrinthscout.com$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name console.labyrinthscout.com;

    ssl_certificate     /etc/nginx/ssl/labyrinthscout.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/labyrinthscout.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    # All traffic goes to the labyrinth-scout container on the proxy network.
    # Location blocks mirror the bare-metal config: /api/, /account, /pricing,
    # /dashboard/js/, /dashboard/css/, /dashboard, /
    location /api/ {
        proxy_pass         http://labyrinth-scout:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    location /account {
        proxy_pass         http://labyrinth-scout:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    location /pricing {
        proxy_pass         http://labyrinth-scout:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    location /dashboard/js/ {
        proxy_pass         http://labyrinth-scout:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /dashboard/css/ {
        proxy_pass         http://labyrinth-scout:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /dashboard {
        proxy_pass         http://labyrinth-scout:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass         http://labyrinth-scout:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
```

Note: port 3001 is the Scout console port inside the container. Verify this matches the
`SCOUT_PORT` value in the Scout stack's compose file (see Prompt 03).

---

## Step 3: Write labyrinthscout.com static vhost config

Create `core.carinaai.uk/docker/nginx/labyrinthscout.com.conf`:

```nginx
server {
    listen 80;
    server_name labyrinthscout.com www.labyrinthscout.com;
    return 301 https://labyrinthscout.com$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name www.labyrinthscout.com;

    ssl_certificate     /etc/nginx/ssl/labyrinthscout.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/labyrinthscout.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    return 301 https://labyrinthscout.com$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name labyrinthscout.com;

    ssl_certificate     /etc/nginx/ssl/labyrinthscout.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/labyrinthscout.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Static marketing site served from host-mounted volume.
    root /var/www/labyrinthscout.com;
    index index.html;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

The `labyrinthscout.com-static` files live at `/home/malike/apps/labyrinthscout.com-static/`
on the host. Mount that path into the nginx container (added in Prompt 02).

---

## Step 4: Audit existing Carina nginx configs in docker/nginx/

Read every existing file in `core.carinaai.uk/docker/nginx/`. Check each one for:

1. Does it use `127.0.0.1:PORT` anywhere? If yes, replace with Docker service name + internal port:
   - `127.0.0.1:4100` -> `carina-cloud:4100`
   - `127.0.0.1:3300` or `127.0.0.1:3000` -> `carina-web:3000`
   - `127.0.0.1:3001` -> `carina-hub:3001`
   - `127.0.0.1:4001` -> `carina-ops:4001`

2. Does it reference `/etc/letsencrypt/` for SSL? If yes, change the path to `/etc/nginx/ssl/`
   (we will mount `/etc/letsencrypt/live` to `/etc/nginx/ssl` in the compose file).

3. Does `hub.carinaai.uk.conf` already exist and use correct service names? If yes, no change.

---

## Step 5: Update the SSL volume mount in the compose nginx service

This change goes into `core.carinaai.uk/docker-compose.prod.yml`.

Find the `nginx` service volumes section. It currently has:
```yaml
- ${CARINA_SSL_DIR:-/etc/carina/ssl}:/etc/nginx/ssl:ro
```

Change it to:
```yaml
- /etc/letsencrypt/live:/etc/nginx/ssl:ro
```

This mounts the host's existing Let's Encrypt certs directly. No cert migration needed.
The host's own certbot cron continues renewing certs as before.

Also add the Scout static site mount and the Scout vhost configs:
```yaml
volumes:
  # existing entries (keep all of them) ...
  - /etc/letsencrypt/live:/etc/nginx/ssl:ro        # changed from CARINA_SSL_DIR
  - ./docker/nginx/console.labyrinthscout.com.conf:/etc/nginx/conf.d/console.labyrinthscout.com.conf:ro
  - ./docker/nginx/labyrinthscout.com.conf:/etc/nginx/conf.d/labyrinthscout.com.conf:ro
  - /home/malike/apps/labyrinthscout.com-static:/var/www/labyrinthscout.com:ro
```

Remove the certbot container service from `docker-compose.prod.yml`. The host manages renewal.
Removing it reduces complexity without any loss of function.

---

## Step 6: Add the proxy network to the nginx service and the compose file

In `docker-compose.prod.yml`, add the `proxy` network as an external network:

```yaml
networks:
  carina:
    driver: bridge
  proxy:
    external: true
    name: proxy
```

Then add `proxy` to the nginx service networks:
```yaml
nginx:
  networks:
    - carina
    - proxy
```

Keep `carina` so nginx can still reach carina-web, carina-hub, carina-ops, carina-cloud
by their service names on the carina network.

The `proxy` network is how Scout containers will be reachable by nginx (see Prompt 03).

---

## Verification (before cutover)

After writing the configs, verify syntax locally:

```bash
# Spin up nginx in test mode (no SSL, no Scout upstreams yet - just check config parse)
cd /home/malike/apps/core.carinaai.uk   # or the local repo path
docker compose -f docker-compose.prod.yml config 2>&1 | head -20
```

Look for YAML parse errors only. SSL and upstream connectivity cannot be tested until
the full cutover (Prompt 04).

Do NOT start nginx yet. The bare-metal nginx is still running and port 80/443 are in use.
