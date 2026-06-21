#!/usr/bin/env bash
# Emergency recovery when propreneur.uk returns Cloudflare 520/502 after Carina Docker cutover.
#
# Run on the VPS (80.190.81.208) as a user with sudo:
#   bash scripts/recover-propreneur-nginx.sh
#
set -euo pipefail

echo "==> Start host PHP-FPM (required for Laravel)"
sudo /etc/init.d/php-fpm-83 start
sudo /etc/init.d/php-fpm-83 status || true

echo "==> Ensure Docker nginx uses Let's Encrypt certs (not empty /etc/carina/ssl)"
cd "${CARINA_APPS_ROOT:-/home/malike/apps/core.carinaai.uk}"
export CARINA_SSL_DIR=/etc/letsencrypt
docker compose -f docker-compose.prod.yml up -d nginx

echo "==> Health check"
curl -skI -H "Host: propreneur.uk" https://127.0.0.1/platform/login | head -10

echo ""
echo "If you see HTTP/2 200 or 302 above, propreneur.uk should be back."
echo "Public check: curl -sI https://propreneur.uk/platform/login"
echo "Legacy /account/login should 301 to /platform/login after Laravel deploy."
