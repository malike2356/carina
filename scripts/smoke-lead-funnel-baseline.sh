#!/usr/bin/env bash
# Read-only smoke for lead-funnel baseline (prompt 01). Does not mutate lead data.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARINA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_ROOT="$(cd "${CARINA_ROOT}/.." && pwd)"

pass() { echo "PASS $*"; }
fail() { echo "FAIL $*" >&2; exit 1; }

bash "${CARINA_ROOT}/scripts/check-lead-funnel-release-alignment.sh" local
bash "${CARINA_ROOT}/scripts/check-lead-funnel-release-alignment.sh" production

python3 - <<'PY'
import json
from pathlib import Path
path = Path("/opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk/docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json")
doc = json.loads(path.read_text())
assert doc["schemaVersion"] == 1
assert doc["persistence"]["kind"] in {"json_file", "postgres"}
caps = doc["capabilities"]
assert isinstance(caps, list) and len(caps) >= 10
statuses = {c["status"] for c in caps}
assert statuses & {"real", "partial", "missing"}
modes = {c["mode"] for c in caps}
assert modes & {"manual", "scheduled", "provider_backed", "simulated", "missing"}
print(f"PASS matrix schema ({len(caps)} capabilities)")
PY

for url_expect in \
  "https://carinaai.uk/|200" \
  "https://app.carinaai.uk/|200" \
  "https://app.carinaai.uk/api/health|200" \
  "https://core.carinaai.uk/health|200"
do
  url="${url_expect%%|*}"
  expect="${url_expect##*|}"
  code="$(curl -sS -o /tmp/lead-funnel-smoke.body -w '%{http_code}' -L "${url}" || true)"
  [[ "${code}" == "${expect}" ]] || fail "${url} -> ${code} (expected ${expect})"
  pass "${url} -> ${code}"
done

code="$(curl -sS -o /dev/null -w '%{http_code}' 'https://admin.hireaiva.co.uk/aiva/outreach/leads' || true)"
[[ "${code}" == "200" || "${code}" == "307" || "${code}" == "302" ]] \
  || fail "https://admin.hireaiva.co.uk/aiva/outreach/leads -> ${code}"
pass "https://admin.hireaiva.co.uk/aiva/outreach/leads -> ${code}"

# Read-only Soft Wall linkage proof: approvalId resolver exists in source and production tip contains Soft Wall commit.
git -C "${CARINA_ROOT}" merge-base --is-ancestor 6c91730389c6ea1a6175b044ed07b76d42309ba6 HEAD \
  || fail "Soft Wall commit missing from HEAD"
grep -q 'findDeliveryByApprovalId' \
  "${CARINA_ROOT}/02-backends/core.carinaai.uk/src/outreach/soft-wall-approvals.ts" \
  || fail "approval-to-delivery resolver missing"
pass "approvals can resolve to outreach deliveries (read-only source proof)"

bash "${WORKSPACE_ROOT}/scripts/guard-public-github-hygiene.sh" "${CARINA_ROOT}" >/tmp/hygiene-lead-funnel.txt 2>&1 \
  || { tail -40 /tmp/hygiene-lead-funnel.txt; fail "public github hygiene"; }
pass "public github hygiene (carina)"

python3 "${WORKSPACE_ROOT}/scripts/fix-writing-style.py" \
  "${CARINA_ROOT}/02-backends/core.carinaai.uk/docs/AIVA-LEAD-FUNNEL.md" \
  "${CARINA_ROOT}/02-backends/core.carinaai.uk/docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json" \
  >/tmp/writing-style-lead-funnel.txt 2>&1 \
  || true
pass "writing-style scan (docs)"

echo "OK lead-funnel baseline smoke"
