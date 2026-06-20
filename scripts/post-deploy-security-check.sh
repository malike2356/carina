#!/usr/bin/env bash
# post-deploy-security-check.sh - Run doctor/readiness after security-related deploys
# Usage: bash scripts/post-deploy-security-check.sh [local|vps]

set -euo pipefail

TARGET="${1:-vps}"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
SCOUT_REMOTE="/home/malike/apps/console.labyrinthscout.com"
CORE_REMOTE="/home/malike/apps/core.carinaai.uk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

log() { echo "[post-deploy-security] $*"; }
fail() { echo "[post-deploy-security] FAIL $*" >&2; FAILED=1; }

FAILED=0

run_local() {
  log "Scout doctor..."
  (cd "${REPO_ROOT}/internal/servers/console.labyrinthscout.com" && npm run doctor) || fail "Scout doctor"

  log "Carina doctor..."
  (cd "${REPO_ROOT}/internal/servers/core.carinaai.uk" && npx tsx bin/carina.ts doctor) || fail "Carina doctor"

  log "Carina security audit..."
  (cd "${REPO_ROOT}/internal/servers/core.carinaai.uk" && npx tsx bin/carina.ts security audit) || fail "Carina security audit"

  curl -fsS -m 8 http://127.0.0.1:4444/api/readiness >/dev/null || fail "Scout readiness endpoint"
}

run_vps() {
  log "Scout doctor on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${SCOUT_REMOTE} && npm run doctor" || fail "Scout doctor"

  log "Carina security audit on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "cd ${CORE_REMOTE} && npx tsx bin/carina.ts security audit" || fail "Carina security audit"

  log "Scout readiness on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" "curl -fsS -m 8 http://127.0.0.1:4444/api/readiness" || fail "Scout readiness endpoint"
}

case "$TARGET" in
  local) run_local ;;
  vps)   run_vps ;;
  *)     echo "Usage: bash scripts/post-deploy-security-check.sh [local|vps]" >&2; exit 1 ;;
esac

if [[ "$FAILED" -ne 0 ]]; then
  log "One or more checks failed."
  exit 1
fi

log "All post-deploy security checks passed."
