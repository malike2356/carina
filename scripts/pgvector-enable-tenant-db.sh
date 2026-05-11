#!/usr/bin/env bash
# One-time: install pgvector into a single tenant database (requires local postgres superuser).
# Usage:
#   ./scripts/pgvector-enable-tenant-db.sh 'propreneur_t_<tenant-uuid>'
#
# Find database names:
#   psql -h 127.0.0.1 -U propreneur -d propreneur_central -c "SELECT datname FROM pg_database WHERE datname LIKE 'propreneur_t_%';"

set -euo pipefail
DB="${1:?Pass tenant database name as first argument, e.g. propreneur_t_<uuid>}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found" >&2
  exit 1
fi

echo "Enabling vector extension in database: ${DB}"
sudo -u postgres psql -d "${DB}" -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "Done. Next: cd to app root and run:"
echo "  php artisan rag:ensure-embedding-schema --tenant=<slug-or-uuid> --index-pending"
