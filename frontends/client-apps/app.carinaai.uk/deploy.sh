#!/bin/bash
# deploy.sh - Deploy Carina Cloud (app.carinaai.uk) to Contabo VPS
# Run from app.carinaai.uk/: bash deploy.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
DEPLOY_DIR="/home/malike/apps/app.carinaai.uk"
CORE_DIR="/home/malike/apps/core.carinaai.uk"
SERVICE="carina-cloud"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

build_local() {
  log "Syncing multi-theme CSS..."
  pnpm theme:sync || die "theme:sync failed."
  log "Building Next.js app..."
  pnpm build || die "Build failed. Run 'pnpm install' first if needed."
}

deploy() {
  check_ssh
  build_local

  log "Preparing remote directories..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_DIR}/src/db/migrations ${DEPLOY_DIR}/scripts"

  log "Backing up production .env before sync..."
  ssh "${VPS_USER}@${VPS_HOST}" "test -f ${DEPLOY_DIR}/.env && cp ${DEPLOY_DIR}/.env ${DEPLOY_DIR}/.env.bak.\$(date +%Y%m%d%H%M%S) || true"

  log "Syncing standalone build to VPS..."
  # Never sync or delete production .env (Next.js copies local .env into standalone/).
  rsync -az --delete \
    --exclude='.env' \
    --filter='protect .env' \
    --exclude='start.sh' \
    --exclude='src/db/migrations/' \
    --exclude='scripts/' \
    .next/standalone/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/"
  rsync -az \
    .next/static/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/.next/static/"
  rsync -az \
    public/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/public/"
  rsync -az \
    src/db/migrations/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/src/db/migrations/"
  rsync -az \
    scripts/vps-schema-patch.sql "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/scripts/vps-schema-patch.sql"
  rsync -az \
    docker/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/docker/"
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

for f in \
  src/db/migrations/0000_oval_earthquake.sql \
  src/db/migrations/0001_pink_screwball.sql \
  src/db/migrations/0002_lyrical_gunslinger.sql \
  src/db/migrations/0003_add_workspace_appearance.sql \
  src/db/migrations/0004_documents_email.sql \
  src/db/migrations/0005_calendar.sql \
  src/db/migrations/0006_brain_settings.sql \
  src/db/migrations/0007_terminal_enabled_default.sql \
  src/db/migrations/0008_terminal_rbac.sql
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

  log "Rebuilding docker carina-cloud (public HTTPS upstream via docker nginx)..."
  ssh "${VPS_USER}@${VPS_HOST}" bash <<EOF
set -euo pipefail
cd "${CORE_DIR}"
export CARINA_CLOUD_CONTEXT="${DEPLOY_DIR}"
docker compose -f docker-compose.prod.yml build carina-cloud
docker compose -f docker-compose.prod.yml up -d --no-deps carina-cloud
EOF

  log "Restarting ${SERVICE} (supervisor fallback on 127.0.0.1:4100)..."
  ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl stop ${SERVICE} || true; fuser -k 4100/tcp 4102/tcp 2>/dev/null || true; sleep 1; sudo supervisorctl start ${SERVICE}"

  sleep 3

  STATUS=$(ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl status ${SERVICE}")
  log "Status: ${STATUS}"

  THEME_HTTP=$(curl -sS -o /dev/null -w "%{http_code}" https://app.carinaai.uk/themes/theme-bridge.css || true)
  log "Public theme CSS: https://app.carinaai.uk/themes/theme-bridge.css -> HTTP ${THEME_HTTP}"

  if echo "${STATUS}" | grep -q "RUNNING" && [[ "${THEME_HTTP}" == "200" ]]; then
    log "Deploy complete. Carina Cloud is live at https://app.carinaai.uk"
  elif echo "${STATUS}" | grep -q "RUNNING"; then
    die "Service is running but theme static files are not reachable (HTTP ${THEME_HTTP}). Check docker nginx -> carina-cloud."
  else
    die "Service did not start cleanly. Check: ssh ${VPS_USER}@${VPS_HOST} 'tail -30 /var/log/supervisor/${SERVICE}.err.log'"
  fi
}

deploy
