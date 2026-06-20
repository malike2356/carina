#!/usr/bin/env bash
# deploy-scout.sh - Deploy Scout engine and console.labyrinthscout.com to VPS
# Run from the carina repo root: bash scripts/deploy-scout.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
REMOTE="/home/malike/apps/console.labyrinthscout.com"
ENGINE_REMOTE="/home/malike/apps/scout-engine"
ENGINE_PORT="4455"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
LOCAL="${REPO_ROOT}/internal/servers/console.labyrinthscout.com"
ENGINE_LOCAL="${REPO_ROOT}/internal/servers/scout-engine"
SUP_NAME="labyrinth-scout"
ENGINE_SUP_NAME="scout-engine"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check SSH key."
}

main() {
  log "Scout engine and console deploy starting..."
  check_ssh

  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${REMOTE} ${ENGINE_REMOTE}"

  log "Syncing engine code..."
  rsync -az --delete \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='*.deb' \
    "${ENGINE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${ENGINE_REMOTE}/"

  log "Syncing console code..."
  rsync -az --delete \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='docs/.vitepress' \
    "${LOCAL}/" "${VPS_USER}@${VPS_HOST}:${REMOTE}/"

  log "Building on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail

    if [[ ! -f "${ENGINE_REMOTE}/.env" && -f "${REMOTE}/.env" ]]; then
      cp "${REMOTE}/.env" "${ENGINE_REMOTE}/.env"
      if ! grep -q '^SCOUT_PORT=' "${ENGINE_REMOTE}/.env"; then
        echo 'SCOUT_PORT=${ENGINE_PORT}' >> "${ENGINE_REMOTE}/.env"
      else
        sed -i 's|^SCOUT_PORT=.*|SCOUT_PORT=${ENGINE_PORT}|' "${ENGINE_REMOTE}/.env"
      fi
    elif [[ -f "${ENGINE_REMOTE}/.env" ]]; then
      if ! grep -q '^SCOUT_PORT=' "${ENGINE_REMOTE}/.env"; then
        echo 'SCOUT_PORT=${ENGINE_PORT}' >> "${ENGINE_REMOTE}/.env"
      else
        sed -i 's|^SCOUT_PORT=.*|SCOUT_PORT=${ENGINE_PORT}|' "${ENGINE_REMOTE}/.env"
      fi
    fi

    cd "${ENGINE_REMOTE}"
    echo "  Installing engine dependencies..."
    npm install --include=dev 2>&1 | tail -3

    echo "  Building engine..."
    npm run build 2>&1 | tail -5

    cd "${REMOTE}"
    if ! grep -q '^SCOUT_ENGINE_URL=' .env 2>/dev/null; then
      echo 'SCOUT_ENGINE_URL=http://127.0.0.1:${ENGINE_PORT}' >> .env
    else
      sed -i 's|^SCOUT_ENGINE_URL=.*|SCOUT_ENGINE_URL=http://127.0.0.1:${ENGINE_PORT}|' .env
    fi
    if ! grep -q '^SCOUT_ENGINE_API_KEY=' .env 2>/dev/null; then
      SCOUT_KEY=\$(grep '^SCOUT_API_KEY=' .env | tail -1 | cut -d= -f2- || true)
      echo "SCOUT_ENGINE_API_KEY=\${SCOUT_KEY}" >> .env
    fi

    echo "  Installing console dependencies..."
    npm install --include=dev 2>&1 | tail -3

    echo "  Building console TypeScript..."
    npm run build 2>&1 | tail -5

    echo "  Build complete."
REMOTE

  log "Starting engine and restarting console..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    pkill -f "${ENGINE_REMOTE}/dist/server.js" 2>/dev/null || true
    cd "${ENGINE_REMOTE}"
    nohup env NODE_ENV=production SCOUT_PORT=${ENGINE_PORT} /usr/bin/node "${ENGINE_REMOTE}/dist/server.js" \
      >> scout-engine.out.log 2>> scout-engine.err.log &

    pkill -f "${REMOTE}/dist/server.js" 2>/dev/null || true
    sleep 2
    pgrep -af "${ENGINE_REMOTE}/dist/server.js|${REMOTE}/dist/server.js" || true
REMOTE

  log "Scout engine and console deployed."
}

main "$@"
