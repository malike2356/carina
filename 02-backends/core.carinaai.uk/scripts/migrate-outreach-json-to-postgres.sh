#!/usr/bin/env bash
# Migrate outreach-program.json -> PostgreSQL (core DB).
# Usage:
#   bash scripts/migrate-outreach-json-to-postgres.sh --dry-run
#   bash scripts/migrate-outreach-json-to-postgres.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

DRY_RUN=0
SOURCE=""
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    --source=*) SOURCE="${arg#*=}" ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

MIGRATION="${ROOT}/src/infrastructure/migrations/036-outreach-program.sql"
[[ -f "${MIGRATION}" ]] || { echo "ERROR: missing ${MIGRATION}" >&2; exit 1; }

echo "[outreach-migrate] Applying 036-outreach-program.sql"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${MIGRATION}"

export CARINA_OUTREACH_MIGRATE_DRY_RUN="${DRY_RUN}"
export CARINA_OUTREACH_MIGRATE_SOURCE="${SOURCE}"

node --import tsx - <<'NODE'
import { migrateOutreachJsonToPostgres } from './src/outreach/pg/migrate-json.ts';

const dryRun = process.env.CARINA_OUTREACH_MIGRATE_DRY_RUN === '1';
const sourcePath = process.env.CARINA_OUTREACH_MIGRATE_SOURCE || undefined;
const report = await migrateOutreachJsonToPostgres({ dryRun, sourcePath: sourcePath || undefined });
console.log(JSON.stringify(report, null, 2));
if (report.rejected.length > 0) {
  console.error(`[outreach-migrate] rejected=${report.rejected.length}`);
  process.exitCode = 2;
}
NODE

echo "[outreach-migrate] Done. Set CARINA_OUTREACH_PERSISTENCE=postgres and restart carina-web after a successful non-dry-run."
