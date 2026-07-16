#!/usr/bin/env bash
# Seed staging database with Aiva trial workspace, sample worker, and admin operator.
# Usage (on VPS):
#   bash docker/scripts/seed-staging.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
cd "${ROOT_DIR}"

if [[ ! -f .env.staging.runtime ]]; then
  echo "ERROR: .env.staging.runtime missing. Copy from .env.staging.example first." >&2
  exit 1
fi

echo "[seed-staging] Running seed inside carina-web-staging..."
docker compose -f "${COMPOSE_FILE}" exec -T carina-web-staging \
  node --import tsx scripts/seed-staging.ts

echo "[seed-staging] Done."
echo "  Core health: curl -fsS https://staging.core.carinaai.uk/health"
echo "  Admin UI: https://staging.admin.carinaai.uk (after deploy)"
echo "  Admin API login: ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD from .env.staging.runtime"
echo "  Workspace contact: STAGING_CONTACT_EMAIL or test@staging.carinaai.uk"
