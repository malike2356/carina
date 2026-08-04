#!/usr/bin/env bash
# Restore verlox.uk after Carina Docker nginx cutover (Cloudflare 520).
#
# verlox.uk was left on disabled bare-metal nginx; only va.verlox.uk was migrated.
# This script issues TLS for verlox.uk and reloads edge nginx with verlox.uk.conf.
#
# Run on aman:
#   bash docker/scripts/recover-verlox-uk-nginx.sh
#
set -euo pipefail

CARINA_DIR="${CARINA_APPS_ROOT:-/home/malike/apps/core.carinaai.uk}"
EMAIL="${CERTBOT_EMAIL:-lordsesame@gmail.com}"
COMPOSE_FILE="${CARINA_DIR}/docker-compose.prod.yml"
NGINX_CONF_DIR="${CARINA_DIR}/docker/nginx"
BOOTSTRAP_CONF="${NGINX_CONF_DIR}/verlox.uk.bootstrap.conf"
PROD_CONF="${NGINX_CONF_DIR}/verlox.uk.conf"
HTTPS_CONF="${NGINX_CONF_DIR}/verlox.uk.https.conf"

cd "${CARINA_DIR}"
export CARINA_SSL_DIR=/etc/letsencrypt

echo "==> Ensure host PHP socket exists"
if [[ ! -S /tmp/php-cgi-83.sock ]]; then
  echo "ERROR: /tmp/php-cgi-83.sock missing; restart host PHP-FPM (aaPanel) first." >&2
  exit 1
fi

use_bootstrap=0
if [[ ! -f /etc/letsencrypt/live/verlox.uk/fullchain.pem ]]; then
  use_bootstrap=1
  echo "==> No verlox.uk cert yet; boot HTTP-only vhost for ACME"
  cp "${BOOTSTRAP_CONF}" "${PROD_CONF}"
fi

echo "==> Reload edge nginx with verlox.uk vhost"
docker compose -f "${COMPOSE_FILE}" up -d va-web nginx

if [[ "${use_bootstrap}" -eq 1 ]]; then
  echo "==> Issue Let's Encrypt cert for verlox.uk"
  docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint certbot certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --keep-until-expiring \
    -d verlox.uk \
    -d www.verlox.uk

  echo "==> Install HTTPS vhost"
  cp "${HTTPS_CONF}" "${PROD_CONF}"
  if ! grep -q "listen 443 ssl" "${PROD_CONF}"; then
    echo "ERROR: ${PROD_CONF} missing HTTPS block after cert issue." >&2
    exit 1
  fi
fi

echo "==> Reload edge nginx (pick up cert + HTTPS vhost)"
docker compose -f "${COMPOSE_FILE}" up -d nginx
docker compose -f "${COMPOSE_FILE}" exec nginx nginx -s reload

echo "==> Health checks"
curl -skI -H "Host: verlox.uk" https://127.0.0.1/ | head -8
curl -sI https://verlox.uk/ | head -8

echo ""
echo "If Cloudflare still shows 520, set SSL mode to Full (strict) and purge cache."
