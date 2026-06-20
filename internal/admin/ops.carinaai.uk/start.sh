#!/usr/bin/env bash
# Start ops backend on the public upstream port used by nginx.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "${HOME}/logs"

export NODE_ENV="${NODE_ENV:-production}"
if [[ -z "${PORT:-}" ]]; then
  if pgrep -f "${ROOT}/ops-bridge.mjs" >/dev/null 2>&1; then
    export PORT=4001
  else
    export PORT=4002
  fi
fi

if [[ -z "${CARINA_OPS_TOKEN:-}" && -z "${CARINA_WEB_PASSWORD:-}" && -f "${ROOT}/../core.carinaai.uk/.env" ]]; then
  CARINA_WEB_PASSWORD="$(
    node -e "const fs=require('fs'); const line=fs.readFileSync(process.argv[1], 'utf8').split(/\r?\n/).find((item)=>item.startsWith('CARINA_WEB_PASSWORD=')); if (line) process.stdout.write(line.slice('CARINA_WEB_PASSWORD='.length));" \
      "${ROOT}/../core.carinaai.uk/.env"
  )"
  export CARINA_WEB_PASSWORD
fi

if [[ ! -f dist/server.js ]]; then
  echo "Run npm run build first." >&2
  exit 1
fi

pkill -f "${ROOT}/dist/server.js" 2>/dev/null || true
sleep 1

nohup node dist/server.js >> "${HOME}/logs/carina-ops.out.log" 2>> "${HOME}/logs/carina-ops.err.log" &
sleep 2

echo "Ops backend: 127.0.0.1:${PORT}"
