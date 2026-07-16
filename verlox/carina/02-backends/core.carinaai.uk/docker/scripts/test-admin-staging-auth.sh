#!/usr/bin/env bash
# Smoke test admin login + TOTP setup against staging core API.
# Usage:
#   ADMIN_EMAIL=admin@staging.carinaai.uk ADMIN_PASSWORD='...' \
#     bash docker/scripts/test-admin-staging-auth.sh
#   CORE_URL=http://localhost:3000 bash docker/scripts/test-admin-staging-auth.sh
#   USE_DOCKER=1 bash docker/scripts/test-admin-staging-auth.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
CORE_URL="${CORE_URL:-http://localhost:3000}"
EMAIL="${ADMIN_EMAIL:-admin@staging.carinaai.uk}"
PASSWORD="${ADMIN_PASSWORD:-AdminPassword123!}"

curl_json() {
  if [[ "${USE_DOCKER:-}" == "1" ]]; then
    docker exec carina-staging-carina-web-staging-1 curl -sS "$@"
  else
    curl -sS "$@"
  fi
}

echo "[admin-auth-test] POST ${CORE_URL}/api/admin/auth/login"
LOGIN=$(curl_json -X POST "${CORE_URL}/api/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

echo "${LOGIN}" | python3 -m json.tool 2>/dev/null || echo "${LOGIN}"

STEP=$(echo "${LOGIN}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('step',''))" 2>/dev/null || true)
PENDING=$(echo "${LOGIN}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pendingToken',''))" 2>/dev/null || true)
SECRET=$(echo "${LOGIN}" | python3 -c "
import sys, json, urllib.parse
d = json.load(sys.stdin)
url = str(d.get('otpauthUrl', '')).replace('otpauth://', 'https://', 1)
if not url:
    sys.exit(0)
q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
print(q.get('secret', [''])[0])
" 2>/dev/null || true)

if [[ "${STEP}" != "totp_setup" && "${STEP}" != "totp_verify" ]]; then
  echo "[admin-auth-test] Expected totp_setup or totp_verify; got step=${STEP}" >&2
  exit 1
fi

if [[ "${STEP}" == "totp_setup" && -n "${SECRET}" ]]; then
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  CODE=$(
    cd "${ROOT_DIR}" && node --input-type=module -e "
import { generate } from 'otplib';
const secret = process.argv[1];
console.log(await generate({ secret }));
" "${SECRET}"
  )
  echo "[admin-auth-test] Verifying TOTP setup with generated code"
  VERIFY=$(curl_json -X POST "${CORE_URL}/api/admin/auth/totp/setup/verify" \
    -H 'Content-Type: application/json' \
    -d "{\"pendingToken\":\"${PENDING}\",\"code\":\"${CODE}\"}")
  echo "${VERIFY}" | python3 -m json.tool 2>/dev/null || echo "${VERIFY}"
  FINAL=$(echo "${VERIFY}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('step',''))" 2>/dev/null || true)
  if [[ "${FINAL}" != "complete" ]]; then
    echo "[admin-auth-test] TOTP setup verify failed" >&2
    exit 1
  fi
  echo "[admin-auth-test] TOTP setup complete"
  exit 0
fi

echo "[admin-auth-test] Login step=${STEP} (totp already enabled; manual code required for verify step)"
exit 0
