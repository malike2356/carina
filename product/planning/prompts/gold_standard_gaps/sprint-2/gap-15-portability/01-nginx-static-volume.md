# Gap 15 - Prompt 01: Fix nginx Static Volume + Local Dev Compose

**Gap:** 15 Portability
**Prompt number:** 01 of 03
**Name:** Fix LABYRINTHSCOUT_STATIC default; create docker-compose.local.yml
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** Nothing; independent fix

---

## Problem 1: nginx fails to start on a new server

In `internal/servers/core.carinaai.uk/docker-compose.prod.yml`:

```yaml
- ${LABYRINTHSCOUT_STATIC:-/home/malike/apps/labyrinthscout.com-static}:/var/www/labyrinthscout.com:ro
```

On any server other than the Contabo VPS, `/home/malike/apps/labyrinthscout.com-static` does
not exist. Docker bind-mount of a non-existent directory creates the directory as root but
nginx then serves an empty directory rather than the marketing site. Worse, on some Docker
versions the mount silently fails, causing the `labyrinthscout.com` vhost to return 404 for
all static assets.

**Fix:** The labyrinthscout.com static site lives in the repo at `marketing/sites/labyrinthscout.com/`.
Change the default to point at the repo-relative path, so a fresh git clone and `docker compose up`
produces a working nginx without any manual directory setup.

---

## Step 1: Verify the marketing site exists in the repo

```bash
ls /opt/lampp/htdocs/verlox/carina/marketing/sites/labyrinthscout.com/
```

If this directory does NOT exist, check `marketing/sites/` and find the correct path.
The nginx `labyrinthscout.com.conf` serves it as a static root - it needs to contain `index.html`.

---

## Step 2: Update the nginx volume in docker-compose.prod.yml

In `internal/servers/core.carinaai.uk/docker-compose.prod.yml`, find the nginx volumes section
and change the LABYRINTHSCOUT_STATIC line:

Before:
```yaml
- ${LABYRINTHSCOUT_STATIC:-/home/malike/apps/labyrinthscout.com-static}:/var/www/labyrinthscout.com:ro
```

After:
```yaml
- ${LABYRINTHSCOUT_STATIC:-../../../marketing/sites/labyrinthscout.com}:/var/www/labyrinthscout.com:ro
```

The relative path `../../../marketing/sites/labyrinthscout.com` is relative to the compose file
location (`internal/servers/core.carinaai.uk/`), so it resolves to `marketing/sites/labyrinthscout.com`
from repo root.

If the static site is at a different path in the repo, adjust accordingly. If there is no
static site in the repo at all (it only exists on the VPS), create a minimal placeholder:

```bash
mkdir -p marketing/sites/labyrinthscout.com
cat > marketing/sites/labyrinthscout.com/index.html << 'EOF'
<!DOCTYPE html><html><head><title>Labyrinth Scout</title></head>
<body><p>Scout - <a href="https://console.labyrinthscout.com">Sign in</a></p></body></html>
EOF
```

---

## Problem 2: No zero-friction local dev compose

Running the full prod compose locally requires:
- SSL certs at `/etc/carina/ssl` (doesn't exist locally)
- `LABYRINTHSCOUT_STATIC` pointing to a local path
- The proxy external network

None of this is documented and none of it "just works" on a fresh clone.

## Step 3: Create `docker-compose.local.yml`

Create `internal/servers/core.carinaai.uk/docker-compose.local.yml` - a local dev override
that strips out SSL, nginx, and certbot, and exposes ports directly for testing.

This file uses Docker Compose `extends` or override pattern. It is used as:
```bash
docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up
```

```yaml
# docker-compose.local.yml - LOCAL DEV ONLY. Not for production.
# Usage: docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up
# Overrides: removes nginx+certbot, exposes app ports directly, uses repo paths.

services:
  # Expose app service ports directly for local testing
  carina-web:
    ports:
      - "3000:3000"

  carina-hub:
    ports:
      - "3001:3001"

  carina-ops:
    ports:
      - "4001:4001"
    environment:
      CARINA_CORE_ENV_PATH: ""
      SCOUT_CONSOLE_PUBLIC_DIR: ""

  carina-cloud:
    ports:
      - "4100:4100"

  # Disable nginx and certbot - not needed for local dev
  nginx:
    profiles:
      - disabled

  certbot:
    profiles:
      - disabled
```

Also create `internal/servers/console.labyrinthscout.com/docker-compose.local.yml`:

```yaml
# docker-compose.local.yml - LOCAL DEV ONLY.
# Usage: docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up

services:
  labyrinth-scout:
    ports:
      - "4444:4444"

  scout-engine:
    ports:
      - "4455:4455"
```

---

## Step 4: Document in docker/DEPLOY.md

In `internal/servers/core.carinaai.uk/docker/DEPLOY.md`, add a "Local dev with Docker" section:

```markdown
## Local dev with Docker (no SSL, ports exposed directly)

docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up

Services available at:
- http://localhost:3000  - Carina core API
- http://localhost:3001  - Skills hub
- http://localhost:4001  - Ops panel
- http://localhost:4100  - Cloud UI (Next.js)
```

---

## Verification checklist

- [ ] `LABYRINTHSCOUT_STATIC` default changed to repo-relative path in docker-compose.prod.yml
- [ ] nginx starts successfully with `docker compose up -d nginx` (no missing volume errors)
- [ ] `docker-compose.local.yml` created for Carina stack
- [ ] `docker-compose.local.yml` created for Scout stack
- [ ] Local dev command works: `docker compose -f docker-compose.prod.yml -f docker-compose.local.yml up`
- [ ] http://localhost:3000/api/health returns 200 in local Docker mode
