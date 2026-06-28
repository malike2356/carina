#!/usr/bin/env bash
# Run PgBouncer admin commands inside the pooler container.
# Usage: bash docker/scripts/pgbouncer-admin.sh SHOW POOLS
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${PGBOUNCER_SERVICE:-pgbouncer}"
DB_USER="${DB_USER:-carina}"
CMD="${*:-SHOW POOLS}"

cd "${ROOT_DIR}"
docker compose -f "${COMPOSE_FILE}" exec -T "${SERVICE}" \
  psql -h 127.0.0.1 -p 6432 -U "${DB_USER}" pgbouncer -c "${CMD}"
