#!/usr/bin/env bash
# Deploy Carina staging stack (docker-compose.staging.yml).
# Usage:
#   bash docker/scripts/deploy-staging.sh
#   bash docker/scripts/deploy-staging.sh --rollback
#   SKIP_CLOUD=1 bash docker/scripts/deploy-staging.sh
#   SKIP_ADMIN=1 bash docker/scripts/deploy-staging.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="docker-compose.staging.yml"
cd "${ROOT_DIR}"

if [[ "${1:-}" == "--rollback" ]]; then
  exec bash docker/scripts/deploy-staging-atomic.sh --rollback
fi

docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

DEFAULT_CLOUD="/home/malike/apps/app.carinaai.uk"
VERLOX_CLOUD="$(cd "${ROOT_DIR}/../../03-frontends/client-apps/app.carinaai.uk" && pwd)"
if [[ -z "${CARINA_CLOUD_CONTEXT:-}" ]]; then
  if [[ -d "${DEFAULT_CLOUD}" ]]; then
    export CARINA_CLOUD_CONTEXT="${DEFAULT_CLOUD}"
  else
    export CARINA_CLOUD_CONTEXT="${VERLOX_CLOUD}"
  fi
fi

DEFAULT_ADMIN="/home/malike/apps/admin.carinaai.uk"
VERLOX_ADMIN="$(cd "${ROOT_DIR}/../../03-frontends/client-apps/admin.carinaai.uk" && pwd)"
if [[ -z "${CARINA_ADMIN_CONTEXT:-}" ]]; then
  if [[ -d "${DEFAULT_ADMIN}" ]]; then
    export CARINA_ADMIN_CONTEXT="${DEFAULT_ADMIN}"
  else
    export CARINA_ADMIN_CONTEXT="${VERLOX_ADMIN}"
  fi
fi

echo "[staging] CARINA_CLOUD_CONTEXT=${CARINA_CLOUD_CONTEXT}"
echo "[staging] CARINA_ADMIN_CONTEXT=${CARINA_ADMIN_CONTEXT}"

test -f .env.staging.runtime || {
  echo "ERROR: copy .env.staging.example to .env.staging.runtime and fill staging secrets." >&2
  exit 1
}

if [[ "${SKIP_CLOUD:-}" != "1" ]]; then
  test -f .env.staging.cloud.runtime || {
    echo "ERROR: copy .env.staging.cloud.example to .env.staging.cloud.runtime." >&2
    exit 1
  }
fi

if [[ "${SKIP_ADMIN:-}" != "1" ]]; then
  test -f .env.staging.admin.runtime || {
    echo "ERROR: copy .env.staging.admin.example to .env.staging.admin.runtime." >&2
    exit 1
  }
fi

python3 docker/scripts/sync-staging-env.py

build_next_standalone() {
  local label="$1"
  local ctx="$2"
  if [[ -f "${ctx}/server.js" && -d "${ctx}/.next" ]]; then
    echo "[staging] ${label} build context ready at ${ctx}"
    echo "${ctx}"
    return
  fi
  echo "[staging] Building ${label} standalone in ${ctx}..."
  (
    cd "${ctx}"
    pnpm build
  )
  local standalone="${ctx}/.next/standalone"
  if [[ ! -f "${standalone}/server.js" ]]; then
    echo "ERROR: Next standalone build missing ${standalone}/server.js" >&2
    exit 1
  fi
  mkdir -p "${standalone}/.next"
  cp -r "${ctx}/.next/static" "${standalone}/.next/static"
  cp -r "${ctx}/public" "${standalone}/public" 2>/dev/null || true
  if [[ "${label}" == "cloud" ]]; then
    cp -r "${ctx}/src/lib/support" "${standalone}/src/lib/support" 2>/dev/null || true
    cp -r "${ctx}/src/lib/builtin-profiles" "${standalone}/src/lib/builtin-profiles" 2>/dev/null || true
  fi
  echo "${standalone}"
}

if [[ "${SKIP_CLOUD:-}" != "1" ]]; then
  export CARINA_CLOUD_CONTEXT="$(build_next_standalone cloud "${CARINA_CLOUD_CONTEXT}")"
  echo "[staging] Using cloud context: ${CARINA_CLOUD_CONTEXT}"
fi

if [[ "${SKIP_ADMIN:-}" != "1" ]]; then
  export CARINA_ADMIN_CONTEXT="$(build_next_standalone admin "${CARINA_ADMIN_CONTEXT}")"
  echo "[staging] Using admin context: ${CARINA_ADMIN_CONTEXT}"
fi

echo "[staging] Starting data services..."
docker compose -f "${COMPOSE_FILE}" up -d postgres-staging pgbouncer-staging redis-staging

ATOMIC_TARGETS=(carina-web-staging)
if [[ "${SKIP_CLOUD:-}" != "1" ]]; then
  ATOMIC_TARGETS+=(carina-cloud-staging)
fi
if [[ "${SKIP_ADMIN:-}" != "1" ]]; then
  ATOMIC_TARGETS+=(carina-admin-staging)
fi

bash docker/scripts/deploy-staging-atomic.sh "${ATOMIC_TARGETS[@]}"

echo "[staging] Reload nginx to pick up staging server blocks..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload 2>/dev/null || true

echo "[staging] Done. Verify:"
echo "  curl -fsS https://staging.core.carinaai.uk/health"
echo "  curl -fsS https://staging.app.carinaai.uk/api/health"
echo "  curl -fsS https://staging.admin.carinaai.uk/api/health"
echo "  bash docker/scripts/seed-staging.sh   # first time or reset test data"
