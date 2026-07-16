#!/usr/bin/env bash
# Stop legacy bare-metal Carina supervisor programs (Docker replaces these).
set -euo pipefail

NAMES=(carina-core carina-hub carina-ops carina-cloud)

if ! sudo -n supervisorctl status >/dev/null 2>&1; then
  echo "WARN: passwordless supervisorctl not available; killing known bare-metal Node paths..."
  for pattern in \
    "/home/malike/apps/ops.carinaai.uk/dist/server.js" \
    "/home/malike/apps/app.carinaai.uk/node_modules/.bin/next" \
    "/home/malike/apps/core.carinaai.uk/dist/src/index.js"
  do
    pkill -f "${pattern}" 2>/dev/null || true
  done
  printf 'If processes restart, run: sudo supervisorctl stop %s\n' "${NAMES[*]}"
  exit 0
fi

for name in "${NAMES[@]}"; do
  if sudo -n supervisorctl status "${name}" 2>/dev/null | grep -q RUNNING; then
    echo "Stopping ${name}..."
    sudo -n supervisorctl stop "${name}" || true
  fi
done

echo "Bare-metal Carina processes stopped. Use Docker Compose for runtime."
