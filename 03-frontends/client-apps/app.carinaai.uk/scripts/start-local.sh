#!/usr/bin/env bash
# Start local Aiva/Carina Cloud UI against Docker Postgres (carina_cloud).
# Usage: bash scripts/start-local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CORE_DB_IP="$(docker inspect corecarinaaiuk-postgres-1 --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"
CORE_DB_PW="$(docker inspect corecarinaaiuk-postgres-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p' | head -1)"
CORE_DB_USER="$(docker inspect corecarinaaiuk-postgres-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_USER=//p' | head -1)"
CORE_DB_USER="${CORE_DB_USER:-carina}"

if [[ -z "$CORE_DB_IP" || -z "$CORE_DB_PW" ]]; then
  echo "ERROR: could not resolve corecarinaaiuk-postgres-1 IP/password" >&2
  exit 1
fi

# Prefer carina_cloud (Next/Drizzle schema). carina_central is the Python Core schema.
export DATABASE_URL="postgresql://${CORE_DB_USER}:${CORE_DB_PW}@${CORE_DB_IP}:5432/carina_cloud"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-dev-local-better-auth-secret-change-me-32chars}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

# Free the port if a stale next is bound
if command -v ss >/dev/null; then
  PIDS="$(ss -tlnp | sed -n "s/.*:${PORT} .*pid=\\([0-9]*\\).*/\\1/p" | sort -u)"
  if [[ -n "${PIDS}" ]]; then
    echo "Stopping existing listeners on :${PORT}: ${PIDS}"
    # shellcheck disable=SC2086
    kill ${PIDS} 2>/dev/null || true
    sleep 1
  fi
fi

mkdir -p /tmp
LOG="${LOG:-/tmp/aiva-next-local.log}"
echo "Starting Next on :${PORT} (db=carina_cloud@${CORE_DB_IP}) -> ${LOG}"
nohup ./node_modules/.bin/next start --port "$PORT" --hostname "$HOSTNAME" >"$LOG" 2>&1 &
echo "pid $!"
sleep 2
curl -sS -o /dev/null -w "GET / -> %{http_code}\n" "http://127.0.0.1:${PORT}/" || true
