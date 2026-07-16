#!/usr/bin/env bash
# Build, tag, verify, and roll back immutable Carina production releases.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_BASE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_DEPLOY="${COMPOSE_DEPLOY_FILE:-docker-compose.deploy.yml}"
COMPOSE_ARGS=(-f "${COMPOSE_BASE}" -f "${COMPOSE_DEPLOY}")
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-${ROOT_DIR}/.deploy}"
export DEPLOY_STATE_DIR

# shellcheck source=deploy-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-lib.sh"

cd "${ROOT_DIR}"

ALL_SERVICES=(carina-web carina-hub carina-ops carina-cloud carina-admin)
declare -A IMAGE_REPOSITORIES=(
  [carina-web]="carina-release/carina-web"
  [carina-hub]="carina-release/carina-hub"
  [carina-ops]="carina-release/carina-ops"
  [carina-cloud]="carina-release/carina-cloud"
  [carina-admin]="carina-release/carina-admin"
)

tag_env_key() {
  case "$1" in
    carina-web) echo CARINA_WEB_TAG ;;
    carina-hub) echo CARINA_HUB_TAG ;;
    carina-ops) echo CARINA_OPS_TAG ;;
    carina-cloud) echo CARINA_CLOUD_TAG ;;
    carina-admin) echo CARINA_ADMIN_TAG ;;
    *) deploy_die "Unknown service: $1" ;;
  esac
}

digest_env_key() {
  case "$1" in
    carina-web) echo CARINA_WEB_IMAGE_DIGEST ;;
    carina-hub) echo CARINA_HUB_IMAGE_DIGEST ;;
    carina-ops) echo CARINA_OPS_IMAGE_DIGEST ;;
    carina-cloud) echo CARINA_CLOUD_IMAGE_DIGEST ;;
    carina-admin) echo CARINA_ADMIN_IMAGE_DIGEST ;;
    *) deploy_die "Unknown service: $1" ;;
  esac
}

export_release_tag() {
  local key
  key="$(tag_env_key "$1")"
  export "${key}=$2"
}

target_contains() {
  local wanted="$1"
  shift
  local candidate
  for candidate in "$@"; do
    [[ "${candidate}" == "${wanted}" ]] && return 0
  done
  return 1
}

prepare_compose_tags() {
  local new_tag="$1"
  shift
  local targets=("$@")
  local service current
  for service in "${ALL_SERVICES[@]}"; do
    if [[ -n "${new_tag}" ]] && target_contains "${service}" "${targets[@]}"; then
      export_release_tag "${service}" "${new_tag}"
      continue
    fi
    current="$(current_release "${service}" 2>/dev/null || true)"
    [[ -n "${current}" ]] || \
      deploy_die "No recorded release for ${service}; run one full deployment first"
    export_release_tag "${service}" "${current}"
  done
}

assert_services_exist() {
  local available service
  available="$(docker compose "${COMPOSE_ARGS[@]}" config --services)"
  for service in "${ALL_SERVICES[@]}"; do
    grep -qx "${service}" <<< "${available}" || \
      deploy_die "Production compose does not define required service: ${service}"
  done
}

rollback_to_tag() {
  local service="$1"
  local tag="$2"
  local ref="${IMAGE_REPOSITORIES[$service]}:${tag}"
  docker image inspect "${ref}" >/dev/null 2>&1 || \
    deploy_die "Rollback image is missing: ${ref}"
  export_release_tag "${service}" "${tag}"
  export "$(digest_env_key "${service}")=$(docker image inspect --format '{{.Id}}' "${ref}")"
  deploy_log "Rolling back ${service} to ${ref}"
  docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps "${service}"
  health_check_compose_service "${COMPOSE_BASE}" "${service}" 120
  verify_running_image "${COMPOSE_BASE}" "${service}" "${ref}" || \
    deploy_die "Rollback image verification failed for ${service}"
  verify_running_revision "${COMPOSE_BASE}" "${service}" "${tag%%-*}" || \
    deploy_die "Rollback revision verification failed for ${service}"
}

rollback_previous() {
  local service="$1"
  local tag
  tag="$(previous_release "${service}")" || deploy_die "No previous release for ${service}"
  rollback_to_tag "${service}" "${tag}"
}

build_and_deploy() {
  local service="$1"
  local tag="$2"
  local revision="$3"
  local old_tag ref
  old_tag="$(current_release "${service}" 2>/dev/null || true)"
  ref="${IMAGE_REPOSITORIES[$service]}:${tag}"

  export_release_tag "${service}" "${tag}"
  deploy_log "Building ${service} from ${revision} as ${ref}"
  docker compose "${COMPOSE_ARGS[@]}" build --pull \
    --build-arg "BUILD_REVISION=${revision}" \
    --build-arg "BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "${service}"
  docker image inspect "${ref}" >/dev/null 2>&1 || \
    deploy_die "Expected release image was not created: ${ref}"
  export "$(digest_env_key "${service}")=$(docker image inspect --format '{{.Id}}' "${ref}")"

  docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps "${service}"
  if ! health_check_compose_service "${COMPOSE_BASE}" "${service}" 180 \
    || ! verify_running_image "${COMPOSE_BASE}" "${service}" "${ref}" \
    || ! verify_running_revision "${COMPOSE_BASE}" "${service}" "${revision}"; then
    deploy_log "Deployment verification failed for ${service}"
    if [[ -n "${old_tag}" ]]; then
      rollback_to_tag "${service}" "${old_tag}" || true
    fi
    return 1
  fi

  record_release "${service}" "${tag}"
  write_release_receipt "${service}" "${tag}" "${ref}"
  prune_old_release_images "${service}" "${IMAGE_REPOSITORIES[$service]}"
  deploy_log "Deployed ${service} at ${revision}"
}

verify_public_release() {
  local revision="$1"
  local url
  for url in \
    "https://core.carinaai.uk/health" \
    "https://app.carinaai.uk/api/health" \
    "https://ops.carinaai.uk/health"
  do
    public_health_check "${url}" 120 || return 1
    curl -fsS --max-time 10 "${url}" | grep -q "${revision}" || {
      deploy_log "${url} does not report expected revision ${revision}"
      return 1
    }
  done
  public_health_check "https://app.carinaai.uk/themes/theme-bridge.css" 90 || return 1
  public_health_check "https://ops.carinaai.uk/pricing" 90 || return 1
  public_health_check "https://ops.carinaai.uk/operator/improvements" 90 || return 1
}

main() {
  local mode="deploy"
  local targets=()
  local revision tag service

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --rollback) mode="rollback"; shift ;;
      -h|--help)
        echo "Usage: deploy-atomic.sh [--rollback] [service ...]"
        exit 0
        ;;
      *) targets+=("$1"); shift ;;
    esac
  done

  if [[ ${#targets[@]} -eq 0 ]]; then
    targets=("${ALL_SERVICES[@]}")
  fi

  ensure_deploy_state
  exec 9>"${DEPLOY_STATE_DIR}/production.lock"
  flock -n 9 || deploy_die "Another production deployment is already running"

  if [[ "${mode}" == "rollback" ]]; then
    prepare_compose_tags "" "${targets[@]}"
    for service in "${targets[@]}"; do
      export_release_tag "${service}" "$(previous_release "${service}")"
    done
    assert_services_exist
    for service in "${targets[@]}"; do
      rollback_previous "${service}"
    done
    exit 0
  fi

  revision="$(source_revision)"
  tag="$(release_tag)"
  prepare_compose_tags "${tag}" "${targets[@]}"
  assert_services_exist
  local deployed=()
  for service in "${targets[@]}"; do
    if ! build_and_deploy "${service}" "${tag}" "${revision}"; then
      for service in "${deployed[@]}"; do
        rollback_previous "${service}" || true
      done
      deploy_die "Release ${tag} failed and rollback was attempted"
    fi
    deployed+=("${service}")
  done

  if [[ ${#targets[@]} -eq ${#ALL_SERVICES[@]} ]] && ! verify_public_release "${revision}"; then
    for service in "${deployed[@]}"; do
      rollback_previous "${service}" || true
    done
    deploy_die "Public release verification failed and rollback was attempted"
  fi

  docker_prune_dangling
  deploy_log "Production release complete: ${tag}"
}

main "$@"
