#!/bin/bash
# deploy.sh - Deploy Carina to Contabo VPS (80.190.81.208)
# Run from core.carinaai.uk/: bash deploy.sh
# Hub-only restart: bash deploy.sh --hub-only

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
DEPLOY_DIR="/home/malike/apps/core.carinaai.uk"
SERVICE="carina-core"
HUB_SERVICE="carina-hub"

HUB_ONLY=false
if [[ "${1:-}" == "--hub-only" ]]; then
  HUB_ONLY=true
fi

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# One-time Skills Hub Postgres database (run manually on VPS; not executed on deploy):
#   psql postgresql://carina:secret@localhost:5433/postgres -tc "SELECT 1 FROM pg_database WHERE datname='carina_skills_hub'" | grep -q 1 || \
#     psql postgresql://carina:secret@localhost:5433/postgres -c 'CREATE DATABASE carina_skills_hub;'

check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

build_local() {
  log "Building TypeScript..."
  rm -rf dist
  pnpm build || die "Build failed. Run 'pnpm install' first if needed."
}

sync_dist() {
  log "Syncing dist/ to VPS..."
  rsync -az --delete \
    dist/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/dist/"
}

sync_static_assets() {
  log "Syncing static assets to VPS..."
  rsync -az \
    templates/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/templates/"
  rsync -az \
    brain/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/brain/"
  rsync -az \
    brain/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/dist/brain/"
  rsync -az \
    src/product/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/src/product/"
  rsync -az \
    dist/src/product/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/src/product/"
}

sync_pack_packages() {
  log "Syncing skill pack packages to VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_DIR}/dist/packages/packs"
  rsync -az --delete \
    packages/packs/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/dist/packages/packs/"
  ssh "${VPS_USER}@${VPS_HOST}" "for pack in ${DEPLOY_DIR}/dist/packages/packs/*; do [ -d \"\$pack\" ] || continue; mkdir -p \"\$pack/node_modules/@verlox\"; ln -sfn ../../../../../.. \"\$pack/node_modules/@verlox/carina-core\"; done"
  ssh "${VPS_USER}@${VPS_HOST}" "
    mkdir -p ${DEPLOY_DIR}/node_modules/@verlox
    ln -sfn ${DEPLOY_DIR} ${DEPLOY_DIR}/node_modules/@verlox/carina-core
    ln -sfn ${DEPLOY_DIR}/packages/transport ${DEPLOY_DIR}/node_modules/@verlox/carina-transport
    ln -sfn ${DEPLOY_DIR}/packages/scout-client ${DEPLOY_DIR}/node_modules/@verlox/carina-scout
    ln -sfn ${DEPLOY_DIR}/dist/packages/packs/borehole-africa ${DEPLOY_DIR}/node_modules/@verlox/pack-borehole-africa
    ln -sfn ${DEPLOY_DIR}/dist/packages/packs/healthcare ${DEPLOY_DIR}/node_modules/@verlox/pack-health
    ln -sfn ${DEPLOY_DIR}/dist/packages/packs/property-uk ${DEPLOY_DIR}/node_modules/@verlox/pack-property
  "
}

sync_web_package() {
  log "Syncing @verlox/carina-web to VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_DIR}/packages/web"
  rsync -az \
    packages/web/package.json "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/packages/web/"
  rsync -az --delete \
    packages/web/dist/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/packages/web/dist/"
  ssh "${VPS_USER}@${VPS_HOST}" "ln -sfn ${DEPLOY_DIR}/packages/web ${DEPLOY_DIR}/node_modules/@verlox/carina-web"
}

sync_hub_public() {
  log "Syncing hub public assets to VPS..."
  rsync -az \
    src/skills/hub/public/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/dist/src/skills/hub/public/"
}

sync_cloud_dist() {
  log "Building Carina Cloud SPA..."
  pnpm --filter carina-cloud build
  log "Syncing cloud dist to VPS..."
  rsync -az --delete \
    apps/cloud/dist/ "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/cloud-dist/"
}

install_vps_deps() {
  log "Installing/updating npm packages on VPS if needed..."
  ssh "${VPS_USER}@${VPS_HOST}" "
    cd ${DEPLOY_DIR}
    node -e \"
      const fs = require('fs');
      const files = ['package.json'];
      for (const dir of ['packages/web', 'packages/transport', 'packages/scout-client']) {
        const file = dir + '/package.json';
        if (fs.existsSync(file)) files.push(file);
      }
      for (const file of files) {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
          const deps = pkg[section] || {};
          Object.keys(deps).forEach(k => { if ((deps[k] || '').startsWith('workspace:')) delete deps[k]; });
          if (Object.keys(deps).length === 0) delete pkg[section];
        }
        fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
      }
    \"
    npm install --omit=dev --ignore-scripts --legacy-peer-deps
    mkdir -p ${DEPLOY_DIR}/node_modules/@verlox
    ln -sfn ${DEPLOY_DIR} ${DEPLOY_DIR}/node_modules/@verlox/carina-core
    ln -sfn ${DEPLOY_DIR}/packages/transport ${DEPLOY_DIR}/node_modules/@verlox/carina-transport
    ln -sfn ${DEPLOY_DIR}/packages/scout-client ${DEPLOY_DIR}/node_modules/@verlox/carina-scout
    ln -sfn ${DEPLOY_DIR}/packages/web ${DEPLOY_DIR}/node_modules/@verlox/carina-web
    ln -sfn ${DEPLOY_DIR}/dist/packages/packs/borehole-africa ${DEPLOY_DIR}/node_modules/@verlox/pack-borehole-africa
    ln -sfn ${DEPLOY_DIR}/dist/packages/packs/healthcare ${DEPLOY_DIR}/node_modules/@verlox/pack-health
    ln -sfn ${DEPLOY_DIR}/dist/packages/packs/property-uk ${DEPLOY_DIR}/node_modules/@verlox/pack-property
  "
}

sync_start_script() {
  log "Syncing start.sh to VPS..."
  rsync -az start.sh "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/start.sh"
  ssh "${VPS_USER}@${VPS_HOST}" "chmod +x ${DEPLOY_DIR}/start.sh"
}

check_service() {
  local svc="$1"
  local STATUS
  STATUS=$(ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl status ${svc}")
  log "Status (${svc}): ${STATUS}"
  if echo "${STATUS}" | grep -q "RUNNING"; then
    return 0
  fi
  die "Service ${svc} did not start cleanly. Check: ssh ${VPS_USER}@${VPS_HOST} 'tail -30 /var/log/supervisor/${svc}.err.log'"
}

restart_service() {
  local svc="$1"
  log "Restarting ${svc}..."
  ssh "${VPS_USER}@${VPS_HOST}" "sudo supervisorctl restart ${svc}"
}

deploy_full() {
  check_ssh
  build_local
  sync_dist
  sync_static_assets
  sync_pack_packages
  sync_web_package
  sync_hub_public
  sync_cloud_dist
  sync_start_script
  install_vps_deps

  restart_service "${SERVICE}"
  restart_service "${HUB_SERVICE}"

  sleep 3

  check_service "${SERVICE}"
  check_service "${HUB_SERVICE}"

  log "Deploy complete. Carina core and Skills Hub are live."
}

deploy_hub_only() {
  check_ssh
  build_local
  sync_dist
  sync_pack_packages
  sync_web_package
  sync_hub_public

  restart_service "${HUB_SERVICE}"

  sleep 3

  check_service "${HUB_SERVICE}"

  log "Hub-only deploy complete. Skills Hub restarted."
}

if [[ "${HUB_ONLY}" == true ]]; then
  deploy_hub_only
else
  deploy_full
fi
