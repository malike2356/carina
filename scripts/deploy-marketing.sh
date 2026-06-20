#!/usr/bin/env bash
# deploy-marketing.sh - Deploy static marketing sites to Contabo VPS
# Run from the carina repo root: bash scripts/deploy-marketing.sh [carina|scout|all]

set -euo pipefail

SSH_TARGET="${DEPLOY_SSH_TARGET:-aman}"
SSH_KEY="${DEPLOY_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o IdentitiesOnly=yes -i "${SSH_KEY}" -o ConnectTimeout=8 -o BatchMode=yes "${SSH_TARGET}" echo ok &>/dev/null || \
    die "Cannot SSH to ${SSH_TARGET}. Check SSH key."
}

mirror_docs_clean_urls() {
  local docs_dir="$1"
  log "Mirroring ${docs_dir} pages for extensionless URLs..."

  while IFS= read -r -d '' page; do
    local rel="${page#${docs_dir}/}"
    local base
    base="$(basename "${rel}" .html)"
    local parent
    parent="$(dirname "${rel}")"

    if [[ "${base}" == "index" || "${base}" == "404" ]]; then
      continue
    fi

    local target_dir="${docs_dir}/${parent}/${base}"
    mkdir -p "${target_dir}"
    cp "${page}" "${target_dir}/index.html"
  done < <(find "${docs_dir}" -type f -name '*.html' ! -name '404.html' -print0)
}

build_carina_docs() {
  log "Building Carina docs for carinaai.uk/docs (Docusaurus)..."
  (
    cd "${REPO_ROOT}/marketing/docs/docs.carinaai.uk"
    CARINA_DOCS_MARKETING=1 pnpm build
    rm -rf "${REPO_ROOT}/marketing/sites/carinaai.uk/docs"
    cp -a build "${REPO_ROOT}/marketing/sites/carinaai.uk/docs"
    mirror_docs_clean_urls "${REPO_ROOT}/marketing/sites/carinaai.uk/docs"
  )
}

build_scout_docs() {
  log "Building Scout docs (base /docs/)..."
  (
    cd "${REPO_ROOT}/internal/servers/console.labyrinthscout.com"
    VP_BASE=/docs/ pnpm docs:build
    rm -rf "${REPO_ROOT}/marketing/sites/labyrinthscout.com/docs"
    cp -a docs/.vitepress/dist "${REPO_ROOT}/marketing/sites/labyrinthscout.com/docs"
    mirror_docs_clean_urls "${REPO_ROOT}/marketing/sites/labyrinthscout.com/docs"
  )
}

deploy_site() {
  local label="$1"
  local local_dir="$2"
  local remote_dir="$3"

  [[ -d "$local_dir" ]] || die "Missing local directory: $local_dir"

  log "Deploying ${label}..."
  ssh -o IdentitiesOnly=yes -i "${SSH_KEY}" "${SSH_TARGET}" "mkdir -p ${remote_dir}"
  rsync -rlptvz --delete --no-owner --no-group --omit-dir-times \
    --exclude='.git' \
    --exclude='prompts_ignore' \
    --exclude='node_modules' \
    -e "ssh -o IdentitiesOnly=yes -i ${SSH_KEY}" \
    "${local_dir}/" "${SSH_TARGET}:${remote_dir}/"
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
      build_carina_docs
      deploy_site "carinaai.uk" "${REPO_ROOT}/marketing/sites/carinaai.uk" "/www/wwwroot/carinaai.uk"
      ;;
    scout)
      build_scout_docs
      deploy_site "labyrinthscout.com" "${REPO_ROOT}/marketing/sites/labyrinthscout.com" "/www/wwwroot/labyrinthscout.com"
      ;;
    all)
      build_carina_docs
      build_scout_docs
      deploy_site "carinaai.uk" "${REPO_ROOT}/marketing/sites/carinaai.uk" "/www/wwwroot/carinaai.uk"
      deploy_site "labyrinthscout.com" "${REPO_ROOT}/marketing/sites/labyrinthscout.com" "/www/wwwroot/labyrinthscout.com"
      ;;
    *)
      die "Usage: bash scripts/deploy-marketing.sh [carina|scout|all]"
      ;;
  esac

  log "Done."
}

main "$@"
