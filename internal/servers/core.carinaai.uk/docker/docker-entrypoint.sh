#!/bin/sh
set -eu

export CARINA_HOME="${CARINA_HOME:-/data/.carina}"
export CARINA_LOCALES_DIR="${CARINA_LOCALES_DIR:-/app/locales}"

if [ "${CARINA_SKIP_CONTAINER_BOOTSTRAP:-}" != "true" ]; then
  node /app/dist/src/setup/container-bootstrap.js
fi

exec "$@"
