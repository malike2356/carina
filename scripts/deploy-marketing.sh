#!/usr/bin/env bash
# deploy-marketing.sh - Deploy static marketing sites to Contabo VPS
# Run from the carina repo root: bash scripts/deploy-marketing.sh [carina|scout|hireaiva|all]
#
# carinaai.uk production uses Docker nginx + core.carinaai.uk/public_website/.
# This script recreates nginx after the docker rsync (reload-marketing-nginx.sh).
# See core.carinaai.uk/docker/DEPLOY.md if https://carinaai.uk/ returns 403.

set -euo pipefail

SSH_TARGET="${DEPLOY_SSH_TARGET:-aman}"
SSH_KEY="${DEPLOY_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$REPO_ROOT")"
MARKETING_ROOT="${WORKSPACE_ROOT}/shared/marketing-sites"
CARINA_MARKETING_LOCAL="${CARINA_MARKETING_DIR:-${MARKETING_ROOT}/carinaai.uk}"
SCOUT_MARKETING_LOCAL="${SCOUT_MARKETING_DIR:-${MARKETING_ROOT}/labyrinthscout.com}"
HIREAIVA_MARKETING_LOCAL="${HIREAIVA_MARKETING_DIR:-${REPO_ROOT}/03-frontends/marketing/hireaiva}"
APPS_ROOT="${DEPLOY_APPS_ROOT:-/home/malike/apps/core.carinaai.uk}"

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
  local docs_src="${REPO_ROOT}/03-frontends/marketing/docs.carinaai.uk"
  if [[ ! -d "${docs_src}" ]]; then
    log "Skipping Carina docs build (missing ${docs_src})"
    return 0
  fi
  log "Building Carina docs for carinaai.uk/docs (Docusaurus)..."
  (
    cd "${docs_src}"
    CARINA_DOCS_MARKETING=1 pnpm build
    rm -rf "${CARINA_MARKETING_LOCAL}/docs"
    cp -a build "${CARINA_MARKETING_LOCAL}/docs"
    mirror_docs_clean_urls "${CARINA_MARKETING_LOCAL}/docs"
  )
}

build_scout_docs() {
  local console_src="${REPO_ROOT}/02-backends/console.labyrinthscout.com"
  if [[ ! -d "${console_src}" ]]; then
    log "Skipping Scout docs build (missing ${console_src})"
    return 0
  fi
  log "Building Scout docs (base /docs/)..."
  (
    cd "${console_src}"
    VP_BASE=/docs/ pnpm docs:build
    rm -rf "${SCOUT_MARKETING_LOCAL}/docs"
    cp -a docs/.vitepress/dist "${SCOUT_MARKETING_LOCAL}/docs"
    mirror_docs_clean_urls "${SCOUT_MARKETING_LOCAL}/docs"
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

  if [[ "${label}" == "carinaai.uk-docker" ]]; then
    # Preserve install helper removed by --delete when absent from marketing tree
    if [[ -f "${REPO_ROOT}/02-backends/core.carinaai.uk/install.sh" ]]; then
      ssh -o IdentitiesOnly=yes -i "${SSH_KEY}" "${SSH_TARGET}" "mkdir -p '${remote_dir}/install'"
      rsync -az -e "ssh -o IdentitiesOnly=yes -i ${SSH_KEY}" \
        "${REPO_ROOT}/02-backends/core.carinaai.uk/install.sh" \
        "${SSH_TARGET}:${remote_dir}/install/install.sh"
    fi
  fi

  if [[ -f "${local_dir}/nginx.clean-urls.conf" ]]; then
    log "Nginx clean-URL snippet: ${local_dir}/nginx.clean-urls.conf"
    log "Merge into aaPanel site config if /trust or other extensionless paths 404."
  fi
}

reload_carina_marketing_nginx() {
  log "Recreating Docker nginx (refresh public_website bind mount; avoids carinaai.uk 403)..."
  ssh -o IdentitiesOnly=yes -i "${SSH_KEY}" "${SSH_TARGET}" \
    "cd '${APPS_ROOT}' && bash docker/scripts/reload-marketing-nginx.sh"
}

main() {
  local target="${1:-all}"
  check_ssh

  case "$target" in
    carina)
      # Skip docs rebuild for CTA/page deploys unless CARINA_MARKETING_BUILD_DOCS=1
      if [[ "${CARINA_MARKETING_BUILD_DOCS:-0}" == "1" ]]; then
        build_carina_docs
      else
        log "Skipping docs rebuild (set CARINA_MARKETING_BUILD_DOCS=1 to include)"
      fi
      deploy_site "carinaai.uk-docker" "${CARINA_MARKETING_LOCAL}" "${APPS_ROOT}/public_website"
      reload_carina_marketing_nginx
      ;;
    scout)
      build_scout_docs
      deploy_site "labyrinthscout.com" "${SCOUT_MARKETING_LOCAL}" "/www/wwwroot/labyrinthscout.com"
      ;;
    hireaiva)
      deploy_site "hireaiva.co.uk" "${HIREAIVA_MARKETING_LOCAL}" "/www/wwwroot/hireaiva.co.uk"
      ;;
    all)
      if [[ "${CARINA_MARKETING_BUILD_DOCS:-0}" == "1" ]]; then
        build_carina_docs
      fi
      build_scout_docs
      deploy_site "carinaai.uk-docker" "${CARINA_MARKETING_LOCAL}" "${APPS_ROOT}/public_website"
      reload_carina_marketing_nginx
      deploy_site "labyrinthscout.com" "${SCOUT_MARKETING_LOCAL}" "/www/wwwroot/labyrinthscout.com"
      deploy_site "hireaiva.co.uk" "${HIREAIVA_MARKETING_LOCAL}" "/www/wwwroot/hireaiva.co.uk"
      ;;
    *)
      die "Usage: bash scripts/deploy-marketing.sh [carina|scout|hireaiva|all]"
      ;;
  esac

  log "Done."
}

main "$@"
