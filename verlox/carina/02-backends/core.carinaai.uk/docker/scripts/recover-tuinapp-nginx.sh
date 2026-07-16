#!/usr/bin/env bash
# Restore tuinapp.uk after Carina Docker nginx cutover (Cloudflare 520 on all *.tuinapp.uk hosts).
#
# Run on aman:
#   bash recover-tuinapp-nginx.sh
#
set -euo pipefail

CARINA_DIR="${CARINA_APPS_ROOT:-/home/malike/apps/core.carinaai.uk}"
TUINAPP_DIR="${TUINAPP_APP_DIR:-/home/malike/tuinapp/app}"
EMAIL="${CERTBOT_EMAIL:-lordsesame@gmail.com}"
COMPOSE_FILE="${CARINA_DIR}/docker-compose.prod.yml"
NGINX_CONF="${CARINA_DIR}/docker/nginx/tuinapp.uk.conf"
HTTP_ONLY="${CARINA_DIR}/docker/nginx/tuinapp.uk.http-bootstrap.conf"

echo "==> Attach tuinapp_app to Docker proxy network (nginx upstream)"
if ! docker network inspect proxy --format '{{range .Containers}}{{.Name}} {{end}}' | grep -q 'tuinapp_app'; then
  docker network connect proxy tuinapp_app
fi

echo "==> Verify nginx can reach tuinapp_app:3000"
docker exec corecarinaaiuk-nginx-1 wget -qO- --timeout=5 http://tuinapp_app:3000/api/health

if [[ ! -f /etc/letsencrypt/live/tuinapp.uk/fullchain.pem ]]; then
  echo "==> Issue Let's Encrypt cert for tuinapp.uk (HTTP bootstrap)"
  cat > "${HTTP_ONLY}" <<'EOF'
upstream tuinapp_web {
  server tuinapp_app:3000;
}

server {
  listen 80;
  server_name tuinapp.uk www.tuinapp.uk ~^(?<subdomain>[^.]+)\.tuinapp\.uk$;

  include /etc/nginx/certbot-location.inc;

  location / {
    proxy_pass         http://tuinapp_web;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }
}
EOF

  cp "${HTTP_ONLY}" "${NGINX_CONF}"
  cd "${CARINA_DIR}"
  export CARINA_SSL_DIR=/etc/letsencrypt
  docker compose -f "${COMPOSE_FILE}" up -d nginx

  docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint certbot certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --keep-until-expiring \
    -d tuinapp.uk \
    -d www.tuinapp.uk

  echo "==> Install full HTTPS vhost (re-copy from repo if this script was copied without it)"
fi

if [[ ! -f "${NGINX_CONF}" ]]; then
  echo "ERROR: ${NGINX_CONF} missing. Copy docker/nginx/tuinapp.uk.conf from git and re-run." >&2
  exit 1
fi

cd "${CARINA_DIR}"
export CARINA_SSL_DIR=/etc/letsencrypt
docker compose -f "${COMPOSE_FILE}" up -d nginx

echo "==> Health checks"
curl -sf http://127.0.0.1:4000/api/health >/dev/null
curl -skI -H "Host: tuinapp.uk" https://127.0.0.1/ | head -8
curl -skI -H "Host: admin.tuinapp.uk" https://127.0.0.1/auth/login | head -8

echo ""
echo "Public checks:"
echo "  curl -sI https://tuinapp.uk/"
echo "  curl -sI https://admin.tuinapp.uk/auth/login"
echo "  curl -sI https://tuinapp.uk/account/login   (should 301 to /auth/login after tuinapp app redeploy)"
