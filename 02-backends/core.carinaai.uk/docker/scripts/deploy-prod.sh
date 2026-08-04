#!/usr/bin/env bash
# One-command production deploy: bootstrap TLS (if needed) and start the full stack.
#
# Usage (from core.carinaai.uk/):
#   bash docker/scripts/deploy-prod.sh
#
# Environment:
#   CARINA_SSL_DIR   Host path for Let's Encrypt files (default: /etc/carina/ssl)
#   CERTBOT_EMAIL    ACME registration email
#   COMPOSE_FILE     Compose file (default: docker-compose.prod.yml)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SSL_DIR="${CARINA_SSL_DIR:-/etc/carina/ssl}"
CERT_PATH="${SSL_DIR}/live/carinaai.uk/fullchain.pem"

cd "${ROOT_DIR}"

for required in docker/scripts/deploy-lib.sh docker/scripts/deploy-atomic.sh; do
  [[ -s "${required}" ]] || {
    echo "ERROR: Required deployment script is missing or empty: ${required}" >&2
    exit 1
  }
done

if [[ "${CARINA_SKIP_ATOMIC_DEPLOY:-0}" != "1" ]]; then
  [[ "${SOURCE_REVISION:-}" =~ ^[0-9a-f]{40}$ ]] || {
    echo "ERROR: SOURCE_REVISION must contain the committed 40-character Git SHA." >&2
    exit 1
  }
fi

available_services="$(docker compose -f "${COMPOSE_FILE}" config --services)"
for required_service in postgres redis pgbouncer carina-web carina-hub carina-ops carina-cloud carina-admin; do
  grep -qx "${required_service}" <<< "${available_services}" || {
    echo "ERROR: ${COMPOSE_FILE} does not define ${required_service}" >&2
    exit 1
  }
done

if [[ ! -f .env.docker.runtime ]]; then
  if [[ -f .env ]]; then
    cp .env .env.docker.runtime
  elif [[ -f /home/malike/.carina/.env ]]; then
    cp /home/malike/.carina/.env .env.docker.runtime
  else
    echo "WARN: .env.docker.runtime missing; copy from .env.example and fill production values." >&2
  fi
fi

if [[ -f .env.docker.runtime ]]; then
  python3 docker/scripts/sync-docker-env.py
fi
if [[ -f .env.ops.runtime ]]; then
  python3 docker/scripts/sync-ops-env.py
fi
if [[ -f .env.cloud.runtime ]]; then
  python3 docker/scripts/sync-cloud-env.py
elif [[ -f .env.docker.runtime ]]; then
  echo "WARN: .env.cloud.runtime missing; creating from sync-cloud-env defaults." >&2
  touch .env.cloud.runtime
  python3 docker/scripts/sync-cloud-env.py
fi

if [[ -d /home/malike/apps/ops.carinaai.uk ]]; then
  export CARINA_OPS_CONTEXT="${CARINA_OPS_CONTEXT:-/home/malike/apps/ops.carinaai.uk}"
  export CARINA_CLOUD_CONTEXT="${CARINA_CLOUD_CONTEXT:-/home/malike/apps/app.carinaai.uk}"
fi

bash docker/scripts/stop-bare-metal-carina.sh 2>/dev/null || true

mkdir -p "${SSL_DIR}" "${SSL_DIR}/live/carinaai.uk" 2>/dev/null || {
  echo "NOTE: Cannot create ${SSL_DIR}; ensure it exists or set CARINA_SSL_DIR." >&2
}

if [[ ! -f "${SSL_DIR}/ssl-dhparams.pem" ]]; then
  echo "Generating DH parameters at ${SSL_DIR}/ssl-dhparams.pem (one-time)..."
  openssl dhparam -out "${SSL_DIR}/ssl-dhparams.pem" 2048
fi

echo "[1/4] Starting database services..."
docker compose -f "${COMPOSE_FILE}" up -d postgres redis pgbouncer

echo "[2/4] Ensuring TLS certificates..."
if [[ ! -f "${CERT_PATH}" ]]; then
  export NGINX_CONF="./docker/nginx/carina-prod-bootstrap.conf"
  docker compose -f "${COMPOSE_FILE}" up -d carina-web carina-hub nginx certbot
  bash docker/scripts/init-certs.sh
  unset NGINX_CONF
  docker compose -f "${COMPOSE_FILE}" up -d --force-recreate nginx
else
  echo "  Using existing certificate at ${CERT_PATH}"
fi

echo "[3/4] Starting application stack (atomic tagged deploy)..."
if [[ "${CARINA_SKIP_ATOMIC_DEPLOY:-0}" == "1" ]]; then
  if [[ "${CARINA_REBUILD_AGENT:-0}" == "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" up -d --build
  else
    docker compose -f "${COMPOSE_FILE}" build carina-ops carina-cloud
    docker compose -f "${COMPOSE_FILE}" up -d
  fi
else
  bash "${ROOT_DIR}/docker/scripts/deploy-atomic.sh"
fi

echo "[4/4] Waiting for carina-web health..."
healthy=0
for _ in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" exec -T carina-web supervisorctl -c /app/docker/supervisor/supervisord.conf status carina-core 2>/dev/null | grep -q RUNNING; then
    if docker compose -f "${COMPOSE_FILE}" exec -T carina-web /usr/local/bin/carina-healthcheck; then
      echo "carina-web is healthy"
      docker compose -f "${COMPOSE_FILE}" exec -T carina-web supervisorctl -c /app/docker/supervisor/supervisord.conf status || true
      healthy=1
      break
    fi
  fi
  sleep 2
done

if [[ "${healthy}" != "1" ]]; then
  echo "ERROR: carina-web did not become healthy before the deployment timeout." >&2
  exit 1
fi

echo ""
echo "Production stack is up."
echo "  Health:  curl -fsS http://127.0.0.1/health  (via nginx on the host)"
echo "  Status:  docker compose -f ${COMPOSE_FILE} ps"
echo "  Logs:    docker compose -f ${COMPOSE_FILE} logs -f carina-web"
echo "  Certs:   bash docker/scripts/init-certs.sh  (re-issue if needed)"
echo "  Reload:  docker compose -f ${COMPOSE_FILE} exec nginx nginx -s reload"
