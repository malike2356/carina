#!/usr/bin/env bash
# Recreate Docker nginx after public_website/ changes on the host.
#
# Why: nginx mounts ./public_website -> /var/www/public_website. Docker bind mounts
# follow the host directory inode. If public_website/ is deleted and recreated, or
# replaced outside rsync into the same path, the running container can keep an empty
# stale mount and https://carinaai.uk/ returns 403 Forbidden.
#
# Run from core.carinaai.uk/ on the VPS after any marketing deploy:
#   bash docker/scripts/reload-marketing-nginx.sh
#
# Or from laptop:
#   ssh user@host 'cd /home/user/apps/core.carinaai.uk && bash docker/scripts/reload-marketing-nginx.sh'

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
cd "${ROOT_DIR}"

if [[ ! -d public_website ]]; then
  echo "ERROR: ${ROOT_DIR}/public_website missing; deploy marketing files first." >&2
  exit 1
fi

if [[ ! -f public_website/index.html ]]; then
  echo "ERROR: public_website/index.html missing; carinaai.uk will 403." >&2
  exit 1
fi

echo "Recreating nginx container (refresh public_website bind mount)..."
docker compose -f "${COMPOSE_FILE}" up -d --no-deps --force-recreate nginx

NGINX_CID="$(docker compose -f "${COMPOSE_FILE}" ps -q nginx)"
if [[ -z "${NGINX_CID}" ]]; then
  echo "ERROR: nginx container not running." >&2
  exit 1
fi

if ! docker exec "${NGINX_CID}" test -f /var/www/public_website/index.html; then
  echo "ERROR: nginx still cannot see /var/www/public_website/index.html." >&2
  echo "Check docker-compose.prod.yml volume: ./public_website:/var/www/public_website:ro" >&2
  exit 1
fi

echo "OK: carinaai.uk marketing mount visible inside nginx."
echo "Verify: curl -fsS -o /dev/null -w '%{http_code}\\n' https://carinaai.uk/"
