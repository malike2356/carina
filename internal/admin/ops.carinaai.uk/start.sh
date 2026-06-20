#!/usr/bin/env bash
# Start ops backend on the public upstream port used by nginx.
set -eo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "${HOME}/logs"

export HOME="${HOME:-$(getent passwd "$(id -un)" 2>/dev/null | cut -d: -f6)}"
export HOME="${HOME:-/home/malike}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4001}"

if [[ -z "${CARINA_CORE_ROOT:-}" ]]; then
  if [[ -d "${ROOT}/../core.carinaai.uk" ]]; then
    export CARINA_CORE_ROOT="${ROOT}/../core.carinaai.uk"
  elif [[ -d "/home/malike/apps/core.carinaai.uk" ]]; then
    export CARINA_CORE_ROOT="/home/malike/apps/core.carinaai.uk"
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
  echo "Run pnpm build first." >&2
  exit 1
fi

pkill -f "${ROOT}/dist/server.js" 2>/dev/null || true
sleep 1

nohup /usr/bin/node "${ROOT}/dist/server.js" >> "${HOME}/logs/carina-ops.out.log" 2>> "${HOME}/logs/carina-ops.err.log" &
sleep 2

if pgrep -f "${ROOT}/dist/server.js" >/dev/null 2>&1; then
  echo "Ops backend: 127.0.0.1:${PORT}"
else
  echo "ERROR: carina-ops failed to start; see ${HOME}/logs/carina-ops.err.log" >&2
  exit 1
fi
