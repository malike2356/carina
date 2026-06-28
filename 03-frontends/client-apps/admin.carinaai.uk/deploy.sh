#!/bin/bash
# deploy.sh - Deploy Carina Admin (admin.carinaai.uk) to Contabo VPS
# Run from admin.carinaai.uk/: bash deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
DEPLOY_DIR="/home/malike/apps/admin.carinaai.uk"
CORE_DIR="/home/malike/apps/core.carinaai.uk"
SERVICE="carina-admin"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

build_local() {
  log "Building Next.js admin app..."
  ./node_modules/.bin/next build || die "Build failed. Run 'pnpm install' first if needed."
}

deploy() {
  check_ssh
  build_local

  log "Preparing remote directories..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_DIR}"

  log "Backing up production .env before sync..."
  ssh "${VPS_USER}@${VPS_HOST}" "test -f ${DEPLOY_DIR}/.env && cp ${DEPLOY_DIR}/.env ${DEPLOY_DIR}/.env.bak.\$(date +%Y%m%d%H%M%S) || true"

  log "Syncing standalone build to VPS..."
  # Never sync or delete production .env. Next.js may copy local .env into standalone/.
  rsync -az --delete \
    --exclude='.env' \
    --filter='protect .env' \
    .next/standalone/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/"
  rsync -az \
    .next/static/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/.next/static/"
  rsync -az \
    public/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/public/"
  rsync -az \
    docker/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/docker/"

  log "Rebuilding docker carina-admin (public HTTPS upstream via docker nginx)..."
  ssh "${VPS_USER}@${VPS_HOST}" bash <<EOF
set -euo pipefail
cd "${CORE_DIR}"
export CARINA_ADMIN_CONTEXT="${DEPLOY_DIR}"
export CARINA_ADMIN_DOCKERFILE=docker/Dockerfile.runtime
test -f "${DEPLOY_DIR}/.env" && cp "${DEPLOY_DIR}/.env" .env.admin.runtime || true
touch .env.admin.runtime
docker compose -f docker-compose.prod.yml build ${SERVICE}
docker compose -f docker-compose.prod.yml up -d --no-deps ${SERVICE}
EOF

  log "Stopping bare-metal supervisor fallback (docker carina-admin is canonical)..."
  ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl stop ${SERVICE} 2>/dev/null || true"

  sleep 3

  ADMIN_HTTP=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    ADMIN_HTTP=$(curl -sS -o /dev/null -w "%{http_code}" https://admin.carinaai.uk/login || true)
    [[ "${ADMIN_HTTP}" == "200" ]] && break
    sleep 3
  done
  log "Admin login: https://admin.carinaai.uk/login -> HTTP ${ADMIN_HTTP}"

  if [[ "${ADMIN_HTTP}" == "200" ]]; then
    log "Deploy complete. Carina Admin is live at https://admin.carinaai.uk (docker carina-admin)"
  else
    die "Docker carina-admin is not healthy (login HTTP ${ADMIN_HTTP}). Check: ssh ${VPS_USER}@${VPS_HOST} 'docker compose -f ${CORE_DIR}/docker-compose.prod.yml logs --tail=50 carina-admin'"
  fi
}

deploy
