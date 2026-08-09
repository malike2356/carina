#!/usr/bin/env bash
# Provider-pipeline smoke + public health for lead-funnel prompt 07.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARINA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CORE="${CARINA_ROOT}/02-backends/core.carinaai.uk"

pass() { echo "PASS $*"; }
fail() { echo "FAIL $*" >&2; exit 1; }

bash "${CARINA_ROOT}/scripts/smoke-lead-funnel-baseline.sh"

for url_expect in \
  "https://app.carinaai.uk/|200" \
  "https://app.carinaai.uk/api/health|200" \
  "https://core.carinaai.uk/health|200" \
  "https://carinaai.uk/|200"
do
  url="${url_expect%%|*}"
  expect="${url_expect##*|}"
  code="$(curl -sS -o /tmp/lead-funnel-provider-smoke.body -w '%{http_code}' -L "${url}" || true)"
  [[ "${code}" == "${expect}" ]] || fail "${url} -> ${code} (expected ${expect})"
  pass "${url} -> ${code}"
done

cd "${CORE}"
pnpm exec vitest run src/outreach/provider-smoke.test.ts src/outreach/crm-grid.test.ts src/outreach/provider-events.test.ts --reporter=dot \
  || fail "provider smoke / grid / provider-events vitest"

test -f "${CORE}/docs/AIVA-LEAD-FUNNEL-RUNBOOK.md" || fail "runbook missing"
pass "runbook present"

python3 - <<'PY'
import json
from pathlib import Path
path = Path("/opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk/docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json")
doc = json.loads(path.read_text())
ids = {c["id"] for c in doc["capabilities"]}
for required in ("observability.outreach", "smoke.provider_pipeline", "crm.grid_production"):
    assert required in ids, required
print("PASS matrix includes observability + smoke capabilities")
PY

echo "OK lead-funnel provider smoke"
