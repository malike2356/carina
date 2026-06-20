#!/usr/bin/env bash
# verify-security-config.sh - Report security configuration gaps (local or VPS)
# Usage:
#   bash scripts/verify-security-config.sh local
#   bash scripts/verify-security-config.sh vps
#   SCOUT_ALERT_TO_EMAIL=you@example.com bash scripts/complete-production-security.sh vps

set -euo pipefail

TARGET="${1:-local}"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
SCOUT_REMOTE="/home/malike/apps/console.labyrinthscout.com"
CORE_REMOTE="/home/malike/apps/core.carinaai.uk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SCOUT_LOCAL="${REPO_ROOT}/internal/servers/console.labyrinthscout.com"
CORE_LOCAL="${REPO_ROOT}/internal/servers/core.carinaai.uk"

log() { echo "[verify-security] $*"; }

env_value_len() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)"
  if [[ -z "$line" ]]; then
    echo "absent"
    return
  fi
  local val="${line#*=}"
  if [[ -z "$val" || "$val" == change_me* || "$val" == "change-me-in-production" || "$val" == "your_scout_api_key_here" ]]; then
    echo "empty_or_default"
    return
  fi
  echo "set:${#val}"
}

check_env_file() {
  local label="$1"
  local file="$2"
  shift 2
  echo ""
  echo "=== ${label} (${file}) ==="
  if [[ ! -f "$file" ]]; then
    echo "  MISSING FILE"
    return 1
  fi
  local missing=0
  for key in "$@"; do
    local status
    status="$(env_value_len "$file" "$key")"
    if [[ "$status" == absent || "$status" == empty_or_default ]]; then
      echo "  TODO  ${key} (${status})"
      missing=$((missing + 1))
    else
      echo "  ok    ${key}"
    fi
  done
  return "$missing"
}

run_http_checks() {
  local base="$1"
  echo ""
  echo "=== HTTP checks (${base}) ==="
  if curl -fsS -m 8 "${base}/api/public/trust" >/tmp/trust.json 2>/dev/null; then
    python3 - <<'PY'
import json
with open("/tmp/trust.json") as f:
    d = json.load(f)
print("  ok    public trust API")
print(f"        risk_score={d.get('risk_score')} erc8004={d.get('chain',{}).get('erc8004_status')} erc8126={d.get('chain',{}).get('erc8126_status')}")
fresh = d.get("data_freshness")
if fresh:
    print(f"        stale={fresh.get('stale')} wallet_configured={d.get('chain',{}).get('wallet_configured')}")
else:
    print("        stale=n/a (deploy latest Scout for data_freshness)")
PY
  else
    echo "  FAIL  public trust API unreachable"
  fi

  if curl -fsS -m 8 "${base}/api/readiness" >/tmp/readiness.json 2>/dev/null; then
    python3 - <<'PY'
import json
with open("/tmp/readiness.json") as f:
    d = json.load(f)
print(f"  ok    readiness API ready={d.get('ready')} ({d.get('summary')})")
PY
  else
    echo "  TODO  readiness API missing (deploy latest Scout)"
  fi
}

run_local() {
  log "Checking local configuration..."
  local fail=0
  check_env_file "Scout" "$SCOUT_LOCAL/.env" \
    SCOUT_API_KEY SCOUT_SESSION_SECRET TRUST_ATTESTER_PRIVATE_KEY \
    RESEND_API_KEY ALERT_EMAIL_TO SCOUT_CORS_ORIGIN || fail=1
  check_env_file "Carina core" "$CORE_LOCAL/.env" \
    LABYRINTH_ENABLED LABYRINTH_URL LABYRINTH_API_KEY \
    RESEND_WEBHOOK_SECRET CORS_ORIGIN CARINA_WEB_PASSWORD || fail=1
  run_http_checks "http://127.0.0.1:4444" || true
  echo ""
  if [[ "$fail" -eq 0 ]]; then
    log "Local env keys look complete. Run doctor commands to validate runtime."
  else
    log "Local env has gaps. Run: bash scripts/complete-production-security.sh local"
  fi
}

run_vps() {
  log "Checking VPS (${VPS_USER}@${VPS_HOST})..."
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE'
set -euo pipefail
SCOUT_DIR="/home/malike/apps/console.labyrinthscout.com"
CORE_DIR="/home/malike/apps/core.carinaai.uk"

env_value_len() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)"
  if [[ -z "$line" ]]; then echo "absent"; return; fi
  local val="${line#*=}"
  if [[ -z "$val" || "$val" == change_me* || "$val" == "change-me-in-production" ]]; then
    echo "empty_or_default"; return
  fi
  echo "set"
}

check_env_file() {
  local label="$1"
  local file="$2"
  shift 2
  echo ""
  echo "=== ${label} ==="
  for key in "$@"; do
    local status
    status="$(env_value_len "$file" "$key")"
    if [[ "$status" == absent || "$status" == empty_or_default ]]; then
      echo "  TODO  ${key} (${status})"
    else
      echo "  ok    ${key}"
    fi
  done
}

check_env_file "Scout .env" "$SCOUT_DIR/.env" \
  SCOUT_API_KEY SCOUT_SESSION_SECRET TRUST_ATTESTER_PRIVATE_KEY \
  RESEND_API_KEY ALERT_EMAIL_TO SCOUT_CORS_ORIGIN
check_env_file "Carina core .env" "$CORE_DIR/.env" \
  LABYRINTH_ENABLED LABYRINTH_URL LABYRINTH_API_KEY \
  RESEND_WEBHOOK_SECRET CORS_ORIGIN CARINA_WEB_PASSWORD

echo ""
echo "=== Trust wallet ==="
cd "$SCOUT_DIR"
node --input-type=module -e "
import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
const raw = process.env.TRUST_ATTESTER_PRIVATE_KEY ?? '';
if (!raw) { console.log('  TODO  TRUST_ATTESTER_PRIVATE_KEY missing'); process.exit(0); }
const pk = raw.startsWith('0x') ? raw : '0x' + raw;
const account = privateKeyToAccount(pk);
const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.TRUST_CHAIN_RPC || 'https://sepolia.base.org') });
const bal = await client.getBalance({ address: account.address });
console.log('  ok    wallet funded' + (bal > 0n ? '' : ' (balance 0 - fund via faucet)'));
" 2>/dev/null || echo "  TODO  wallet check failed"

echo ""
echo "=== HTTP checks ==="
curl -fsS -m 8 http://127.0.0.1:4444/api/public/trust >/tmp/trust.json && echo "  ok    public trust API" || echo "  FAIL  public trust API"
curl -fsS -m 8 http://127.0.0.1:4444/api/readiness >/tmp/readiness.json && echo "  ok    readiness API" || echo "  TODO  readiness API (deploy latest Scout)"
REMOTE
}

case "$TARGET" in
  local) run_local ;;
  vps)   run_vps ;;
  *)     echo "Usage: bash scripts/verify-security-config.sh [local|vps]" >&2; exit 1 ;;
esac
