#!/usr/bin/env bash
# Regression proofs for critical Carina capabilities.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"
MODE="${1:-source}"
EXPECTED_REVISION="${2:-${SOURCE_REVISION:-}}"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

require_marker() {
  local id="$1"
  local marker="$2"
  local file="$3"
  grep -Fq "${marker}" "${ROOT_DIR}/${file}" || fail "${id}"
  pass "${id}"
}

verify_source() {
  require_marker operator-improvements-route \
    "operatorRouter.get('/improvements'" \
    "02-backends/admin/ops.carinaai.uk/routes/operator.ts"
  require_marker centered-pricing-layout \
    "max-width:860px;margin:0 auto" \
    "02-backends/admin/ops.carinaai.uk/views/pricing.ejs"
  require_marker live-ai-platform-telemetry \
    "telemetryToUsageSummary" \
    "02-backends/admin/ops.carinaai.uk/lib/ai-platform.ts"
  require_marker deepseek-model-catalog \
    "model: 'deepseek-chat'" \
    "02-backends/admin/ops.carinaai.uk/lib/ai-platform.ts"
  require_marker apk-toggle-core \
    "AIVA_APK_LINK_IN_WELCOME" \
    "02-backends/core.carinaai.uk/src/email/complete-welcome-content.ts"
  require_marker apk-toggle-ops \
    "AIVA_APK_LINK_IN_WELCOME" \
    "02-backends/admin/ops.carinaai.uk/lib/billing-config-store.ts"
  require_marker telegram-webhook-verification \
    "TELEGRAM_WEBHOOK_SECRET" \
    "02-backends/core.carinaai.uk/src/channels/adapters/telegram-adapter.ts"
  require_marker worker-direct-conversations-core \
    "aivaRouter.get('/workers/:id/direct-conversations'" \
    "02-backends/core.carinaai.uk/src/api/workspace-api.ts"
  require_marker worker-direct-conversations-cloud \
    "'direct-conversations'," \
    "03-frontends/client-apps/app.carinaai.uk/src/app/api/aiva/workers/[id]/[...rest]/route.ts"
  require_marker worker-new-chat-ui \
    "aria-label=\"Start new chat\"" \
    "03-frontends/client-apps/app.carinaai.uk/src/components/aiva/AivaWorkerDirectChat.tsx"
  require_marker mobile-task-tool-gate \
    "if (shouldCreateAutoTask(toolsUsed))" \
    "03-frontends/client-apps/carinaMobile/src/hooks/useChatSession.ts"
  require_marker mobile-task-kind \
    "kind: 'auto'" \
    "03-frontends/client-apps/carinaMobile/src/hooks/useChatSession.ts"

  if grep -R -Fq 'content: `[${warning}]' "${ROOT_DIR}/02-backends/core.carinaai.uk/src"; then
    fail cost-warning-not-user-visible
  fi
  pass cost-warning-not-user-visible

  grep -Fq "find src/db/migrations" \
    "${ROOT_DIR}/03-frontends/client-apps/app.carinaai.uk/deploy.sh" \
    || fail migration-discovery
  pass migration-discovery
}

verify_health_revision() {
  local service="$1"
  local url="$2"
  local payload
  payload="$(curl -fsS --max-time 15 "${url}")" || fail "${service}-health"
  HEALTH_PAYLOAD="${payload}" EXPECTED_REVISION="${EXPECTED_REVISION}" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["HEALTH_PAYLOAD"])
expected = os.environ["EXPECTED_REVISION"]
if payload.get("revision") != expected:
    raise SystemExit(
        f"expected revision {expected}, received {payload.get('revision', 'missing')}"
    )
PY
  pass "${service}-revision"
}

verify_route() {
  local id="$1"
  local url="$2"
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${url}")"
  case "${status}" in
    200|302|303) pass "${id}" ;;
    *) fail "${id} (HTTP ${status})" ;;
  esac
}

verify_production() {
  [[ "${EXPECTED_REVISION}" =~ ^[0-9a-f]{40}$ ]] || \
    fail "production mode requires the expected full Git SHA"
  verify_health_revision core https://core.carinaai.uk/health
  verify_health_revision cloud https://app.carinaai.uk/api/health
  verify_health_revision ops https://ops.carinaai.uk/health
  verify_health_revision scout-console https://console.labyrinthscout.com/api/readiness
  verify_route operator-improvements-route https://ops.carinaai.uk/operator/improvements
  verify_route centered-pricing-layout https://ops.carinaai.uk/pricing
  verify_route business-customers-route https://ops.carinaai.uk/business-inner/customers
}

case "${MODE}" in
  source) verify_source ;;
  production) verify_production ;;
  *) echo "Usage: verify-release.sh [source|production EXPECTED_GIT_SHA]" >&2; exit 2 ;;
esac
