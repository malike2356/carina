#!/bin/sh
set -eu

export CARINA_HOME="${CARINA_HOME:-/data/.carina}"
export CARINA_LOCALES_DIR="${CARINA_LOCALES_DIR:-/app/locales}"
export CARINA_SPLIT_GATEWAY="${CARINA_SPLIT_GATEWAY:-false}"
export CARINA_SUPERVISOR_HUB="${CARINA_SUPERVISOR_HUB:-false}"
export CARINA_SUPERVISOR_OPS="${CARINA_SUPERVISOR_OPS:-false}"

mkdir -p /app/data/logs /app/data/hub-packs "${CARINA_HOME}"

LEGACY_CARINA_HOME="/data/.carina"
if [ "${CARINA_HOME}" != "${LEGACY_CARINA_HOME}" ] && [ -d "${LEGACY_CARINA_HOME}" ]; then
  if [ ! -e "${CARINA_HOME}/.env" ] && [ -e "${LEGACY_CARINA_HOME}/.env" ]; then
    echo "[carina] Migrating CARINA_HOME from ${LEGACY_CARINA_HOME} to ${CARINA_HOME}"
    mkdir -p "${CARINA_HOME}"
    cp -a "${LEGACY_CARINA_HOME}/." "${CARINA_HOME}/"
  fi
fi

if [ "${CARINA_SKIP_CONTAINER_BOOTSTRAP:-}" != "true" ]; then
  node /app/dist/src/setup/container-bootstrap.js
fi

if id node >/dev/null 2>&1; then
  chown -R node:node /app/data "${CARINA_HOME}" 2>/dev/null || true
fi

if [ "$#" -eq 0 ]; then
  set -- /usr/bin/supervisord -c /app/docker/supervisor/supervisord.conf
fi

exec "$@"
