#!/usr/bin/env bash
# Restore files.verlox.uk -> FileBrowser (VPS file manager).
#
# Run on aman:
#   bash docker/scripts/recover-files-verlox-nginx.sh
#
set -euo pipefail

CARINA_DIR="${CARINA_APPS_ROOT:-/home/malike/apps/core.carinaai.uk}"
EMAIL="${CERTBOT_EMAIL:-lordsesame@gmail.com}"
COMPOSE_FILE="${CARINA_DIR}/docker-compose.prod.yml"
NGINX_CONF_DIR="${CARINA_DIR}/docker/nginx"
BOOTSTRAP_CONF="${NGINX_CONF_DIR}/files.verlox.uk.bootstrap.conf"
PROD_CONF="${NGINX_CONF_DIR}/files.verlox.uk.conf"

cd "${CARINA_DIR}"
export CARINA_SSL_DIR=/etc/letsencrypt

echo "==> Ensure FileBrowser is running on the proxy network"
if ! docker ps --format '{{.Names}}' | grep -qx filebrowser; then
  docker compose -f /home/malike/apps/filebrowser/docker-compose.yml up -d
fi

if [[ ! -f /etc/letsencrypt/live/files.verlox.uk/fullchain.pem ]]; then
  echo "==> No TLS cert yet; boot HTTP-only vhost for ACME"
  cp "${BOOTSTRAP_CONF}" "${PROD_CONF}.bootstrap-active"
  # nginx mounts files.verlox.uk.conf; temporarily use bootstrap content
  cp "${BOOTSTRAP_CONF}" "${PROD_CONF}"
  docker compose -f "${COMPOSE_FILE}" up -d nginx
  docker compose -f "${COMPOSE_FILE}" exec nginx nginx -s reload

  docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint certbot certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --keep-until-expiring \
    -d files.verlox.uk

  git checkout -- "${PROD_CONF}" 2>/dev/null || true
fi

if ! grep -q verlox_filebrowser "${PROD_CONF}"; then
  echo "ERROR: ${PROD_CONF} is not the FileBrowser vhost. Update repo and redeploy." >&2
  exit 1
fi

echo "==> Reload edge nginx"
docker compose -f "${COMPOSE_FILE}" up -d nginx
docker compose -f "${COMPOSE_FILE}" exec nginx nginx -t
docker compose -f "${COMPOSE_FILE}" exec nginx nginx -s reload

echo "==> Health checks (FileBrowser returns 404 on HEAD; use GET)"
docker compose -f "${COMPOSE_FILE}" exec nginx wget -qSO- --timeout=5 http://filebrowser:8080/ 2>&1 | head -5
curl -sk -o /dev/null -w "local GET %{http_code}\n" -H "Host: files.verlox.uk" https://127.0.0.1/
curl -sk -o /dev/null -w "public GET %{http_code}\n" https://files.verlox.uk/

echo ""
echo "Done. Open https://files.verlox.uk/ and sign in with FileBrowser."
echo "Delete unused Cloudflare DNS: api.verlox.uk, docs.verlox.uk"
