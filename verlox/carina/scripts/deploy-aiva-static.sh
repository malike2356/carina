#!/usr/bin/env bash
# Deploy Aiva hire page static files into Docker marketing bind mount.
#
# From repo root:
#   bash scripts/deploy-aiva-static.sh
#
# Source: 03-frontends/marketing/carinaai.uk/aiva/
# Dest (VPS): APPS_ROOT/core.carinaai.uk/public_website/aiva/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
# shellcheck source=deploy-lib.sh
source "${SCRIPT_DIR}/deploy-lib.sh"

VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
APPS_ROOT="${APPS_ROOT:-/home/malike/apps}"
HIRE_SRC="${REPO_ROOT}/03-frontends/marketing/carinaai.uk/aiva"
REMOTE_WEBSITE="${APPS_ROOT}/core.carinaai.uk/public_website"
REMOTE_TMP="${REMOTE_WEBSITE}/.aiva_deploy_tmp"
REMOTE_AIVA="${REMOTE_WEBSITE}/aiva"

if [[ ! -d "${HIRE_SRC}" ]]; then
  deploy_die "Hire page source missing: ${HIRE_SRC} (create in Action 07)"
fi

ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok >/dev/null || \
  deploy_die "Cannot SSH to ${VPS_USER}@${VPS_HOST}"

deploy_log "Deploying Aiva static page..."
ssh "${VPS_USER}@${VPS_HOST}" "rm -rf '${REMOTE_TMP}' && mkdir -p '${REMOTE_TMP}'"
rsync -az --delete "${HIRE_SRC}/" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}/"

ssh "${VPS_USER}@${VPS_HOST}" bash -s -- "${REMOTE_WEBSITE}" "${REMOTE_TMP}" "${REMOTE_AIVA}" <<'REMOTE'
set -euo pipefail
WEBSITE_ROOT="$1"
TMP="$2"
AIVA_DEST="$3"
if [[ -d "${AIVA_DEST}" ]]; then
  mv "${AIVA_DEST}" "${WEBSITE_ROOT}/.aiva_old_$(date +%s)"
fi
mv "${TMP}" "${AIVA_DEST}"
ls -1dt "${WEBSITE_ROOT}/.aiva_old_"* 2>/dev/null | tail -n +3 | xargs -r rm -rf
REMOTE

deploy_log "Reloading Docker marketing nginx..."
ssh "${VPS_USER}@${VPS_HOST}" "cd '${APPS_ROOT}/core.carinaai.uk' && bash docker/scripts/reload-marketing-nginx.sh"

deploy_log "Aiva static deploy complete."
