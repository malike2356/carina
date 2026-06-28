#!/usr/bin/env bash
# Shared deploy helpers for Carina Docker production.
# Canonical copy: lives beside deploy-atomic.sh (synced to VPS with core.carinaai.uk).
#
# Usage:
#   source "$(dirname "$0")/deploy-lib.sh"

set -euo pipefail

KEEP_RELEASES="${KEEP_RELEASES:-3}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-.deploy}"

deploy_log() {
  echo "[$(date +%H:%M:%S)] $*"
}

deploy_die() {
  echo "ERROR: $*" >&2
  exit 1
}

release_tag() {
  date +%Y%m%d-%H%M%S
}

ensure_deploy_state() {
  mkdir -p "${DEPLOY_STATE_DIR}"
}

record_release() {
  local service="$1"
  local tag="$2"
  ensure_deploy_state
  echo "${tag}" >> "${DEPLOY_STATE_DIR}/${service}.history"
}

previous_release() {
  local service="$1"
  local hist="${DEPLOY_STATE_DIR}/${service}.history"
  if [[ ! -f "${hist}" ]]; then
    return 1
  fi
  local prev
  prev="$(tail -2 "${hist}" | head -1 || true)"
  [[ -n "${prev}" ]] || return 1
  echo "${prev}"
}

health_check_url() {
  local url="$1"
  local timeout="${2:-60}"
  local elapsed=0
  deploy_log "Health check: ${url} (timeout ${timeout}s)"
  until curl -fsS "${url}" >/dev/null 2>&1; do
    if [[ "${elapsed}" -ge "${timeout}" ]]; then
      deploy_log "Health check timed out after ${timeout}s"
      return 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  deploy_log "Health check passed (${elapsed}s)"
}

health_check_compose_service() {
  local compose_file="$1"
  local service="$2"
  local timeout="${3:-90}"
  local elapsed=0
  deploy_log "Compose health check: ${service}"
  while [[ "${elapsed}" -lt "${timeout}" ]]; do
    local cid status
    cid="$(docker compose -f "${compose_file}" ps -q "${service}" 2>/dev/null | head -1 || true)"
    if [[ -n "${cid}" ]]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${cid}" 2>/dev/null || true)"
      if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
        deploy_log "${service} is ${status}"
        return 0
      fi
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  deploy_log "${service} did not become healthy within ${timeout}s"
  return 1
}

release_image_name() {
  local service="$1"
  local tag="$2"
  echo "carina-release/${service}:${tag}"
}

resolve_built_service_image_id() {
  local compose_file="$1"
  local service="$2"
  local compose_args=(-f "${compose_file}")
  local built_id project_name

  if [[ -n "${COMPOSE_DEPLOY_EXTRA:-}" ]]; then
    compose_args+=(-f "${COMPOSE_DEPLOY_EXTRA}")
  fi

  # Prefer the image Compose just built (label), not the previous running release tag.
  built_id="$(docker images --filter "label=com.docker.compose.service=${service}" --format '{{.ID}}' 2>/dev/null | head -1 || true)"
  if [[ -n "${built_id}" ]]; then
    echo "${built_id}"
    return 0
  fi

  project_name="$(docker compose "${compose_args[@]}" config --format '{{.name}}' 2>/dev/null || true)"
  if [[ -n "${project_name}" ]]; then
    built_id="$(docker images -q "${project_name}-${service}" 2>/dev/null | head -1 || true)"
    if [[ -n "${built_id}" ]]; then
      echo "${built_id}"
      return 0
    fi
  fi

  docker compose "${compose_args[@]}" images -q "${service}" 2>/dev/null | head -1 || true
}

tag_built_service_image() {
  local compose_file="$1"
  local service="$2"
  local tag="$3"
  local built_id ref
  built_id="$(resolve_built_service_image_id "${compose_file}" "${service}")"
  [[ -n "${built_id}" ]] || deploy_die "No image built for ${service}"
  ref="$(release_image_name "${service}" "${tag}")"
  docker tag "${built_id}" "${ref}"
  record_release "${service}" "${tag}"
  deploy_log "Tagged ${service} as ${ref} (${built_id:0:12})"
}

export_release_tag_env() {
  local service="$1"
  local tag="$2"
  local key
  key="$(echo "${service}" | tr '[:lower:]-' '[:upper:]_')_TAG"
  export "${key}=${tag}"
}

rollback_compose_service() {
  local compose_file="$1"
  local service="$2"
  local prev ref
  prev="$(previous_release "${service}")" || deploy_die "No previous release for ${service}"
  ref="$(release_image_name "${service}" "${prev}")"
  docker image inspect "${ref}" >/dev/null 2>&1 || deploy_die "Rollback image missing: ${ref}"
  export_release_tag_env "${service}" "${prev}"
  deploy_log "Rolling back ${service} to ${ref}"
  docker compose -f "${compose_file}" up -d --no-deps "${service}"
}

prune_old_release_images() {
  local service="$1"
  local hist="${DEPLOY_STATE_DIR}/${service}.history"
  [[ -f "${hist}" ]] || return 0
  local to_remove
  to_remove="$(tail -n +"$((KEEP_RELEASES + 1))" "${hist}" || true)"
  if [[ -z "${to_remove}" ]]; then
    return 0
  fi
  while IFS= read -r old_tag; do
    [[ -n "${old_tag}" ]] || continue
    local ref
    ref="$(release_image_name "${service}" "${old_tag}")"
    deploy_log "Pruning old image ${ref}"
    docker rmi "${ref}" 2>/dev/null || true
  done <<< "${to_remove}"
  local keep
  keep="$(tail -n "${KEEP_RELEASES}" "${hist}")"
  printf '%s\n' "${keep}" > "${hist}"
}

atomic_deploy_static_dir() {
  local src_dir="$1"
  local dest_dir="$2"
  local backup_root="${3:-$(dirname "${dest_dir}")}"
  [[ -d "${src_dir}" ]] || deploy_die "Missing static source: ${src_dir}"
  local tmp="${backup_root}/.deploy_tmp_$(basename "${dest_dir}")_$(date +%s)"
  mkdir -p "${tmp}"
  rsync -a --delete "${src_dir}/" "${tmp}/"
  if [[ -d "${dest_dir}" ]]; then
    mv "${dest_dir}" "${backup_root}/.deploy_old_$(basename "${dest_dir}")_$(date +%s)"
  fi
  mv "${tmp}" "${dest_dir}"
  ls -1dt "${backup_root}/.deploy_old_$(basename "${dest_dir}")_"* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  deploy_log "Static deploy complete: ${dest_dir}"
}
