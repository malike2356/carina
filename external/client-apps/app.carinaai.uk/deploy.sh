#!/bin/bash
# deploy.sh - Deploy Carina Cloud (app.carinaai.uk) to Contabo VPS
# Run from app.carinaai.uk/: bash deploy.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
DEPLOY_DIR="/home/malike/apps/app.carinaai.uk"
SERVICE="carina-cloud"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

build_local() {
  log "Building Next.js app..."
  pnpm build || die "Build failed. Run 'pnpm install' first if needed."
}

deploy() {
  check_ssh
  build_local

  log "Preparing remote directories..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_DIR}/src/db/migrations ${DEPLOY_DIR}/scripts"

  log "Syncing standalone build to VPS..."
  rsync -az --delete --exclude='start.sh' \
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
    scripts/migrate.mjs "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/scripts/migrate.mjs"

  log "Applying database schema patch..."
  ssh "${VPS_USER}@${VPS_HOST}" "set -a && source ${DEPLOY_DIR}/.env && set +a && psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f ${DEPLOY_DIR}/scripts/vps-schema-patch.sql"

  log "Ensuring start.sh is present on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "test -x ${DEPLOY_DIR}/start.sh || (cat > ${DEPLOY_DIR}/start.sh << 'SEOF'
#!/bin/bash
set -a
source ${DEPLOY_DIR}/.env
set +a
exec /usr/bin/node ${DEPLOY_DIR}/server.js
SEOF
chmod +x ${DEPLOY_DIR}/start.sh)"

  log "Restarting ${SERVICE}..."
  ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl restart ${SERVICE}"

  sleep 3

  STATUS=$(ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl status ${SERVICE}")
  log "Status: ${STATUS}"

  if echo "${STATUS}" | grep -q "RUNNING"; then
    log "Deploy complete. Carina Cloud is live at https://app.carinaai.uk"
  else
    die "Service did not start cleanly. Check: ssh ${VPS_USER}@${VPS_HOST} 'tail -30 /var/log/supervisor/${SERVICE}.err.log'"
  fi
}

deploy
