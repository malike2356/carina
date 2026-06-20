#!/bin/bash
set -eo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "${HOME}/logs"

if [ -z "${HOME:-}" ]; then
  HOME="$(getent passwd "$(id -un)" | cut -d: -f6)"
  export HOME
fi
if [ -f .env ]; then
  eval "$(/usr/bin/node <<'NODE'
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
const content = fs.readFileSync(envPath, 'utf8');

for (const rawLine of content.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;

  const eqIndex = rawLine.indexOf('=');
  if (eqIndex <= 0) continue;

  const key = rawLine.slice(0, eqIndex).trim();
  if (!key) continue;

  let value = rawLine.slice(eqIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  process.stdout.write(`export ${key}=${JSON.stringify(value)}\n`);
}
NODE
)"
fi
export NODE_ENV=production
export WEB_ENABLED=true
export SKIP_CLI=true
export HOSTED_MODE=true
export CARINA_OPERATOR_HOSTS=core.carinaai.uk
if [ -n "${DATABASE_URL:-}" ] && [ -z "${SKILLS_HUB_DATABASE_URL:-}" ]; then
  export SKILLS_HUB_DATABASE_URL="$DATABASE_URL"
fi
export PATH="${HOME}/.local/bin:${PATH}"

if [[ ! -f dist/src/index.js ]]; then
  echo "Run pnpm build first." >&2
  exit 1
fi

pkill -f "${ROOT}/dist/src/index.js" 2>/dev/null || true
sleep 1

nohup /usr/bin/node "${ROOT}/dist/src/index.js" >> "${HOME}/logs/carina-core.out.log" 2>> "${HOME}/logs/carina-core.err.log" &
sleep 2

if pgrep -f "${ROOT}/dist/src/index.js" >/dev/null 2>&1; then
  echo "Core gateway: 127.0.0.1:3333"
else
  echo "ERROR: carina-core failed to start; see ${HOME}/logs/carina-core.err.log" >&2
  exit 1
fi
