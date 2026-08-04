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
CARINA_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

build_local() {
  log "Building Next.js admin app..."
  mkdir -p public
  ADMIN_BASE_PATH="${ADMIN_BASE_PATH:-/business-inner}" ./node_modules/.bin/next build || die "Build failed. Run 'pnpm install' first if needed."
}

deploy() {
  if [[ -z "${SOURCE_REVISION:-}" ]]; then
    SOURCE_REVISION="$(bash "${CARINA_ROOT}/scripts/deploy-preflight.sh")"
    export SOURCE_REVISION
  fi
  if [[ -z "${SOURCE_CONTENT_DIGEST:-}" ]]; then
    SOURCE_CONTENT_DIGEST="$(bash "${CARINA_ROOT}/scripts/deploy-source-digest.sh" "${SCRIPT_DIR}")"
    export SOURCE_CONTENT_DIGEST
  fi
  check_ssh
  build_local

  STANDALONE_APP_DIR="$(find .next/standalone -path '*/node_modules' -prune -o -name server.js -print | head -1 | xargs -r dirname)"
  [[ -n "${STANDALONE_APP_DIR}" && -f "${STANDALONE_APP_DIR}/server.js" ]] || \
    die "Could not locate the standalone application root."

  log "Preparing remote directories..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_DIR}"

  log "Backing up production .env before sync..."
  ssh "${VPS_USER}@${VPS_HOST}" "test -f ${DEPLOY_DIR}/.env && cp ${DEPLOY_DIR}/.env ${DEPLOY_DIR}/.env.bak.\$(date +%Y%m%d%H%M%S) || true"

  log "Syncing standalone build to VPS..."
  # Never sync or delete production .env. Next.js may copy local .env into standalone/.
  rsync -az --delete \
    --exclude='.env' \
    --filter='protect .env' \
    "${STANDALONE_APP_DIR}/" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/"
  rsync -az \
    .next/static/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/.next/static/"
  rsync -az \
    public/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/public/"
  rsync -az \
    docker/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/docker/"

  if [[ "${CARINA_PREPARE_ONLY:-0}" == "1" ]]; then
    log "Prepared ${DEPLOY_DIR} for atomic deployment at ${SOURCE_REVISION}."
    return
  fi

  log "Rebuilding docker carina-admin (public HTTPS upstream via docker nginx)..."
  ssh "${VPS_USER}@${VPS_HOST}" bash <<EOF
set -euo pipefail
cd "${CORE_DIR}"
export CARINA_ADMIN_CONTEXT="${DEPLOY_DIR}"
export CARINA_ADMIN_DOCKERFILE=docker/Dockerfile.runtime
test -f "${DEPLOY_DIR}/.env" && cp "${DEPLOY_DIR}/.env" .env.admin.runtime || true
touch .env.admin.runtime
export SOURCE_REVISION="${SOURCE_REVISION}"
export SOURCE_CONTENT_DIGEST="${SOURCE_CONTENT_DIGEST}"
bash docker/scripts/deploy-atomic.sh ${SERVICE}
EOF

  log "Stopping bare-metal supervisor fallback (docker carina-admin is canonical)..."
  ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl stop ${SERVICE} 2>/dev/null || true"

  sleep 3

  ADMIN_HTTP=""
  OPS_HTTP=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    OPS_HTTP=$(curl -sS -o /dev/null -w "%{http_code}" https://ops.carinaai.uk/login || true)
    ADMIN_HTTP=$(ssh "${VPS_USER}@${VPS_HOST}" "cd ${CORE_DIR} && docker compose -f docker-compose.prod.yml exec -T carina-web curl -sS -o /dev/null -w '%{http_code}' http://carina-admin:4200/business-inner/api/health" 2>/dev/null || true)
    [[ "${OPS_HTTP}" == "200" && "${ADMIN_HTTP}" == "200" ]] && break
    sleep 3
  done
  log "Ops login: https://ops.carinaai.uk/login -> HTTP ${OPS_HTTP}"
  log "Admin health (internal): carina-admin:4200/business-inner/api/health -> HTTP ${ADMIN_HTTP}"

  if [[ "${OPS_HTTP}" == "200" && "${ADMIN_HTTP}" == "200" ]]; then
    log "Deploy complete. VERLOX Console: https://ops.carinaai.uk (business at /business/customers)"
  else
    die "Deploy health failed (ops login HTTP ${OPS_HTTP}, admin internal HTTP ${ADMIN_HTTP}). Check: ssh ${VPS_USER}@${VPS_HOST} 'docker compose -f ${CORE_DIR}/docker-compose.prod.yml logs --tail=50 carina-ops carina-admin'"
  fi
}

deploy
