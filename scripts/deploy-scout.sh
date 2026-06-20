#!/usr/bin/env bash
# deploy-scout.sh - Deploy console.labyrinthscout.com Scout server to VPS
# Run from the carina repo root: bash scripts/deploy-scout.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
REMOTE="/home/malike/apps/console.labyrinthscout.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
LOCAL="${REPO_ROOT}/internal/servers/console.labyrinthscout.com"
SUP_NAME="labyrinth-scout"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check SSH key."
}

main() {
  log "Scout server deploy starting..."
  check_ssh

  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${REMOTE}"

  log "Syncing code..."
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
    cd "${REMOTE}"

    echo "  Installing dependencies..."
    npm install --include=dev 2>&1 | tail -3

    echo "  Building TypeScript..."
    npm run build 2>&1 | tail -5

    echo "  Build complete."
REMOTE

  log "Restarting supervisor service..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    sudo supervisorctl reread 2>/dev/null || true
    sudo supervisorctl update 2>/dev/null || true
    sudo supervisorctl restart "${SUP_NAME}" 2>/dev/null || \
      sudo supervisorctl start "${SUP_NAME}" 2>/dev/null || \
      echo "WARN: could not (re)start ${SUP_NAME} via supervisorctl"
    sleep 2
    sudo supervisorctl status "${SUP_NAME}" 2>/dev/null || true
REMOTE

  log "Scout server deployed."
}

main "$@"
