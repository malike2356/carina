#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
EMAIL="${CERTBOT_EMAIL:-lordsesame@gmail.com}"

# The current nginx layout reuses the shared carinaai.uk certificate for the
# production vhosts in this repo. The console.labyrinthscout.com certificate is
# managed in the Scout repo, not here.
DOMAINS=(
  "carinaai.uk"
  "www.carinaai.uk"
  "app.carinaai.uk"
  "docs.carinaai.uk"
  "hub.carinaai.uk"
  "skills.carinaai.uk"
  "install.carinaai.uk"
  "ops.carinaai.uk"
)

cd "${ROOT_DIR}"

docker compose -f "${COMPOSE_FILE}" run --rm --entrypoint certbot certbot \
  certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  "${DOMAINS[@]/#/-d }"
