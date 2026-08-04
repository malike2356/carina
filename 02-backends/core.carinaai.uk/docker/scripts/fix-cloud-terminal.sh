#!/usr/bin/env bash
# Wire CARINA_OPS_TOKEN into carina-cloud + carina-ops and recreate containers.
# Also enables Environment page, logs, and other core /api/ops/* proxies.
# Run on the VPS from core.carinaai.uk/ after git pull.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "${ROOT_DIR}"

if [[ ! -f .env.docker.runtime ]]; then
  echo "ERROR: missing .env.docker.runtime (copy from .env and run sync-docker-env.py)" >&2
  exit 1
fi

python3 docker/scripts/sync-docker-env.py
touch .env.cloud.runtime
python3 docker/scripts/sync-cloud-env.py
if [[ -f .env.ops.runtime ]] || [[ -f ../ops.carinaai.uk/.env ]]; then
  touch .env.ops.runtime 2>/dev/null || true
  python3 docker/scripts/sync-ops-env.py 2>/dev/null || true
fi

if ! grep -q '^CARINA_OPS_TOKEN=.\+' .env.cloud.runtime 2>/dev/null; then
  echo "ERROR: CARINA_OPS_TOKEN still empty in .env.cloud.runtime after sync." >&2
  echo "Set it in .env.docker.runtime first, then re-run this script." >&2
  exit 1
fi

# Compose variable substitution reads project .env
if ! grep -q '^CARINA_OPS_TOKEN=' .env 2>/dev/null; then
  grep '^CARINA_OPS_TOKEN=' .env.docker.runtime >> .env
fi

echo "[fix-cloud-terminal] Recreating carina-cloud and carina-ops..."
docker compose -f "${COMPOSE_FILE}" up -d --force-recreate carina-cloud carina-ops

echo "[fix-cloud-terminal] Container env check (token must be 'yes'):"
docker compose -f "${COMPOSE_FILE}" exec -T carina-cloud sh -c \
  'printf "CARINA_USE_CORE_PROXY=%s OPS_TOKEN_SET=" "$CARINA_USE_CORE_PROXY"; [ -n "$CARINA_OPS_TOKEN" ] && echo yes || echo no'

echo "Done. Hard-refresh https://app.carinaai.uk/terminal and click Reconnect."
