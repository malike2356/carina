#!/usr/bin/env bash
# Refuse deployments that cannot be reproduced from a committed revision.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARINA_ROOT="$(dirname "${SCRIPT_DIR}")"
WORKSPACE_ROOT="$(dirname "${CARINA_ROOT}")"

# Refuse nested platform duplicates before any deploy revision checks.
bash "${WORKSPACE_ROOT}/scripts/guard-forbidden-carina-nests.sh"

GIT_ROOT="$(git -C "${CARINA_ROOT}" rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: Carina must be deployed from a Git worktree." >&2
  exit 1
}
CARINA_REL="$(realpath --relative-to="${GIT_ROOT}" "${CARINA_ROOT}")"
REVISION="$(git -C "${GIT_ROOT}" rev-parse HEAD)"
PRODUCT_PATHS=(
  "${CARINA_REL}/02-backends"
  "${CARINA_REL}/03-frontends"
  "${CARINA_REL}/scripts"
  "${CARINA_REL}/AGENTS.md"
  "${CARINA_REL}/README.md"
  "${CARINA_REL}/.gitignore"
)
STATUS="$(git -C "${GIT_ROOT}" status --porcelain --untracked-files=all -- "${PRODUCT_PATHS[@]}")"

required_files=(
  "${CARINA_ROOT}/02-backends/core.carinaai.uk/docker-compose.prod.yml"
  "${CARINA_ROOT}/02-backends/core.carinaai.uk/docker/scripts/deploy-lib.sh"
  "${CARINA_ROOT}/02-backends/core.carinaai.uk/docker/scripts/deploy-atomic.sh"
)

for required in "${required_files[@]}"; do
  if [[ ! -s "${required}" ]]; then
    echo "ERROR: Required deployment file is missing or empty: ${required}" >&2
    exit 1
  fi
done

bash "${SCRIPT_DIR}/verify-release.sh" source >&2

if [[ -n "${STATUS}" ]]; then
  if [[ "${CARINA_ALLOW_DIRTY_DEPLOY:-0}" != "1" ]]; then
    echo "ERROR: Refusing to deploy an uncommitted Carina working tree." >&2
    echo "Commit the changes first, or set CARINA_ALLOW_DIRTY_DEPLOY=1 for an audited emergency deploy." >&2
    printf '%s\n' "${STATUS}" >&2
    exit 1
  fi
  if [[ -z "${CARINA_DIRTY_DEPLOY_REASON:-}" ]]; then
    echo "ERROR: CARINA_ALLOW_DIRTY_DEPLOY requires CARINA_DIRTY_DEPLOY_REASON." >&2
    echo "ERROR: Dirty releases must have an explicit audit reason." >&2
    exit 1
  fi

  release_dir="${CARINA_RELEASE_DIR:-${CARINA_ROOT}/.deploy}"
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "${release_dir}"
  patch_path="${release_dir}/emergency-${REVISION}-${timestamp}.patch"
  {
    git -C "${GIT_ROOT}" diff --binary -- "${PRODUCT_PATHS[@]}"
    git -C "${GIT_ROOT}" ls-files --others --exclude-standard -- "${PRODUCT_PATHS[@]}" \
      | sed 's/^/# UNTRACKED /'
  } > "${patch_path}"
  echo "WARNING: Emergency dirty deploy recorded at ${patch_path}" >&2
  printf 'REASON: %s\n' "${CARINA_DIRTY_DEPLOY_REASON}" >> "${patch_path}"
fi

printf '%s\n' "${REVISION}"
