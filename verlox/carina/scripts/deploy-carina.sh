#!/usr/bin/env bash
# Deploy Carina + Labyrinth Scout production stacks via Docker Compose.
#
# From carina repo root:
#   bash scripts/deploy-carina.sh
#
# Override defaults for a different server:
#   VPS_HOST=1.2.3.4 VPS_USER=ubuntu APPS_ROOT=/opt/apps bash scripts/deploy-carina.sh
#
# Both Carina (core, ops, cloud) and Scout (console, engine) are synced and restarted.
# Nginx runs inside Docker and proxies all domains via the 'proxy' external network.
# Marketing rsync to public_website/ triggers reload-marketing-nginx.sh (avoids carinaai.uk 403).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_LOCAL="${REPO_ROOT}/02-backends/core.carinaai.uk"
OPS_LOCAL="${REPO_ROOT}/02-backends/admin/ops.carinaai.uk"
CLOUD_LOCAL="${REPO_ROOT}/03-frontends/client-apps/app.carinaai.uk"
ADMIN_LOCAL="${REPO_ROOT}/03-frontends/client-apps/admin.carinaai.uk"
SCOUT_CONSOLE_LOCAL="${REPO_ROOT}/02-backends/console.labyrinthscout.com"
SCOUT_ENGINE_LOCAL="${REPO_ROOT}/02-backends/scout-engine"
CARINA_MARKETING_LOCAL="${REPO_ROOT}/03-frontends/marketing/carinaai.uk"
DOCS_SUBDOMAIN_LOCAL="${REPO_ROOT}/03-frontends/marketing/docs.carinaai.uk"
SCOUT_MARKETING_LOCAL="${REPO_ROOT}/03-frontends/marketing/labyrinthscout.com"
HIREAIVA_MARKETING_LOCAL="${REPO_ROOT}/03-frontends/marketing/hireaiva"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
APPS_ROOT="${APPS_ROOT:-/home/malike/apps}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

SOURCE_REVISION="$(bash "${SCRIPT_DIR}/deploy-preflight.sh")"
export SOURCE_REVISION
log "Deploying committed revision ${SOURCE_REVISION}"

ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok >/dev/null || {
  echo "ERROR: Cannot SSH to ${VPS_USER}@${VPS_HOST}" >&2
  exit 1
}

log "Syncing core.carinaai.uk..."
rsync -az --delete \
  --exclude='.env' --exclude='.env.*' --exclude='node_modules' --exclude='.git' --exclude='/data/' \
  --exclude='docker/pgbouncer/pgbouncer.ini' \
  --exclude='docker/pgbouncer/userlist.txt' \
  --exclude='docs/.vitepress/dist/' \
  "${CORE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/"

log "Syncing ops.carinaai.uk (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.pnpm-store' --exclude='.git' \
  "${OPS_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/ops.carinaai.uk/"

log "Deploying app.carinaai.uk (standalone build + migrations)..."
CARINA_PREPARE_ONLY=1 SOURCE_REVISION="${SOURCE_REVISION}" bash "${CLOUD_LOCAL}/deploy.sh"

log "Deploying admin.carinaai.uk..."
CARINA_PREPARE_ONLY=1 SOURCE_REVISION="${SOURCE_REVISION}" bash "${ADMIN_LOCAL}/deploy.sh"

log "Syncing console.labyrinthscout.com (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "${SCOUT_CONSOLE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/console.labyrinthscout.com/"

log "Syncing scout-engine (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "${SCOUT_ENGINE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/scout-engine/"

if [[ -d "${CARINA_MARKETING_LOCAL}" ]]; then
  log "Syncing carinaai.uk marketing site..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/core.carinaai.uk/public_website'"
  rsync -az --delete \
    --delete-excluded \
    --exclude='.git' \
    "${CARINA_MARKETING_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/public_website/"
else
  log "Skipping independently managed carinaai.uk marketing repository."
fi

log "Deploying install.carinaai.uk..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/core.carinaai.uk/public_website/install'"
rsync -az \
  "${CORE_LOCAL}/install.sh" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/public_website/install/install.sh"

if [[ -d "${SCOUT_MARKETING_LOCAL}" ]]; then
  log "Syncing labyrinthscout.com marketing site..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/labyrinthscout.com-static'"
  rsync -az --delete \
    --delete-excluded \
    --exclude='.git' \
    "${SCOUT_MARKETING_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/labyrinthscout.com-static/"
else
  log "Skipping independently managed labyrinthscout.com marketing repository."
fi

if [[ -s "${HIREAIVA_MARKETING_LOCAL}/index.html" ]]; then
  log "Syncing hireaiva.co.uk marketing site..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '/www/wwwroot/hireaiva.co.uk'"
  rsync -az --delete \
    --delete-excluded \
    --exclude='.git' \
    "${HIREAIVA_MARKETING_LOCAL}/" "${VPS_USER}@${VPS_HOST}:/www/wwwroot/hireaiva.co.uk/"
else
  log "Skipping Hire Aiva marketing because its committed homepage is empty."
fi

log "Building docs.carinaai.uk (Docusaurus, baseUrl /)..."
(
  cd "${DOCS_SUBDOMAIN_LOCAL}"
  pnpm build
)

log "Syncing docs.carinaai.uk static build..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/core.carinaai.uk/docs/.vitepress/dist'"
rsync -az --delete \
  "${DOCS_SUBDOMAIN_LOCAL}/build/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/docs/.vitepress/dist/"

log "Running Docker production deploy on VPS..."
ssh "${VPS_USER}@${VPS_HOST}" bash -s -- "${APPS_ROOT}" "${SOURCE_REVISION}" <<'REMOTE'
set -euo pipefail
APPS_ROOT="$1"; shift
export SOURCE_REVISION="$1"; shift

# Ensure the shared proxy network exists (idempotent).
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

# Carina stack
cd "$APPS_ROOT/core.carinaai.uk"
export CARINA_OPS_CONTEXT="$APPS_ROOT/ops.carinaai.uk"
export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_CLOUD_CONTEXT="$APPS_ROOT/app.carinaai.uk"
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_ADMIN_CONTEXT="$APPS_ROOT/admin.carinaai.uk"
export CARINA_ADMIN_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_SSL_DIR=/etc/letsencrypt

upsert_env_value() {
  local key="$1"
  local value="$2"
  local filename="$3"
  python3 - "$key" "$value" "$filename" <<'PY'
from pathlib import Path
import sys

key, value, filename = sys.argv[1:]
path = Path(filename)
lines = path.read_text().splitlines() if path.exists() else []
replacement = f"{key}={value}"

for index, existing in enumerate(lines):
    if existing.startswith(f"{key}="):
        lines[index] = replacement
        break
else:
    lines.append(replacement)

path.write_text("\n".join(lines) + "\n")
PY
}

test -f .env.docker.runtime || cp .env .env.docker.runtime
test -f "$APPS_ROOT/ops.carinaai.uk/.env" && cp "$APPS_ROOT/ops.carinaai.uk/.env" .env.ops.runtime || true
test -f "$APPS_ROOT/app.carinaai.uk/.env" && cp "$APPS_ROOT/app.carinaai.uk/.env" .env.cloud.runtime || true
test -f "$APPS_ROOT/admin.carinaai.uk/.env" && cp "$APPS_ROOT/admin.carinaai.uk/.env" .env.admin.runtime || true
SECRETS_DIR="$(dirname "$APPS_ROOT")/secrets"
if [[ -f "$SECRETS_DIR/app.carinaai.uk.env" ]]; then
  grep -E '^(DATABASE_URL|VAULT_SECRET|BETTER_AUTH|STRIPE_|CARINA_|NEXT_PUBLIC_)' \
    "$SECRETS_DIR/app.carinaai.uk.env" >> .env.cloud.runtime 2>/dev/null || true
fi
if [[ -f "$SECRETS_DIR/core.carinaai.uk.env" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^# ]] && continue
    [[ "$line" != *"="* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ -n "$value" ]] || continue
    upsert_env_value "$key" "$value" .env.docker.runtime
  done < <(grep -E '^(AI_WORKERS_ENABLED|CHANNEL_CREDENTIAL_KEY|WHATSAPP_|BAILEYS_|CARINA_WHATSAPP_|SLACK_|POSTMARK_|TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK|REDIS_PASSWORD)' \
    "$SECRETS_DIR/core.carinaai.uk.env")
fi
if [[ -f "$SECRETS_DIR/admin.carinaai.uk.env" ]]; then
  bridge_secret="$(grep '^OPS_BRIDGE_SECRET=' "$SECRETS_DIR/admin.carinaai.uk.env" | tail -n 1 | cut -d= -f2-)"
  if [[ -n "$bridge_secret" ]]; then
    upsert_env_value OPS_BRIDGE_SECRET "$bridge_secret" .env.ops.runtime
    upsert_env_value OPS_BRIDGE_SECRET "$bridge_secret" .env.admin.runtime
  fi
fi
if [[ -f "$SECRETS_DIR/core.carinaai.uk.env" ]]; then
  grep '^REDIS_PASSWORD=' "$SECRETS_DIR/core.carinaai.uk.env" >> .env 2>/dev/null || true
fi
if [[ -f "$SECRETS_DIR/app.carinaai.uk.env" ]]; then
  for key in CARINA_OPS_TOKEN CARINA_INTERNAL_KEY; do
    if ! grep -qE "^${key}=.+" .env.docker.runtime 2>/dev/null; then
      grep "^${key}=" "$SECRETS_DIR/app.carinaai.uk.env" >> .env.docker.runtime 2>/dev/null || true
    fi
  done
fi

python3 docker/scripts/sync-docker-env.py
python3 docker/scripts/sync-ops-env.py
python3 docker/scripts/sync-cloud-env.py
set -a
# shellcheck disable=SC1090
[[ -f "$SECRETS_DIR/core.carinaai.uk.env" ]] && source "$SECRETS_DIR/core.carinaai.uk.env"
set +a
export REDIS_PASSWORD
bash docker/scripts/stop-bare-metal-carina.sh </dev/null
bash docker/scripts/deploy-prod.sh </dev/null
bash docker/scripts/reload-marketing-nginx.sh </dev/null

# Scout stack
cd "$APPS_ROOT/console.labyrinthscout.com"
export SCOUT_ENGINE_CONTEXT="$APPS_ROOT/scout-engine"
# Copy .env from secrets dir if not already present; never overwrite an existing one.
test -f .env || cp "$SECRETS_DIR/scout.env" .env 2>/dev/null || true
bash deploy-atomic.sh </dev/null

# Prune stopped containers only after both stacks are healthy. Release image
# retention and dangling-image cleanup are handled by deploy-atomic.sh.
docker container prune -f 2>/dev/null || true
REMOTE

log "Running final public health checks..."
for url in \
  "https://core.carinaai.uk/health" \
  "https://app.carinaai.uk/api/health" \
  "https://ops.carinaai.uk/health" \
  "https://console.labyrinthscout.com/api/readiness"
do
  ok=0
  for _ in $(seq 1 10); do
    if curl -fsS --max-time 10 "${url}" >/dev/null; then
      ok=1
      break
    fi
    sleep 3
  done
  if [[ "${ok}" != "1" ]]; then
    echo "ERROR: Public health check failed: ${url}" >&2
    exit 1
  fi
  log "Healthy: ${url}"
done

log "Deploy complete for ${SOURCE_REVISION}."
