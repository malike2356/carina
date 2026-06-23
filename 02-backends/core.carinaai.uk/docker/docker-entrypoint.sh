#!/bin/sh
set -eu

export CARINA_HOME="${CARINA_HOME:-/data/.carina}"
export CARINA_LOCALES_DIR="${CARINA_LOCALES_DIR:-/app/locales}"
export CARINA_SPLIT_GATEWAY="${CARINA_SPLIT_GATEWAY:-false}"
export CARINA_SUPERVISOR_HUB="${CARINA_SUPERVISOR_HUB:-false}"
export CARINA_SUPERVISOR_OPS="${CARINA_SUPERVISOR_OPS:-false}"

mkdir -p /app/data/logs /app/data/hub-packs "${CARINA_HOME}"
if id node >/dev/null 2>&1; then
  chown -R node:node /app/data "${CARINA_HOME}" 2>/dev/null || true
fi

if [ "${CARINA_SKIP_CONTAINER_BOOTSTRAP:-}" != "true" ]; then
  node /app/dist/src/setup/container-bootstrap.js
fi

if [ "$#" -eq 0 ]; then
  set -- /usr/bin/supervisord -c /app/docker/supervisor/supervisord.conf
fi

exec "$@"
