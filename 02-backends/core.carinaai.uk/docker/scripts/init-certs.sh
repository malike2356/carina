#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
EMAIL="${CERTBOT_EMAIL:-lordsesame@gmail.com}"
SSL_DIR="${CARINA_SSL_DIR:-/etc/carina/ssl}"
CERT_PATH="${SSL_DIR}/live/carinaai.uk/fullchain.pem"

DOMAINS=(
  "carinaai.uk"
  "www.carinaai.uk"
  "app.carinaai.uk"
  "aiva.carinaai.uk"
  "doc.carinaai.uk"
  "docs.carinaai.uk"
  "hub.carinaai.uk"
  "skills.carinaai.uk"
  "install.carinaai.uk"
  "ops.carinaai.uk"
  "hireaiva.co.uk"
  "www.hireaiva.co.uk"
  "admin.hireaiva.co.uk"
  "ops.hireaiva.co.uk"
)

cd "${ROOT_DIR}"

if [[ ! -f "${CERT_PATH}" ]]; then
  echo "Certificate not found at ${CERT_PATH}; starting HTTP bootstrap stack..."
  export NGINX_CONF="./docker/nginx/carina-prod-bootstrap.conf"
  docker compose -f "${COMPOSE_FILE}" up -d postgres redis
  docker compose -f "${COMPOSE_FILE}" up -d carina-web carina-hub
  docker compose -f "${COMPOSE_FILE}" up -d nginx certbot
  sleep 3
fi

docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint certbot certbot \
  certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --keep-until-expiring \
  "${DOMAINS[@]/#/-d }"

echo "Certificates ready under ${SSL_DIR}/live/carinaai.uk/"
