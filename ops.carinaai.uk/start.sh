#!/usr/bin/env bash
# Start ops backend on the public upstream port used by nginx.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "${HOME}/logs"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4002}"

if [[ ! -f dist/server.js ]]; then
  echo "Run npm run build first." >&2
  exit 1
fi

pkill -f "${ROOT}/dist/server.js" 2>/dev/null || true
sleep 1

nohup node dist/server.js >> "${HOME}/logs/carina-ops.out.log" 2>> "${HOME}/logs/carina-ops.err.log" &
sleep 2

echo "Ops backend: 127.0.0.1:${PORT}"
