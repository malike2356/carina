#!/usr/bin/env bash
# Shared helpers for health-gated production and staging releases.

KEEP_RELEASES="${KEEP_RELEASES:-3}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-.deploy}"

deploy_log() {
  printf '[deploy] %s\n' "$*"
}

deploy_die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

ensure_deploy_state() {
  mkdir -p "${DEPLOY_STATE_DIR}/receipts"
}

source_revision() {
  local revision="${SOURCE_REVISION:-}"
  if [[ -z "${revision}" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    revision="$(git rev-parse HEAD)"
  fi
  [[ "${revision}" =~ ^[0-9a-f]{40}$ ]] || \
    deploy_die "SOURCE_REVISION must be a full 40-character Git SHA"
  printf '%s\n' "${revision}"
}

release_tag() {
  printf '%s-%s\n' "$(source_revision)" "$(date -u +%Y%m%dT%H%M%SZ)"
}

record_release() {
  local service="$1"
  local tag="$2"
  local history="${DEPLOY_STATE_DIR}/${service}.history"
  ensure_deploy_state
  touch "${history}"
  if [[ "$(tail -n 1 "${history}" 2>/dev/null || true)" != "${tag}" ]]; then
    printf '%s\n' "${tag}" >> "${history}"
  fi
}

current_release() {
  local history="${DEPLOY_STATE_DIR}/$1.history"
  [[ -s "${history}" ]] || return 1
  tail -n 1 "${history}"
}

previous_release() {
  local history="${DEPLOY_STATE_DIR}/$1.history"
  [[ -s "${history}" ]] || return 1
  [[ "$(wc -l < "${history}")" -ge 2 ]] || return 1
  tail -n 2 "${history}" | head -n 1
}

health_check_compose_service() {
  local compose_file="$1"
  local service="$2"
  local timeout="${3:-120}"
  local started container_id status
  started="$(date +%s)"

  while (( $(date +%s) - started < timeout )); do
    container_id="$(docker compose -f "${compose_file}" ps -q "${service}" 2>/dev/null || true)"
    if [[ -n "${container_id}" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"
      if [[ "${status}" == "healthy" ]]; then
        return 0
      fi
      if [[ "${status}" == "exited" || "${status}" == "dead" || "${status}" == "unhealthy" ]]; then
        deploy_log "${service} entered terminal state: ${status}"
        return 1
      fi
    fi
    sleep 2
  done

  deploy_log "${service} did not become healthy within ${timeout}s"
  return 1
}

verify_running_image() {
  local compose_file="$1"
  local service="$2"
  local expected_ref="$3"
  local container_id running_id expected_id
  container_id="$(docker compose -f "${compose_file}" ps -q "${service}")"
  [[ -n "${container_id}" ]] || return 1
  running_id="$(docker inspect --format '{{.Image}}' "${container_id}")"
  expected_id="$(docker image inspect --format '{{.Id}}' "${expected_ref}")"
  [[ "${running_id}" == "${expected_id}" ]]
}

verify_running_revision() {
  local compose_file="$1"
  local service="$2"
  local revision="$3"
  local container_id
  container_id="$(docker compose -f "${compose_file}" ps -q "${service}")"
  [[ -n "${container_id}" ]] || return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${container_id}" \
    | grep -qx "BUILD_REVISION=${revision}"
}

public_health_check() {
  local url="$1"
  local timeout="${2:-90}"
  local started
  started="$(date +%s)"
  while (( $(date +%s) - started < timeout )); do
    if curl -fsS --max-time 10 "${url}" >/dev/null; then
      return 0
    fi
    sleep 3
  done
  return 1
}

write_release_receipt() {
  local service="$1"
  local tag="$2"
  local image_ref="$3"
  local revision digest receipt
  revision="$(source_revision)"
  digest="$(docker image inspect --format '{{.Id}}' "${image_ref}")"
  ensure_deploy_state
  receipt="${DEPLOY_STATE_DIR}/receipts/${service}-${tag}.json"
  RECEIPT_PATH="${receipt}" \
  RECEIPT_SERVICE="${service}" \
  RECEIPT_REVISION="${revision}" \
  RECEIPT_TAG="${tag}" \
  RECEIPT_IMAGE="${image_ref}" \
  RECEIPT_DIGEST="${digest}" \
  RECEIPT_ROLLBACK="$(previous_release "${service}" 2>/dev/null || true)" \
  RECEIPT_CLOUD_CONTEXT="${CARINA_CLOUD_CONTEXT:-}" \
  python3 - <<'PY'
import glob
import json
import os
from datetime import datetime, timezone
from pathlib import Path

migrations = sorted(
    Path(path).name
    for pattern in (
        "src/infrastructure/migrations/*.sql",
        os.path.join(os.environ.get("RECEIPT_CLOUD_CONTEXT", ""), "src/db/migrations/*.sql"),
    )
    for path in glob.glob(pattern)
)
receipt = {
    "service": os.environ["RECEIPT_SERVICE"],
    "revision": os.environ["RECEIPT_REVISION"],
    "releaseTag": os.environ["RECEIPT_TAG"],
    "image": os.environ["RECEIPT_IMAGE"],
    "imageDigest": os.environ["RECEIPT_DIGEST"],
    "deployedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    "rollbackTarget": os.environ.get("RECEIPT_ROLLBACK") or None,
    "migrationSet": migrations,
    "verification": {
        "sourceProof": "passed-before-sync",
        "composeHealth": "passed",
        "runningImageDigest": "matched",
    },
}
Path(os.environ["RECEIPT_PATH"]).write_text(
    json.dumps(receipt, indent=2) + "\n",
    encoding="utf-8",
)
PY
  deploy_log "Release receipt: ${receipt}"
}

prune_old_release_images() {
  local service="$1"
  local repository="$2"
  local history="${DEPLOY_STATE_DIR}/${service}.history"
  [[ -s "${history}" ]] || return 0

  local count old_tag
  count="$(wc -l < "${history}")"
  if (( count <= KEEP_RELEASES )); then
    return 0
  fi

  while IFS= read -r old_tag; do
    [[ -n "${old_tag}" ]] || continue
    docker rmi "${repository}:${old_tag}" 2>/dev/null || true
  done < <(head -n "$((count - KEEP_RELEASES))" "${history}")

  tail -n "${KEEP_RELEASES}" "${history}" > "${history}.tmp"
  mv "${history}.tmp" "${history}"
}

docker_prune_dangling() {
  docker container prune -f 2>/dev/null || true
  docker image prune -f 2>/dev/null || true
}
