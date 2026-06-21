#!/usr/bin/env bash
# Deploy Carina + Labyrinth Scout production stacks via Docker Compose.
#
# From carina repo root:
#   bash scripts/deploy-carina.sh
#
# Both Carina (core, ops, cloud) and Scout (console, engine) are synced and restarted.
# Nginx runs inside Docker and proxies all domains via the 'proxy' external network.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_LOCAL="${REPO_ROOT}/internal/servers/core.carinaai.uk"
OPS_LOCAL="${REPO_ROOT}/internal/admin/ops.carinaai.uk"
CLOUD_LOCAL="${REPO_ROOT}/external/client-apps/app.carinaai.uk"
SCOUT_CONSOLE_LOCAL="${REPO_ROOT}/internal/servers/console.labyrinthscout.com"
SCOUT_ENGINE_LOCAL="${REPO_ROOT}/internal/servers/scout-engine"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok >/dev/null || {
  echo "ERROR: Cannot SSH to ${VPS_USER}@${VPS_HOST}" >&2
  exit 1
}

log "Syncing core.carinaai.uk..."
rsync -az --delete \
  --exclude='.env' --exclude='.env.*' --exclude='node_modules' --exclude='.git' --exclude='/data/' \
  "${CORE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:/home/malike/apps/core.carinaai.uk/"

log "Syncing ops.carinaai.uk (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "${OPS_LOCAL}/" "${VPS_USER}@${VPS_HOST}:/home/malike/apps/ops.carinaai.uk/"

log "Syncing app.carinaai.uk (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='.next' \
  "${CLOUD_LOCAL}/" "${VPS_USER}@${VPS_HOST}:/home/malike/apps/app.carinaai.uk/"

log "Syncing console.labyrinthscout.com (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "${SCOUT_CONSOLE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:/home/malike/apps/console.labyrinthscout.com/"

log "Syncing scout-engine (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "${SCOUT_ENGINE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:/home/malike/apps/scout-engine/"

log "Running Docker production deploy on VPS..."
ssh "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE'
set -euo pipefail

# Ensure the shared proxy network exists (idempotent).
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

# Carina stack
cd /home/malike/apps/core.carinaai.uk
export CARINA_OPS_CONTEXT=/home/malike/apps/ops.carinaai.uk
export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_CLOUD_CONTEXT=/home/malike/apps/app.carinaai.uk
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile
export CARINA_SSL_DIR=/etc/carina/ssl

test -f .env.docker.runtime || cp .env .env.docker.runtime 2>/dev/null || cp /home/malike/.carina/.env .env.docker.runtime 2>/dev/null || true
test -f /home/malike/apps/ops.carinaai.uk/.env && cp /home/malike/apps/ops.carinaai.uk/.env .env.ops.runtime || true
test -f /home/malike/apps/app.carinaai.uk/.env && cp /home/malike/apps/app.carinaai.uk/.env .env.cloud.runtime || true
if [[ -f /home/malike/secrets/app.carinaai.uk.env ]]; then
  grep -E '^(DATABASE_URL|VAULT_SECRET|BETTER_AUTH|STRIPE_|CARINA_|NEXT_PUBLIC_)' /home/malike/secrets/app.carinaai.uk.env >> .env.cloud.runtime 2>/dev/null || true
fi

python3 docker/scripts/sync-docker-env.py
python3 docker/scripts/sync-ops-env.py
python3 docker/scripts/sync-cloud-env.py
bash docker/scripts/stop-bare-metal-carina.sh
bash docker/scripts/deploy-prod.sh

# Scout stack
cd /home/malike/apps/console.labyrinthscout.com
export SCOUT_ENGINE_CONTEXT=/home/malike/apps/scout-engine
# Copy .env from secrets dir if not already present; never overwrite an existing one.
test -f .env || cp /home/malike/secrets/scout.env .env 2>/dev/null || true
docker compose -f docker-compose.prod.yml pull --ignore-pull-failures 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
REMOTE

log "Deploy complete."
log "Verify Carina: curl -fsS https://core.carinaai.uk/health"
log "Verify Scout:  curl -fsS https://console.labyrinthscout.com/api/health"
