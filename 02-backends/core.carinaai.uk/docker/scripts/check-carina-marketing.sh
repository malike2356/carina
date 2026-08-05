#!/usr/bin/env bash
# Check the live carinaai.uk marketing site and fail if the nginx bind mount is stale.
#
# Run on the VPS from core.carinaai.uk/:
#   bash docker/scripts/check-carina-marketing.sh
#
# Intended for cron or systemd timers. A non-zero exit code means the site needs attention.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

STAMP_FILE="public_website/.nginx-reloaded-at"
INDEX_FILE="public_website/index.html"
AUTO_RELOAD="${CARINA_MARKETING_AUTO_RELOAD:-0}"
RELOADED_ONCE=0

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

reload_and_retry() {
  if [[ "${AUTO_RELOAD}" != "1" || "${RELOADED_ONCE}" == "1" ]]; then
    return 1
  fi

  echo "WARN: attempting to self-heal carinaai.uk marketing mount..." >&2
  bash docker/scripts/reload-marketing-nginx.sh
  RELOADED_ONCE=1
  return 0
}

check_once() {
  if [[ ! -f "${INDEX_FILE}" ]]; then
    fail "Missing ${INDEX_FILE}; carinaai.uk will 403."
  fi

  if [[ ! -f "${STAMP_FILE}" ]]; then
    fail "Missing ${STAMP_FILE}; deploy has not been validated by nginx refresh."
  fi

  if [[ "${INDEX_FILE}" -nt "${STAMP_FILE}" ]]; then
    fail "${INDEX_FILE} is newer than ${STAMP_FILE}; public_website changed without nginx refresh."
  fi

  NGINX_CID="$(docker compose -f docker-compose.prod.yml ps -q nginx 2>/dev/null || true)"
  if [[ -z "${NGINX_CID}" ]]; then
    fail "nginx container is not running."
  fi

  if ! docker exec "${NGINX_CID}" test -f /var/www/public_website/index.html; then
    fail "nginx cannot see /var/www/public_website/index.html."
  fi

  HTTP_CODE="$(curl -fsS -o /dev/null -w '%{http_code}' https://carinaai.uk/ || true)"
  if [[ "${HTTP_CODE}" != "200" ]]; then
    fail "https://carinaai.uk/ returned ${HTTP_CODE:-no-response}."
  fi

  echo "OK: carinaai.uk returned 200 and public_website is fresh."
}

if check_once; then
  exit 0
fi

if reload_and_retry; then
  check_once
fi
