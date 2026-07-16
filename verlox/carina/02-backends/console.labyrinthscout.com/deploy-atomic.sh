#!/usr/bin/env bash
# Immutable, health-gated Scout Console and Engine deployment.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${SCOUT_DEPLOY_STATE_DIR:-${ROOT_DIR}/.deploy}"
COMPOSE_FILE="${SCOUT_COMPOSE_FILE:-docker-compose.prod.yml}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
REVISION="${SOURCE_REVISION:-}"
[[ "${REVISION}" =~ ^[0-9a-f]{40}$ ]] || {
  echo "ERROR: SOURCE_REVISION must be a full Git SHA." >&2
  exit 1
}

cd "${ROOT_DIR}"
mkdir -p "${STATE_DIR}/receipts"

if ! grep -qE '^SCOUT_REDIS_PASSWORD=.+' .env 2>/dev/null; then
  python3 - <<'PY'
from pathlib import Path
import secrets

path = Path(".env")
lines = path.read_text().splitlines() if path.exists() else []
lines.append(f"SCOUT_REDIS_PASSWORD={secrets.token_urlsafe(36)}")
path.write_text("\n".join(lines) + "\n")
PY
fi

exec 9>"${STATE_DIR}/scout.lock"
flock -n 9 || {
  echo "ERROR: Another Scout deployment is running." >&2
  exit 1
}

HISTORY="${STATE_DIR}/scout.history"
touch "${HISTORY}"
TAG="${REVISION}-$(date -u +%Y%m%dT%H%M%SZ)"
PREVIOUS_TAG="$(tail -n 1 "${HISTORY}" | cut -f1)"
export SCOUT_CONSOLE_TAG="${TAG}"
export SCOUT_ENGINE_TAG="${TAG}"

wait_healthy() {
  local service="$1"
  local started id status
  started="$(date +%s)"
  while (( $(date +%s) - started < 180 )); do
    id="$(docker compose -f "${COMPOSE_FILE}" ps -q "${service}" 2>/dev/null || true)"
    if [[ -n "${id}" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${id}")"
      [[ "${status}" == "healthy" ]] && return 0
      [[ "${status}" == "unhealthy" || "${status}" == "exited" ]] && return 1
    fi
    sleep 2
  done
  return 1
}

rollback() {
  [[ -n "${PREVIOUS_TAG}" ]] || return 1
  export SCOUT_CONSOLE_TAG="${PREVIOUS_TAG}"
  export SCOUT_ENGINE_TAG="${PREVIOUS_TAG}"
  export SCOUT_CONSOLE_IMAGE_DIGEST="$(docker image inspect --format '{{.Id}}' "scout-release/scout-console:${PREVIOUS_TAG}")"
  export SCOUT_ENGINE_IMAGE_DIGEST="$(docker image inspect --format '{{.Id}}' "scout-release/scout-engine:${PREVIOUS_TAG}")"
  docker compose -f "${COMPOSE_FILE}" up -d --no-deps labyrinth-scout scout-engine
  wait_healthy labyrinth-scout && wait_healthy scout-engine
}

docker compose -f "${COMPOSE_FILE}" build --pull \
  --build-arg "BUILD_REVISION=${REVISION}" \
  --build-arg "BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  labyrinth-scout scout-engine

export SCOUT_CONSOLE_IMAGE_DIGEST="$(docker image inspect --format '{{.Id}}' "scout-release/scout-console:${TAG}")"
export SCOUT_ENGINE_IMAGE_DIGEST="$(docker image inspect --format '{{.Id}}' "scout-release/scout-engine:${TAG}")"

docker compose -f "${COMPOSE_FILE}" up -d postgres redis
docker compose -f "${COMPOSE_FILE}" up -d --no-deps labyrinth-scout
if ! wait_healthy labyrinth-scout; then
  rollback || true
  echo "ERROR: Scout Console health gate failed." >&2
  exit 1
fi

docker compose -f "${COMPOSE_FILE}" up -d --no-deps scout-engine
if ! wait_healthy scout-engine; then
  rollback || true
  echo "ERROR: Scout Engine health gate failed." >&2
  exit 1
fi

payload="$(curl -fsS --max-time 15 https://console.labyrinthscout.com/api/readiness)"
grep -q "${REVISION}" <<< "${payload}" || {
  rollback || true
  echo "ERROR: Public Scout readiness does not report ${REVISION}." >&2
  exit 1
}

printf '%s\t%s\t%s\n' \
  "${TAG}" "${SCOUT_CONSOLE_IMAGE_DIGEST}" "${SCOUT_ENGINE_IMAGE_DIGEST}" >> "${HISTORY}"

RECEIPT="${STATE_DIR}/receipts/scout-${TAG}.json"
RECEIPT_PATH="${RECEIPT}" RECEIPT_REVISION="${REVISION}" RECEIPT_TAG="${TAG}" \
CONSOLE_DIGEST="${SCOUT_CONSOLE_IMAGE_DIGEST}" ENGINE_DIGEST="${SCOUT_ENGINE_IMAGE_DIGEST}" \
ROLLBACK_TARGET="${PREVIOUS_TAG}" python3 - <<'PY'
import glob
import json
import os
from datetime import datetime, timezone
from pathlib import Path

receipt = {
    "revision": os.environ["RECEIPT_REVISION"],
    "releaseTag": os.environ["RECEIPT_TAG"],
    "deployedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "images": {
        "scout-console": os.environ["CONSOLE_DIGEST"],
        "scout-engine": os.environ["ENGINE_DIGEST"],
    },
    "migrationSet": sorted(
        Path(path).name for path in glob.glob("src/migrations/*")
    ),
    "verification": {
        "sourceProof": "passed-before-sync",
        "consoleHealth": "passed",
        "engineHealth": "passed",
        "publicRevision": "matched",
    },
    "rollbackTarget": os.environ.get("ROLLBACK_TARGET") or None,
}
Path(os.environ["RECEIPT_PATH"]).write_text(
    json.dumps(receipt, indent=2) + "\n",
    encoding="utf-8",
)
PY

count="$(wc -l < "${HISTORY}")"
if (( count > KEEP_RELEASES )); then
  while IFS=$'\t' read -r old_tag _; do
    docker rmi "scout-release/scout-console:${old_tag}" "scout-release/scout-engine:${old_tag}" 2>/dev/null || true
  done < <(head -n "$((count - KEEP_RELEASES))" "${HISTORY}")
  tail -n "${KEEP_RELEASES}" "${HISTORY}" > "${HISTORY}.tmp"
  mv "${HISTORY}.tmp" "${HISTORY}"
fi

docker image prune -f 2>/dev/null || true
echo "Scout release complete: ${TAG}"
