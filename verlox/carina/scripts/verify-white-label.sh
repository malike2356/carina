#!/usr/bin/env bash
set -euo pipefail

# White-label verification: branding, tenant scope, ops docker isolation, copy guard.
# Usage:
#   ./scripts/verify-white-label.sh
# Optional:
#   SKIP_DOCKER_SMOKE=1 ./scripts/verify-white-label.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE="${ROOT}/backends/servers/core.carinaai.uk"
APP="${ROOT}/frontends/client-apps/app.carinaai.uk"
OPS="${ROOT}/backends/admin/ops.carinaai.uk"

log() { echo "[verify-white-label] $*"; }
fail() { log "FAIL: $*"; exit 1; }

[[ -d "$CORE" ]] || fail "core tree missing at $CORE"
[[ -d "$APP" ]] || fail "app tree missing at $APP"
[[ -d "$OPS" ]] || fail "ops tree missing at $OPS"

log "Running white-label copy guard..."
node "$CORE/scripts/white-label-copy-guard.mjs"

log "Running core white-label tests..."
(
  cd "$CORE"
  pnpm exec vitest run \
    src/product/white-label-smoke.test.ts \
    src/product/brand-compat.test.ts \
    packages/web/src/workspace-chrome.test.ts
)

log "Running app white-label tests..."
(
  cd "$APP"
  pnpm exec vitest run \
    src/lib/white-label-smoke.test.ts \
    src/lib/brand-compat.test.ts \
    src/components/shell/brand-shell.test.ts \
    src/lib/billing-presentment.test.ts \
    src/lib/custom-domains.test.ts \
    src/lib/workspace-onboarding.test.ts
)

log "Running ops docker scope tests..."
(
  cd "$OPS"
  pnpm exec vitest run lib/server-services.test.ts
)

if [[ "${SKIP_DOCKER_SMOKE:-}" != "1" ]]; then
  log "Running docker scope shell smoke..."
  bash "$CORE/scripts/smoke-docker-scope.sh"
else
  log "Skipping docker scope shell smoke (SKIP_DOCKER_SMOKE=1)"
fi

log "All white-label verification checks passed."
