#!/usr/bin/env bash
# Restore va.verlox.uk after Carina Docker nginx cutover (Cloudflare 520).
#
# Run on aman:
#   bash docker/scripts/recover-va-verlox-nginx.sh
#
set -euo pipefail

CARINA_DIR="${CARINA_APPS_ROOT:-/home/malike/apps/core.carinaai.uk}"
EMAIL="${CERTBOT_EMAIL:-lordsesame@gmail.com}"
COMPOSE_FILE="${CARINA_DIR}/docker-compose.prod.yml"

cd "${CARINA_DIR}"
export CARINA_SSL_DIR=/etc/letsencrypt

echo "==> Start VA web container on proxy network"
docker compose -f "${COMPOSE_FILE}" up -d va-web

echo "==> Verify edge nginx can reach va-web"
docker exec corecarinaaiuk-nginx-1 wget -qSO- --timeout=5 \
  --header="Host: va.verlox.uk" \
  http://va-web/ 2>&1 | head -10

if [[ ! -f /etc/letsencrypt/live/va.verlox.uk/fullchain.pem ]]; then
  echo "==> Issue Let's Encrypt cert for va.verlox.uk"
  docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint certbot certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --keep-until-expiring \
    -d va.verlox.uk \
    -d www.va.verlox.uk
fi

echo "==> Reload edge nginx"
docker compose -f "${COMPOSE_FILE}" up -d --force-recreate nginx

echo "==> Health checks"
curl -skI -H "Host: va.verlox.uk" https://127.0.0.1/ | head -8
curl -sI https://va.verlox.uk/ | head -8

echo ""
echo "If Cloudflare still shows 520, set SSL mode to Full (strict) and purge cache."
