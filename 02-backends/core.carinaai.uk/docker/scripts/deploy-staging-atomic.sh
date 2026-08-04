#!/usr/bin/env bash
# Atomic Docker deploy for Carina staging services (build, tag, health-check, rollback).
#
# Usage (from core.carinaai.uk/ on VPS):
#   bash docker/scripts/deploy-staging-atomic.sh
#   bash docker/scripts/deploy-staging-atomic.sh carina-web-staging
#   bash docker/scripts/deploy-staging-atomic.sh --rollback carina-cloud-staging
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_BASE="${STAGING_COMPOSE_FILE:-docker-compose.staging.yml}"
COMPOSE_DEPLOY="docker-compose.staging.deploy.yml"
COMPOSE_ARGS=(-f "${COMPOSE_BASE}" -f "${COMPOSE_DEPLOY}")
COMPOSE_DEPLOY_EXTRA="${ROOT_DIR}/${COMPOSE_DEPLOY}"
export COMPOSE_DEPLOY_EXTRA
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-${ROOT_DIR}/.deploy}"

# shellcheck source=deploy-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-lib.sh"

cd "${ROOT_DIR}"

ALL_SERVICES=(carina-web-staging carina-cloud-staging carina-admin-staging)

staging_release_image_name() {
  local service="$1"
  local tag="$2"
  echo "carina-staging-release/${service}:${tag}"
}

staging_tag_built_service_image() {
  local service="$1"
  local tag="$2"
  local built_id ref
  built_id="$(docker compose "${COMPOSE_ARGS[@]}" images -q "${service}" 2>/dev/null | head -1 || true)"
  [[ -n "${built_id}" ]] || deploy_die "No image built for ${service}"
  ref="$(staging_release_image_name "${service}" "${tag}")"
  docker tag "${built_id}" "${ref}"
  record_release "${service}" "${tag}"
  deploy_log "Tagged ${service} as ${ref}"
}

staging_export_release_tag_env() {
  local service="$1"
  local tag="$2"
  local key
  key="$(echo "${service}" | tr '[:lower:]-' '[:upper:]_')_TAG"
  export "${key}=${tag}"
}

staging_atomic_rollback() {
  local service="$1"
  local prev ref
  prev="$(previous_release "${service}")" || deploy_die "No previous release for ${service}"
  ref="$(staging_release_image_name "${service}" "${prev}")"
  docker image inspect "${ref}" >/dev/null 2>&1 || deploy_die "Rollback image missing: ${ref}"
  staging_export_release_tag_env "${service}" "${prev}"
  deploy_log "Rolling back ${service} to ${ref}"
  docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps "${service}"
  health_check_compose_service "${COMPOSE_BASE}" "${service}" 120
  deploy_log "=== ${service} rolled back ==="
}

staging_atomic_build_and_deploy() {
  local service="$1"
  local tag
  tag="$(release_tag)"
  staging_export_release_tag_env "${service}" "${tag}"

  deploy_log "=== Staging atomic deploy: ${service} (${tag}) ==="
  docker compose "${COMPOSE_ARGS[@]}" build --build-arg "BUILD_REVISION=${tag}" "${service}"
  staging_tag_built_service_image "${service}" "${tag}"
  docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps "${service}"

  if ! health_check_compose_service "${COMPOSE_BASE}" "${service}" 120; then
    deploy_log "Staging deploy failed for ${service}; rolling back"
    staging_atomic_rollback "${service}" || true
    return 1
  fi

  staging_prune_old_release_images "${service}"
  deploy_log "=== ${service} deployed (${tag}) ==="
}

staging_prune_old_release_images() {
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
    ref="$(staging_release_image_name "${service}" "${old_tag}")"
    deploy_log "Pruning old staging image ${ref}"
    docker rmi "${ref}" 2>/dev/null || true
  done <<< "${to_remove}"
  local keep
  keep="$(tail -n "${KEEP_RELEASES}" "${hist}")"
  printf '%s\n' "${keep}" > "${hist}"
}

run_staging_migrations() {
  local migrations_dir="${ROOT_DIR}/src/infrastructure/migrations"
  [[ -d "${migrations_dir}" ]] || return 0
  local history="${DEPLOY_STATE_DIR}/staging-migration-history.log"
  ensure_deploy_state
  touch "${history}"
  for migration in $(ls -1 "${migrations_dir}"/*.sql 2>/dev/null | sort); do
    local name
    name="$(basename "${migration}")"
    if grep -qxF "${name}" "${history}" 2>/dev/null; then
      continue
    fi
    deploy_log "Running staging migration: ${name}"
    docker compose -f "${COMPOSE_BASE}" exec -T postgres-staging \
      psql -U carina -d carina_staging -v ON_ERROR_STOP=1 < "${migration}"
    echo "${name}" >> "${history}"
  done
}

main() {
  local mode="deploy"
  local targets=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --rollback) mode="rollback"; shift ;;
      -h|--help)
        echo "Usage: deploy-staging-atomic.sh [--rollback] [carina-web-staging|carina-cloud-staging|carina-admin-staging]"
        exit 0
        ;;
      *) targets+=("$1"); shift ;;
    esac
  done

  if [[ ${#targets[@]} -eq 0 ]]; then
    targets=("${ALL_SERVICES[@]}")
  fi

  if [[ "${mode}" == "rollback" ]]; then
    for svc in "${targets[@]}"; do
      staging_atomic_rollback "${svc}"
    done
    exit 0
  fi

  if [[ " ${targets[*]} " == *" carina-web-staging "* ]] || [[ ${#targets[@]} -eq ${#ALL_SERVICES[@]} ]]; then
    run_staging_migrations || deploy_die "Staging migrations failed; aborting deploy"
  fi

  for svc in "${targets[@]}"; do
    staging_atomic_build_and_deploy "${svc}"
  done
  docker_prune_dangling
}

main "$@"
