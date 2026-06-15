#!/bin/bash
# deploy.sh - Deploy Carina to Contabo VPS (80.190.81.208)
# Run from core.carinaai.uk/: bash deploy.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
DEPLOY_DIR="/home/malike/apps/core.carinaai.uk"
SERVICE="carina-core"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

build_local() {
  log "Building TypeScript..."
  pnpm build || die "Build failed. Run 'pnpm install' first if needed."
}

deploy() {
  check_ssh

  build_local

  log "Syncing dist/ to VPS..."
  rsync -az --delete \
    dist/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/dist/"

  log "Syncing static assets to VPS..."
  rsync -az \
    templates/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/templates/"
  rsync -az \
    brain/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/brain/"

  log "Installing/updating npm packages on VPS if needed..."
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${DEPLOY_DIR} && npm install --omit=dev --ignore-scripts 2>&1 | tail -5"

  log "Restarting ${SERVICE}..."
  ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl restart ${SERVICE}"

  sleep 3

  STATUS=$(ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl status ${SERVICE}")
  log "Status: ${STATUS}"

  if echo "${STATUS}" | grep -q "RUNNING"; then
    log "Deploy complete. Carina is live."
  else
    die "Service did not start cleanly. Check: ssh ${VPS_USER}@${VPS_HOST} 'tail -30 /var/log/supervisor/${SERVICE}.err.log'"
  fi
}

deploy
