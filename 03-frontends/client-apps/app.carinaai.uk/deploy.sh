#!/bin/bash
# deploy.sh - Deploy Carina Cloud (app.carinaai.uk) to Contabo VPS
# Run from app.carinaai.uk/: bash deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

VPS_HOST="80.190.81.208"
VPS_USER="malike"
DEPLOY_DIR="/home/malike/apps/app.carinaai.uk"
CORE_DIR="/home/malike/apps/core.carinaai.uk"
SERVICE="carina-cloud"
CARINA_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
GIT_ROOT="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || true)"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

build_local() {
  log "Syncing multi-theme CSS..."
  node scripts/sync-multi-themes.mjs || die "theme:sync failed."
  log "Building Next.js app..."
  ./node_modules/.bin/next build || die "Build failed. Run 'pnpm install' first if needed."
}

deploy() {
  [[ -n "${GIT_ROOT}" ]] || die "Deployment source must be inside a Git worktree."
  SCRIPT_REL="$(realpath --relative-to="${GIT_ROOT}" "${SCRIPT_DIR}")"
  TRACKED_COUNT="$(git -C "${GIT_ROOT}" ls-files -- "${SCRIPT_REL}" | wc -l)"
  (( TRACKED_COUNT >= 100 )) || \
    die "Refusing untracked deployment mirror ${SCRIPT_DIR}. Use 03-frontends/client-apps/app.carinaai.uk under the carina git root."

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
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_DIR}/src/db/migrations ${DEPLOY_DIR}/scripts"

  log "Backing up production .env before sync..."
  ssh "${VPS_USER}@${VPS_HOST}" "test -f ${DEPLOY_DIR}/.env && cp ${DEPLOY_DIR}/.env ${DEPLOY_DIR}/.env.bak.\$(date +%Y%m%d%H%M%S) || true"

  log "Syncing standalone build to VPS..."
  # Never sync or delete production .env (Next.js copies local .env into standalone/).
  rsync -az --delete \
    --exclude='.env' \
    --filter='protect .env' \
    --filter='protect docker/' \
    --filter='protect Dockerfile.runtime' \
    --exclude='start.sh' \
    --exclude='src/db/' \
    --exclude='src/db/migrations/' \
    --exclude='scripts/' \
    --exclude='.pnpm-store/' \
    --exclude='docker/' \
    --exclude='Dockerfile.runtime' \
    "${STANDALONE_APP_DIR}/" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/"
  rsync -az \
    .next/static/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/.next/static/"
  rsync -az \
    public/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/public/"
  rsync -az \
    src/db/migrations/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/src/db/migrations/"
  rsync -az \
    src/lib/support/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/src/lib/support/"
  rsync -az \
    src/lib/builtin-profiles/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/src/lib/builtin-profiles/"
  rsync -az \
    scripts/vps-schema-patch.sql "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/scripts/vps-schema-patch.sql"
  rsync -az \
    docker/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/docker/"
  # Compose build context expects Dockerfile.runtime at the cloud app root.
  scp docker/Dockerfile.runtime "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/Dockerfile.runtime"
  rsync -az \
    scripts/migrate.mjs "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/scripts/migrate.mjs"
  rsync -az \
    scripts/run-server.mjs "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/run-server.mjs"

  log "Syncing ws dependency for terminal WebSocket proxy..."
  WS_PKG="$(find node_modules/.pnpm -path '*/node_modules/ws/package.json' 2>/dev/null | head -1 || true)"
  if [[ -z "${WS_PKG}" ]]; then
    die "ws package not found locally. Run pnpm install in app.carinaai.uk first."
  fi
  WS_SRC="$(dirname "${WS_PKG}")"
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${DEPLOY_DIR}/node_modules/ws'"
  rsync -az "${WS_SRC}/" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/node_modules/ws/"

  log "Applying database migrations (idempotent)..."
  ssh "${VPS_USER}@${VPS_HOST}" 'bash -s' <<'EOF'
set -euo pipefail
cd /home/malike/apps/app.carinaai.uk

psql() { docker exec -i corecarinaaiuk-postgres-1 psql -U carina -d carina_cloud "$@"; }

# Create tracking table if missing
psql -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS __deploy_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
"

for f in $(find src/db/migrations -maxdepth 1 -type f -name '*.sql' | sort)
do
  name=$(basename "${f}")
  already=$(psql -t -A -c "SELECT 1 FROM __deploy_migrations WHERE filename='${name}'")
  if [[ "${already}" == "1" ]]; then
    echo "  skip ${name} (already applied)"
    continue
  fi
  echo "  apply ${name}"
  cat "${f}" | psql -v ON_ERROR_STOP=1
  psql -v ON_ERROR_STOP=1 -c "INSERT INTO __deploy_migrations(filename) VALUES('${name}')"
done
EOF

  log "Applying idempotent schema patch inside the Docker Postgres service..."
  ssh "${VPS_USER}@${VPS_HOST}" "cat ${DEPLOY_DIR}/scripts/vps-schema-patch.sql | docker exec -i corecarinaaiuk-postgres-1 psql -U carina -d carina_cloud -v ON_ERROR_STOP=1"

  log "Building terminal sandbox image (if Docker available)..."
  ssh "${VPS_USER}@${VPS_HOST}" "if command -v docker >/dev/null 2>&1; then docker build -f ${DEPLOY_DIR}/docker/Dockerfile.sandbox -t carina-sandbox:latest ${DEPLOY_DIR}/docker 2>&1 | tail -5; else echo 'Docker not available; terminal uses host fallback'; fi"

  log "Ensuring production .env is present on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "test -f ${DEPLOY_DIR}/.env" || \
    die "Missing ${DEPLOY_DIR}/.env on VPS. Copy once: scp .env.example ${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/.env then edit secrets on the server."

  log "Ensuring start.sh is present on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "cat > ${DEPLOY_DIR}/start.sh << EOF
#!/bin/bash
set -a
if [[ -f /home/malike/secrets/app.carinaai.uk.env ]]; then
  source /home/malike/secrets/app.carinaai.uk.env
fi
source ${DEPLOY_DIR}/.env
set +a
exec /usr/bin/node ${DEPLOY_DIR}/run-server.mjs
EOF
chmod +x ${DEPLOY_DIR}/start.sh"

  log "Verifying core proxy secrets..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    use_proxy=\$(grep -E '^CARINA_USE_CORE_PROXY=' "${DEPLOY_DIR}/.env" | cut -d= -f2- | tr -d '"' || true)
    if [[ "\${use_proxy}" == "true" ]]; then
      has_token=false
      grep -qE '^CARINA_OPS_TOKEN=.+' "${DEPLOY_DIR}/.env" 2>/dev/null && has_token=true
      grep -qE '^CARINA_OPS_TOKEN=.+' /home/malike/secrets/app.carinaai.uk.env 2>/dev/null && has_token=true
      grep -qE '^CARINA_INTERNAL_KEY=.+' "${DEPLOY_DIR}/.env" 2>/dev/null && has_token=true
      grep -qE '^CARINA_INTERNAL_KEY=.+' /home/malike/secrets/app.carinaai.uk.env 2>/dev/null && has_token=true
      if [[ "\${has_token}" != "true" ]]; then
        echo "WARNING: CARINA_USE_CORE_PROXY=true but no CARINA_OPS_TOKEN/CARINA_INTERNAL_KEY in .env or /home/malike/secrets/app.carinaai.uk.env"
        echo "Cron, MCP, and other core proxy pages will show 'Core proxy is not configured.'"
        exit 1
      fi
    fi
REMOTE

  if [[ "${CARINA_PREPARE_ONLY:-0}" == "1" ]]; then
    log "Prepared ${DEPLOY_DIR} for atomic deployment at ${SOURCE_REVISION}."
    return
  fi

  log "Rebuilding docker carina-cloud (public HTTPS upstream via docker nginx)..."
  ssh "${VPS_USER}@${VPS_HOST}" bash <<EOF
set -euo pipefail
cd "${CORE_DIR}"
export CARINA_CLOUD_CONTEXT="${DEPLOY_DIR}"
set -a
[[ -f /home/malike/secrets/core.carinaai.uk.env ]] && source /home/malike/secrets/core.carinaai.uk.env
set +a
export REDIS_PASSWORD
export SOURCE_REVISION="${SOURCE_REVISION}"
export SOURCE_CONTENT_DIGEST="${SOURCE_CONTENT_DIGEST}"
bash docker/scripts/deploy-atomic.sh carina-cloud
EOF

  log "Stopping bare-metal supervisor fallback (docker carina-cloud is canonical)..."
  ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl stop ${SERVICE} 2>/dev/null || true"

  sleep 3

  THEME_HTTP=""
  APP_HEALTH=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    THEME_HTTP=$(curl -sS -o /dev/null -w "%{http_code}" https://app.carinaai.uk/themes/theme-bridge.css || true)
    APP_HEALTH=$(curl -sS -o /dev/null -w "%{http_code}" https://app.carinaai.uk/api/health || true)
    [[ "${THEME_HTTP}" == "200" && "${APP_HEALTH}" == "200" ]] && break
    sleep 3
  done
  log "Public theme CSS: https://app.carinaai.uk/themes/theme-bridge.css -> HTTP ${THEME_HTTP}"
  log "App health: https://app.carinaai.uk/api/health -> HTTP ${APP_HEALTH}"

  log "Verifying carinaai.uk marketing site mount..."
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${CORE_DIR} && CARINA_MARKETING_AUTO_RELOAD=1 bash docker/scripts/check-carina-marketing.sh"

  MARKETING_HTTP=""
  for _ in 1 2 3 4 5; do
    MARKETING_HTTP=$(curl -sS -o /dev/null -w "%{http_code}" https://carinaai.uk/ || true)
    [[ "${MARKETING_HTTP}" == "200" ]] && break
    sleep 2
  done
  log "Marketing homepage: https://carinaai.uk/ -> HTTP ${MARKETING_HTTP}"
  if [[ "${MARKETING_HTTP}" != "200" ]]; then
    log "Attempting marketing nginx self-heal..."
    ssh "${VPS_USER}@${VPS_HOST}" "cd ${CORE_DIR} && bash docker/scripts/reload-marketing-nginx.sh"
    MARKETING_HTTP=$(curl -sS -o /dev/null -w "%{http_code}" https://carinaai.uk/ || true)
  fi
  [[ "${MARKETING_HTTP}" == "200" ]] || \
    die "https://carinaai.uk/ is not healthy after cloud deploy (HTTP ${MARKETING_HTTP}). Owner hard rule: never leave marketing broken. Repair: ssh ${VPS_USER}@${VPS_HOST} 'cd ${CORE_DIR} && bash docker/scripts/reload-marketing-nginx.sh'"

  if [[ "${THEME_HTTP}" == "200" && "${APP_HEALTH}" == "200" ]]; then
    log "Deploy complete. Carina Cloud is live at https://app.carinaai.uk (docker carina-cloud); carinaai.uk OK"
  else
    die "Docker carina-cloud is not healthy (theme HTTP ${THEME_HTTP}, health HTTP ${APP_HEALTH}). Check: ssh ${VPS_USER}@${VPS_HOST} 'docker compose -f ${CORE_DIR}/docker-compose.prod.yml logs --tail=50 carina-cloud'"
  fi
}

deploy
