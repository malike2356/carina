#!/usr/bin/env bash
# deploy-marketing.sh - Deploy static marketing sites to Contabo VPS
# Run from the carina repo root: bash scripts/deploy-marketing.sh [carina|scout|all]

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check SSH key."
}

deploy_site() {
  local label="$1"
  local local_dir="$2"
  local remote_dir="$3"

  [[ -d "$local_dir" ]] || die "Missing local directory: $local_dir"

  log "Deploying ${label}..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${remote_dir}"
  rsync -rlptvz --delete --no-owner --no-group --omit-dir-times \
    --exclude='.git' \
    --exclude='prompts_ignore' \
    --exclude='node_modules' \
    "${local_dir}/" "${VPS_USER}@${VPS_HOST}:${remote_dir}/"
  log "${label} deployed to ${remote_dir}"

  if [[ -f "${local_dir}/nginx.clean-urls.conf" ]]; then
    log "Nginx clean-URL snippet: ${local_dir}/nginx.clean-urls.conf"
    log "Merge into aaPanel site config if /trust or other extensionless paths 404."
  fi
}

main() {
  local target="${1:-all}"
  check_ssh

  case "$target" in
    carina)
      deploy_site "carinaai.uk" "${REPO_ROOT}/carinaai.uk" "/www/wwwroot/carinaai.uk"
      ;;
    scout)
      deploy_site "labyrinthscout.com" "${REPO_ROOT}/labyrinthscout.com" "/www/wwwroot/labyrinthscout.com"
      ;;
    all)
      deploy_site "carinaai.uk" "${REPO_ROOT}/carinaai.uk" "/www/wwwroot/carinaai.uk"
      deploy_site "labyrinthscout.com" "${REPO_ROOT}/labyrinthscout.com" "/www/wwwroot/labyrinthscout.com"
      ;;
    *)
      die "Usage: bash scripts/deploy-marketing.sh [carina|scout|all]"
      ;;
  esac

  log "Done."
}

main "$@"
