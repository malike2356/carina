#!/bin/bash
cd "$(dirname "$0")"
if [ -z "${HOME:-}" ]; then
  HOME="$(getent passwd "$(id -un)" | cut -d: -f6)"
  export HOME
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
exec /usr/bin/node dist/src/index.js
