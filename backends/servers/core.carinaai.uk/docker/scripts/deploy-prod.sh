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
docker compose -f "${COMPOSE_FILE}" up -d postgres redis

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

echo "[3/4] Starting application stack..."
docker compose -f "${COMPOSE_FILE}" up -d --build

echo "[4/4] Waiting for carina-web health..."
for _ in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" exec -T carina-web supervisorctl -c /app/docker/supervisor/supervisord.conf status carina-core 2>/dev/null | grep -q RUNNING; then
    if docker compose -f "${COMPOSE_FILE}" exec -T carina-web /usr/local/bin/carina-healthcheck; then
      echo "carina-web is healthy"
      docker compose -f "${COMPOSE_FILE}" exec -T carina-web supervisorctl -c /app/docker/supervisor/supervisord.conf status
      break
    fi
  fi
  sleep 2
done

echo ""
echo "Production stack is up."
echo "  Health:  curl -fsS http://127.0.0.1/health  (via nginx on the host)"
echo "  Status:  docker compose -f ${COMPOSE_FILE} ps"
echo "  Logs:    docker compose -f ${COMPOSE_FILE} logs -f carina-web"
echo "  Certs:   bash docker/scripts/init-certs.sh  (re-issue if needed)"
echo "  Reload:  docker compose -f ${COMPOSE_FILE} exec nginx nginx -s reload"
