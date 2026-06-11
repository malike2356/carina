#!/usr/bin/env bash
# deploy-scout.sh - Deploy console.labyrinthscout.com to Contabo VPS
# Run from the console.labyrinthscout.com directory: bash scripts/deploy-scout.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
REMOTE_DIR="/home/malike/apps/console.labyrinthscout.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DIR="$(dirname "$SCRIPT_DIR")"
SUP_NAME="labyrinth-scout"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check SSH key."
}

main() {
  log "Labyrinth Scout production deploy starting..."
  check_ssh

  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${REMOTE_DIR}"

  log "Syncing code..."
  rsync -az --delete \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='/data/' \
    --exclude='sdk/node/node_modules' \
    --exclude='sdk/python/__pycache__' \
    "$LOCAL_DIR/" "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

  log "Building on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    cd "$REMOTE_DIR"

    echo "  Installing dependencies..."
    npm install --include=dev 2>&1 | tail -3

    echo "  Building TypeScript..."
    npm run build 2>&1 | tail -5

    echo "  Build complete."
REMOTE

  log "Setting up supervisor..."
  local SUP_CONF
  SUP_CONF="[program:${SUP_NAME}]
command=/usr/bin/node ${REMOTE_DIR}/dist/server.js
directory=${REMOTE_DIR}
autostart=true
autorestart=true
user=${VPS_USER}
stdout_logfile=/var/log/supervisor/${SUP_NAME}.out.log
stderr_logfile=/var/log/supervisor/${SUP_NAME}.err.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
stopwaitsecs=30
environment=NODE_ENV=\"production\""

  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    CONF_PATH="/etc/supervisor/conf.d/${SUP_NAME}.conf"
    mkdir -p /var/log/supervisor

    if sudo tee "\$CONF_PATH" > /dev/null << 'SUPERVISORCONF'
${SUP_CONF}
SUPERVISORCONF
    then
      echo "  Supervisor conf written to \$CONF_PATH"
      sudo supervisorctl reread 2>/dev/null || true
      sudo supervisorctl update 2>/dev/null || true
      sudo supervisorctl restart "${SUP_NAME}" 2>/dev/null || \
        sudo supervisorctl start "${SUP_NAME}" 2>/dev/null || \
        echo "WARN: could not start ${SUP_NAME}"
    else
      echo ""
      echo "WARN: Cannot write to /etc/supervisor/conf.d/ - create this file manually:"
      echo "--- /etc/supervisor/conf.d/${SUP_NAME}.conf ---"
      printf '%s\n' "${SUP_CONF}"
      echo "--- end ---"
      echo "Then: sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start ${SUP_NAME}"
    fi
REMOTE

  log "Deploy complete."

  if [[ -x "${LOCAL_DIR}/../scripts/post-deploy-security-check.sh" ]]; then
    log "Running post-deploy security checks..."
    bash "${LOCAL_DIR}/../scripts/post-deploy-security-check.sh" vps || \
      log "WARN: post-deploy security checks failed; see scripts/verify-security-config.sh"
  fi

  echo ""
  echo "=== POST-DEPLOY CHECKLIST ==="
  echo ""
  echo "1. Set production .env on VPS:"
  echo "   scp .env ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/.env"
  echo "   Then update SCOUT_DATABASE_URL to postgresql://... and restart:"
  echo "   ssh ${VPS_USER}@${VPS_HOST} 'sudo supervisorctl restart ${SUP_NAME}'"
  echo ""
  echo "2. Create labyrinth-scout postgres DB (on VPS as postgres user):"
  echo "   The scout uses the same carina_central DB as core.carinaai.uk"
  echo "   Ensure SCOUT_DATABASE_URL in .env points to: postgresql://carina:PWD@127.0.0.1:5432/carina_central"
  echo ""
  echo "3. Nginx vhost (public hub + protected operator dashboard):"
  echo "   bash scripts/apply-nginx-console.sh"
  echo "   See nginx.console.conf: / and /account public; /dashboard uses Basic Auth"
  echo ""
  echo "4. Complete security configuration:"
  echo "   bash ../scripts/verify-security-config.sh vps"
  echo "   SCOUT_ALERT_TO_EMAIL=ops@yourdomain.com bash ../scripts/complete-production-security.sh vps"
  echo "   See instructions/SECURITY_CONFIGURATION_GUIDE.md"
}

main "$@"
