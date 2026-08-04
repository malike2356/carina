#!/usr/bin/env bash
# Emergency recovery when propcalc.uk returns Cloudflare 520 after Docker nginx cutover.
#
# Root cause pattern: host nginx is not on :80/:443 (corecarinaaiuk-nginx-1 owns them).
# propcalc.uk must be mounted into docker-compose.prod.yml and the nginx service recreated.
#
# Run on the VPS (80.190.81.208):
#   bash docker/scripts/recover-propcalc-nginx.sh
#
set -euo pipefail

ROOT="${CARINA_APPS_ROOT:-/home/malike/apps/core.carinaai.uk}"
cd "$ROOT"

if ! grep -q 'propcalc.uk.conf' docker-compose.prod.yml; then
  echo "ERROR: docker-compose.prod.yml is missing the propcalc.uk.conf volume mount." >&2
  exit 1
fi

if [[ ! -f docker/nginx/propcalc.uk.conf ]]; then
  echo "ERROR: missing docker/nginx/propcalc.uk.conf" >&2
  exit 1
fi

if [[ ! -d /www/wwwroot/propcalc.uk ]]; then
  echo "ERROR: missing /www/wwwroot/propcalc.uk" >&2
  exit 1
fi

echo "==> Recreate Docker nginx with PropCalc vhost"
export CARINA_SSL_DIR=/etc/letsencrypt
docker compose -f docker-compose.prod.yml up -d nginx

echo "==> Local health check"
curl -skI -H "Host: propcalc.uk" https://127.0.0.1/ | head -15

echo ""
echo "Public check: curl -sI https://propcalc.uk/"
echo "If Cloudflare still shows 520, purge CF cache and confirm orange-cloud SSL mode is Full (not Strict) while using the shared carinaai.uk origin cert."
