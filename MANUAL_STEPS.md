# Manual Steps - What You Must Do

This file lists the three things that require human action.
Everything that could be automated has already been coded and pushed.

---

## Step 1 - Add GitHub Secrets (10 minutes)

The deploy workflow (`.github/workflows/deploy.yml`) needs three secrets.
Without them, auto-deploy will fail every push.

Go to: https://github.com/malike2356/carina-ai/settings/secrets/actions

Add these three secrets:

| Secret name | Value |
|---|---|
| `VPS_HOST` | `80.190.81.208` |
| `VPS_USER` | `malike` |
| `VPS_SSH_KEY` | Your private SSH key (the one used to SSH into the VPS) |

To get the private key value:

```bash
cat ~/.ssh/id_rsa
# or whichever key you use to SSH to the VPS
# Copy everything including -----BEGIN ... and -----END ... lines
```

Once these secrets exist, every push to `main` that passes CI will automatically
deploy to the VPS. No manual rsync or SSH needed.

---

## Step 2 - VPS Docker Cutover (30-60 minutes, pick a quiet window)

The VPS is still running the old bare-metal nginx + supervisor setup.
The Docker stack is ready but not live yet. This step switches over.

Full instructions: `internal/servers/core.carinaai.uk/docker/DEPLOY.md`
Detailed steps: `product/planning/prompts/gold_standard_gaps/sprint-2/gap-13-docker-migration/04-cutover.md`

Short version - SSH into the VPS and run:

```bash
ssh malike@80.190.81.208

# 1. Create the shared Docker network (one-time)
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

# 2. Make sure .env files exist for both stacks (they should from previous deploys)
ls /home/malike/apps/core.carinaai.uk/.env
ls /home/malike/apps/console.labyrinthscout.com/.env

# 3. Build and start the Carina Docker stack
cd /home/malike/apps/core.carinaai.uk
export CARINA_OPS_CONTEXT=/home/malike/apps/ops.carinaai.uk
export CARINA_CLOUD_CONTEXT=/home/malike/apps/app.carinaai.uk
export CARINA_SSL_DIR=/etc/carina/ssl
docker compose -f docker-compose.prod.yml up -d --build

# 4. Build and start the Scout Docker stack
cd /home/malike/apps/console.labyrinthscout.com
export SCOUT_ENGINE_CONTEXT=/home/malike/apps/scout-engine
docker compose -f docker-compose.prod.yml up -d --build

# 5. Stop the old bare-metal nginx (Docker nginx takes over ports 80 and 443)
# WARNING: this is the moment of cutover - the old server stops here
sudo systemctl stop nginx 2>/dev/null || sudo service nginx stop 2>/dev/null || true

# 6. Check everything is up
docker ps
curl -fsS https://core.carinaai.uk/health
curl -fsS https://console.labyrinthscout.com/api/readiness
```

If anything goes wrong, restart old nginx: `sudo systemctl start nginx`
The Docker containers do not interfere with the old nginx while it's running.

After 30 minutes of healthy service, run the cleanup:
`product/planning/prompts/gold_standard_gaps/sprint-2/gap-13-docker-migration/05-cleanup.md`

---

## Step 3 - Commit the 308 Uncommitted Changes (when ready)

There are 308 tracked files modified in the working tree that have not been staged.
These are feature changes across multiple services from ongoing development.

To see what they are:
```bash
cd /opt/lampp/htdocs/verlox/carina
git diff --stat HEAD | head -40
```

These are not blocking anything. They will be included in the next deploy
once committed and pushed. Commit them in logical groups when you are ready.

---

## What Is Already Done (no action needed)

- 10 commits pushed to GitHub main (nginx fixes, deploy script, gap-14/15 portability)
- GitHub Actions CI runs automatically on every push (tests Linux/Windows/macOS)
- GitHub Actions deploy workflow created - fires after CI passes on main
- `scripts/deploy-carina.sh` now accepts `APPS_ROOT`, `VPS_HOST`, `VPS_USER` overrides
- Scout Docker build context fixed (no longer hard-coded to `/home/malike/apps`)
- Ops panel path resolution fixed (finds core .env correctly on local dev)
- `SCOUT_HTPASSWD_USER` now reads from env instead of being hard-coded to 'malike'
- Stale bare-metal nginx configs deleted from repo
- Gap-15 portability prompts written for remaining items
