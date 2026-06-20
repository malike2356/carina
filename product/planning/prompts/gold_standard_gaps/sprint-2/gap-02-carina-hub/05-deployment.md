# Gap 02 - File 5: Hub Deployment

Agent: Claude Code (primary), Codex (fallback)
Estimated time: 2-3 hours

---

## Context

The Carina Skills Hub runs as a Node.js process on port 3001. On the
VPS (Contabo, 80.190.81.208), it is managed by supervisor as
`carina-hub` (config at
`core.carinaai.uk/docker/supervisor/carina-hub.conf`). Nginx proxies
hub.carinaai.uk to 127.0.0.1:3001. The nginx config already exists at
`core.carinaai.uk/docker/nginx/hub.carinaai.uk.conf`.

The `carina-agent-public/` directory at the repo root is the public
distribution used for deployment. It has its own `package.json`,
`docker-compose.yml`, `docker-compose.prod.yml`, and `start.sh`.

The goal of this file is to wire everything together so that the hub is
deployable in two ways:
1. Via supervisor on the raw VPS (existing pattern - just document and
   wire the env vars)
2. Via Docker Compose as part of the Verlox personal stack in
   `docker-compose.verlox.yml`

There is no `carina-hub` service in `docker-compose.verlox.yml` yet.

---

## Step 1: Read these files first

1. `core.carinaai.uk/docker/nginx/hub.carinaai.uk.conf` - full file;
   understand which upstream port and paths are already configured
2. `core.carinaai.uk/docker/supervisor/carina-hub.conf` - full file;
   understand all environment variables the hub process needs
3. `core.carinaai.uk/docker-compose.verlox.yml` - full file; understand
   the service structure to add a hub service that fits in
4. `carina-agent-public/docker-compose.prod.yml` - understand whether a
   hub service is already defined there
5. `core.carinaai.uk/docker/HUB_DEPLOY.md` - read the existing deploy
   notes

---

## Step 2: Add carina-hub service to docker-compose.verlox.yml

In `core.carinaai.uk/docker-compose.verlox.yml`, before the `networks:`
block at the bottom, add a new service:

```yaml
  # Carina Skills Hub (hub.carinaai.uk)
  carina-hub:
    build:
      context: .
      dockerfile: docker/Dockerfile.carina
    command: node dist/src/skills/hub/server.js
    environment:
      NODE_ENV: "production"
      SKILLS_HUB_PORT: "3001"
      SKILLS_HUB_DATABASE_URL: postgresql://carina:${DB_PASSWORD:-secret}@postgres:5432/carina_skills_hub
      SKILLS_HUB_PUBLISH_KEY: ${HUB_PUBLISH_KEY:-change-me-32-char-secret}
      HUB_STRIPE_SECRET_KEY: ${HUB_STRIPE_SECRET_KEY:-}
      HUB_STRIPE_WEBHOOK_SECRET: ${HUB_STRIPE_WEBHOOK_SECRET:-}
      HUB_CHECKOUT_SUCCESS_URL: "https://hub.carinaai.uk/?purchase=success"
      HUB_CHECKOUT_CANCEL_URL: "https://hub.carinaai.uk/?purchase=cancel"
      HUB_PACK_AUTHOR_REVENUE_SHARE_BPS: "7000"
      HUB_PACK_CARINA_REVENUE_SHARE_BPS: "2000"
      HUB_PACK_PLATFORM_FEE_BPS: "1000"
    volumes:
      - hub_packs:/data/hub-packs
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - carina
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

Also add a volume definition. Find or create the `volumes:` block at
the top level of `docker-compose.verlox.yml` (after `services:` and
before `networks:`) and add:

```yaml
volumes:
  hub_packs:
```

If a `volumes:` block already exists in the file, just add `hub_packs:`
to it.

---

## Step 3: Create a hub-specific database init in postgres/init.sql

Open `core.carinaai.uk/docker/postgres/init.sql` and check if
`carina_skills_hub` database is created. If not, append:

```sql
-- Skills Hub database (hub.carinaai.uk)
CREATE DATABASE carina_skills_hub
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.utf8'
  LC_CTYPE 'en_US.utf8'
  TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE carina_skills_hub TO carina;
```

Do not modify any existing SQL in the file. Only append if the database
does not already exist in the file.

---

## Step 4: Document environment variables

Create `core.carinaai.uk/docker/HUB_ENV.md` with this content:

```markdown
# Hub Environment Variables

All variables are consumed by the carina-hub supervisor process and the
Docker carina-hub service.

## Required

| Variable | Description | Example |
|---|---|---|
| SKILLS_HUB_PORT | Port the hub server listens on | 3001 |
| SKILLS_HUB_DATABASE_URL | PostgreSQL connection string | postgresql://carina:secret@localhost:5433/carina_skills_hub |
| SKILLS_HUB_PUBLISH_KEY | 32-char secret for pack publishing API | (generate with: openssl rand -hex 16) |

## Stripe (optional - required only for paid packs)

| Variable | Description |
|---|---|
| HUB_STRIPE_SECRET_KEY | Stripe secret key (sk_live_...) |
| HUB_STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret (whsec_...) |
| HUB_CHECKOUT_SUCCESS_URL | Redirect after successful payment |
| HUB_CHECKOUT_CANCEL_URL | Redirect after cancelled payment |
| HUB_PACK_AUTHOR_REVENUE_SHARE_BPS | Author share in basis points (7000 = 70%) |
| HUB_PACK_CARINA_REVENUE_SHARE_BPS | Carina platform share (2000 = 20%) |
| HUB_PACK_PLATFORM_FEE_BPS | Payment processor fee estimate (1000 = 10%) |

## Security scanner (optional)

| Variable | Description | Default |
|---|---|---|
| CARINA_HUB_SANDBOX_SCAN | Run JS blocks through worker sandbox | false |

## DNS

Add a CNAME or A record for hub.carinaai.uk pointing to 80.190.81.208
in Cloudflare. The nginx config at docker/nginx/hub.carinaai.uk.conf
handles TLS termination.

## TLS certificate

The nginx config references /etc/letsencrypt/live/carinaai.uk/. If
hub.carinaai.uk is already covered by the wildcard cert, no additional
cert is needed. If not:

    sudo certbot certonly --nginx -d hub.carinaai.uk

## VPS supervisor deploy

1. Copy supervisor/carina-hub.conf to /etc/supervisor/conf.d/ on the VPS
2. Fill in the CHANGE_ME values in the environment= line
3. sudo supervisorctl reread && sudo supervisorctl update
4. sudo supervisorctl start carina-hub

## Docker Compose deploy (Verlox personal stack)

    docker compose -f docker-compose.prod.yml -f docker-compose.verlox.yml up -d carina-hub

Set HUB_PUBLISH_KEY, HUB_STRIPE_SECRET_KEY etc. in your .env file or
pass via environment before running compose.
```

---

## Step 5: Verify carina-agent-public does not duplicate the hub

Open `carina-agent-public/docker-compose.prod.yml`. If it does not
already have a `carina-hub` service, do not add one - the hub is a
first-party VERLOX service and ships only in the Verlox stack. If it
already has a stub, align the environment variable names to match the
ones in Step 2.

---

## Files to create or modify

| File | Action |
|---|---|
| `core.carinaai.uk/docker-compose.verlox.yml` | MODIFY (add carina-hub service + hub_packs volume) |
| `core.carinaai.uk/docker/postgres/init.sql` | MODIFY (add carina_skills_hub database if missing) |
| `core.carinaai.uk/docker/HUB_ENV.md` | CREATE |

Do not modify `docker-compose.prod.yml` or `carina-agent-public/` files
unless a hub service stub already exists there.

---

## Done-when criteria

- [ ] `docker compose -f docker-compose.verlox.yml config` validates
  without errors (run from `core.carinaai.uk/`)
- [ ] The `carina-hub` service appears in the compose config output with
  port 3001 mapped
- [ ] The `hub_packs` named volume is declared
- [ ] `docker/postgres/init.sql` either already had `carina_skills_hub`
  or now has it appended
- [ ] `docker/HUB_ENV.md` exists and documents all required variables
- [ ] The nginx config at `docker/nginx/hub.carinaai.uk.conf` is
  unchanged (it already exists and is correct)
- [ ] No files in `carina-agent-public/` were modified unless they
  already had a hub stub

---

## Do NOT do

- Do not change the supervisor conf for carina-hub (already correct)
- Do not add hub to `docker-compose.prod.yml` (the public image does
  not ship the hub server)
- Do not add new nginx server blocks (the hub.carinaai.uk.conf already
  exists)
- Do not change port 3001 to any other number
