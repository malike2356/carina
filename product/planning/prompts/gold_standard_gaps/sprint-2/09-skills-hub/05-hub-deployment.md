# Prompt 05: Skills Hub Docker Deployment

## Context

`pnpm hub` starts the Skills Hub server but it runs as a foreground process with no
supervisor and no nginx vhost. The Hub needs to run as a proper service at `skills.carinaai.uk`
(static marketplace) and the hub API at a subdomain accessible to Carina instances.

## What to Build

### 1. Hub supervisor config

Create `docker/supervisor/carina-hub.conf` (if not already the correct version):
```ini
[program:carina-hub]
command=node /app/dist/src/skills/hub.js
directory=/app
autostart=true
autorestart=true
startretries=3
startsecs=5
stopwaitsecs=15
stdout_logfile=/app/data/logs/carina-hub.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
stderr_logfile=/app/data/logs/carina-hub-err.log
stderr_logfile_maxbytes=5MB
stderr_logfile_backups=2
environment=NODE_ENV="production",HUB_PORT="3444"
user=node
```

### 2. Hub nginx vhost

Create `docker/nginx/conf.d/hub.conf`:
```nginx
server {
  listen 80;
  server_name hub.carinaai.uk;
  include /etc/nginx/conf.d/certbot.conf;
  location / { return 301 https://$host$request_uri; }
}

server {
  listen 443 ssl;
  server_name hub.carinaai.uk;
  ssl_certificate     /etc/letsencrypt/live/hub.carinaai.uk/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/hub.carinaai.uk/privkey.pem;
  include /etc/nginx/conf.d/ssl-params.conf;

  # CORS for Carina instances connecting to the hub
  add_header Access-Control-Allow-Origin * always;
  add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

  location / {
    proxy_pass http://carina-hub:3444;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### 3. Hub service in docker-compose.prod.yml

```yaml
carina-hub:
  image: verlox/carina:latest
  restart: unless-stopped
  command: node /app/dist/src/skills/hub.js
  environment:
    HUB_PORT: 3444
    DATABASE_URL: "${DATABASE_URL}"
    HUB_SECRET: "${HUB_SECRET}"
  ports:
    - "3444:3444"
  networks: [backend]
  depends_on: [postgres]
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3444/health"]
    interval: 30s
    timeout: 5s
    retries: 3
```

### 4. Hub authentication

Hub endpoints that allow publishing/submitting skills require API key auth:
```
POST /hub/skills/publish   - requires Bearer token (user's Carina API key)
POST /hub/skills/submit    - requires Bearer token
GET  /hub/skills           - public (no auth)
GET  /hub/skills/:id       - public (no auth)
```

### 5. Hub health endpoint

In `src/skills/hub.ts`, ensure there is a health route:
```typescript
app.get('/health', (_, res) => res.json({ status: 'ok', skills: skillCount }));
```

### 6. DNS setup

Add to the VPS setup instructions:
```
DNS A records needed:
  hub.carinaai.uk -> 80.190.81.208
  skills.carinaai.uk -> 80.190.81.208  (static site, served by nginx)
```

### 7. Hub cert bootstrap

Add to `docker/scripts/init-certs.sh`:
```bash
DOMAINS+=(
  "hub.carinaai.uk"
  "skills.carinaai.uk"
)
```

## Verification Checklist

- [ ] `curl https://hub.carinaai.uk/health` returns `{"status":"ok"}`
- [ ] `supervisorctl status carina-hub` shows RUNNING
- [ ] Hub crashes and restarts automatically (kill the process, see it restart in 3s)
- [ ] `GET https://hub.carinaai.uk/hub/skills` returns list of approved skills (no auth)
- [ ] `POST https://hub.carinaai.uk/hub/skills/publish` without token returns 401

## Files to Create or Modify

- MODIFY `docker/supervisor/carina-hub.conf` - correct port and paths
- CREATE `docker/nginx/conf.d/hub.conf`
- MODIFY `docker-compose.prod.yml` - add carina-hub service
- MODIFY `docker/scripts/init-certs.sh` - add hub and skills domains
- MODIFY `src/skills/hub.ts` - ensure /health and API key auth
