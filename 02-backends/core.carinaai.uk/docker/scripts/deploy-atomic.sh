#!/usr/bin/env bash
# Atomic Docker deploy for Carina production services.
#
# Builds tagged images, swaps containers, health-checks, rolls back on failure.
#
# Usage (from core.carinaai.uk/ on VPS):
#   bash docker/scripts/deploy-atomic.sh                    # all app services
#   bash docker/scripts/deploy-atomic.sh carina-web         # one service
#   bash docker/scripts/deploy-atomic.sh --rollback carina-web
#
# Compose files: docker-compose.prod.yml + docker-compose.deploy.yml

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_BASE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_DEPLOY="docker-compose.deploy.yml"
COMPOSE_ARGS=(-f "${COMPOSE_BASE}" -f "${COMPOSE_DEPLOY}")
COMPOSE_DEPLOY_EXTRA="${ROOT_DIR}/${COMPOSE_DEPLOY}"
export COMPOSE_DEPLOY_EXTRA
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-${ROOT_DIR}/.deploy}"

# shellcheck source=deploy-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-lib.sh"

cd "${ROOT_DIR}"

ALL_SERVICES=(carina-web carina-hub carina-ops carina-cloud)

compose_cmd() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

compose_up_service() {
  local service="$1"
  compose_cmd up -d --force-recreate --no-deps "${service}"
}

bootstrap_existing_images() {
  local service="$1"
  local hist="${DEPLOY_STATE_DIR}/${service}.history"
  [[ -f "${hist}" ]] && return 0
  local built_id tag ref
  built_id="$(compose_cmd images -q "${service}" 2>/dev/null | head -1 || true)"
  [[ -n "${built_id}" ]] || return 0
  tag="$(release_tag)"
  ref="$(release_image_name "${service}" "${tag}")"
  docker tag "${built_id}" "${ref}"
  record_release "${service}" "${tag}"
  export_release_tag_env "${service}" "${tag}"
  deploy_log "Bootstrapped ${service} release tag ${tag}"
}

atomic_build_and_deploy() {
  local service="$1"
  local tag
  tag="$(release_tag)"
  export_release_tag_env "${service}" "${tag}"

  bootstrap_existing_images "${service}"

  deploy_log "=== Atomic deploy: ${service} (${tag}) ==="
  compose_cmd build --build-arg "BUILD_REVISION=${tag}" "${service}"
  tag_built_service_image "${COMPOSE_BASE}" "${service}" "${tag}"
  compose_up_service "${service}"

  if ! health_check_compose_service "${COMPOSE_BASE}" "${service}" 120; then
    deploy_log "Deploy failed for ${service}; rolling back"
    atomic_rollback "${service}" || true
    return 1
  fi

  prune_old_release_images "${service}"
  deploy_log "=== ${service} deployed (${tag}) ==="
}

atomic_rollback() {
  local service="$1"
  local prev ref
  prev="$(previous_release "${service}")" || deploy_die "No previous release for ${service}"
  ref="$(release_image_name "${service}" "${prev}")"
  docker image inspect "${ref}" >/dev/null 2>&1 || deploy_die "Rollback image missing: ${ref}"
  export_release_tag_env "${service}" "${prev}"
  deploy_log "Rolling back ${service} to ${ref}"
  compose_cmd up -d --no-deps "${service}"
  health_check_compose_service "${COMPOSE_BASE}" "${service}" 120
  deploy_log "=== ${service} rolled back ==="
}

run_migrations() {
  local migrations_dir="${ROOT_DIR}/src/infrastructure/migrations"
  [[ -d "${migrations_dir}" ]] || return 0
  local history="${DEPLOY_STATE_DIR}/migration-history.log"
  ensure_deploy_state
  touch "${history}"
  for migration in $(ls -1 "${migrations_dir}"/*.sql 2>/dev/null | sort); do
    local name
    name="$(basename "${migration}")"
    if grep -qxF "${name}" "${history}" 2>/dev/null; then
      continue
    fi
    deploy_log "Running core migration: ${name}"
    docker compose -f "${COMPOSE_BASE}" exec -T postgres \
      psql -U carina -d carina -v ON_ERROR_STOP=1 < "${migration}"
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
        echo "Usage: deploy-atomic.sh [--rollback] [carina-web|carina-hub|carina-ops|carina-cloud]"
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
      atomic_rollback "${svc}"
    done
    exit 0
  fi

  # Migrations run once before any service swap (core DB must be ready).
  if [[ " ${targets[*]} " == *" carina-web "* ]] || [[ ${#targets[@]} -eq ${#ALL_SERVICES[@]} ]]; then
    run_migrations || deploy_die "Core migrations failed; aborting deploy"
  fi

  for svc in "${targets[@]}"; do
    atomic_build_and_deploy "${svc}"
  done
}

main "$@"
