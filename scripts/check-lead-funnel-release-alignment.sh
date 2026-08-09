#!/usr/bin/env bash
# Fail when carina-web / carina-cloud revisions do not include required lead-funnel commits.
# Different image tags are allowed when both revisions contain the required commits.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARINA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
GIT_ROOT="$(git -C "${CARINA_ROOT}" rev-parse --show-toplevel)"
MATRIX="${CARINA_ROOT}/02-backends/core.carinaai.uk/docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json"
MODE="${1:-local}"

die() { echo "ERROR: lead-funnel release alignment: $*" >&2; exit 1; }
log() { echo "[lead-funnel-align] $*"; }

[[ -f "${MATRIX}" ]] || die "missing capability matrix at ${MATRIX}"

mapfile -t REQUIRED_CORE < <(MATRIX="${MATRIX}" python3 - <<'PY'
import json, os
doc = json.load(open(os.environ["MATRIX"]))
for sha in doc["deployedAtAudit"]["requiredCoreCommits"]:
    print(sha)
PY
)

mapfile -t REQUIRED_CLOUD < <(MATRIX="${MATRIX}" python3 - <<'PY'
import json, os
doc = json.load(open(os.environ["MATRIX"]))
for sha in doc["deployedAtAudit"]["requiredCloudCommits"]:
    print(sha)
PY
)

require_ancestor() {
  local required="$1"
  local tip="$2"
  local label="$3"
  git -C "${GIT_ROOT}" cat-file -e "${required}^{commit}" 2>/dev/null \
    || die "${label}: required commit ${required} is not in this git object store"
  git -C "${GIT_ROOT}" cat-file -e "${tip}^{commit}" 2>/dev/null \
    || die "${label}: tip revision ${tip} is not in this git object store"
  git -C "${GIT_ROOT}" merge-base --is-ancestor "${required}" "${tip}" \
    || die "${label}: tip ${tip} does not contain required commit ${required}"
}

resolve_local_tip() {
  git -C "${GIT_ROOT}" rev-parse HEAD
}

resolve_production_tip() {
  local service="$1"
  local tip=""
  tip="$(ssh -o BatchMode=yes -o ConnectTimeout=8 malike@80.190.81.208 \
    "docker inspect corecarinaaiuk-${service}-1 --format '{{.Config.Image}}' 2>/dev/null" \
    | sed -E 's/.*:([0-9a-f]{40})-.*/\1/; t; s/.*:([0-9a-f]{7,40}).*/\1/')"
  [[ "${tip}" =~ ^[0-9a-f]{7,40}$ ]] || die "could not resolve production tip for ${service}"
  # Expand short prefix to full SHA when possible.
  if [[ "${#tip}" -lt 40 ]]; then
    tip="$(git -C "${GIT_ROOT}" rev-parse "${tip}")"
  fi
  printf '%s\n' "${tip}"
}

check_tip() {
  local label="$1"
  local tip="$2"
  shift 2
  local required
  for required in "$@"; do
    require_ancestor "${required}" "${tip}" "${label}"
  done
  log "PASS ${label} tip=${tip}"
}

case "${MODE}" in
  local)
    TIP="$(resolve_local_tip)"
    check_tip "local-core" "${TIP}" "${REQUIRED_CORE[@]}"
    check_tip "local-cloud" "${TIP}" "${REQUIRED_CLOUD[@]}"
    ;;
  production|prod)
    WEB_TIP="$(resolve_production_tip carina-web)"
    CLOUD_TIP="$(resolve_production_tip carina-cloud)"
    check_tip "production-carina-web" "${WEB_TIP}" "${REQUIRED_CORE[@]}"
    check_tip "production-carina-cloud" "${CLOUD_TIP}" "${REQUIRED_CLOUD[@]}"
    if [[ "${WEB_TIP}" != "${CLOUD_TIP}" ]]; then
      log "NOTE: web and cloud tags differ (${WEB_TIP:0:12} vs ${CLOUD_TIP:0:12}); allowed because both contain required lead-funnel commits"
    fi
    ;;
  *)
    die "usage: $0 [local|production]"
    ;;
esac

log "OK lead-funnel release alignment (${MODE})"
