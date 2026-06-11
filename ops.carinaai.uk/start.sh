#!/usr/bin/env bash
# Start ops backend (4001) and nginx-facing bridge (4002).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "${HOME}/logs"

export NODE_ENV="${NODE_ENV:-production}"
export OPS_BACKEND_PORT="${OPS_BACKEND_PORT:-4001}"
export OPS_BRIDGE_PORT="${OPS_BRIDGE_PORT:-4002}"

if [[ ! -f dist/server.js ]]; then
  echo "Run npm run build first." >&2
  exit 1
fi

pkill -f "${ROOT}/dist/server.js" 2>/dev/null || true
pkill -f "${ROOT}/ops-bridge.mjs" 2>/dev/null || true
sleep 1

nohup node dist/server.js >> "${HOME}/logs/carina-ops.out.log" 2>> "${HOME}/logs/carina-ops.err.log" &
nohup node ops-bridge.mjs >> "${HOME}/logs/carina-ops-bridge.out.log" 2>> "${HOME}/logs/carina-ops-bridge.err.log" &
sleep 2

echo "Ops backend: 127.0.0.1:${OPS_BACKEND_PORT}"
echo "Ops bridge:  127.0.0.1:${OPS_BRIDGE_PORT} (nginx upstream)"
