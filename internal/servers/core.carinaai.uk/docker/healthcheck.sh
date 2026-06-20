#!/bin/sh
# Docker health check for Carina.
# Probes the web gateway health endpoint on WEB_PORT (default 3000).

set -eu

PORT="${WEB_PORT:-${PORT:-3000}}"
API_URL="http://127.0.0.1:${PORT}/api/health"
URL="http://127.0.0.1:${PORT}/health"

if command -v curl >/dev/null 2>&1; then
  if curl -fsS "${URL}" >/dev/null 2>&1; then
    exit 0
  fi
  curl -fsS "${API_URL}" >/dev/null 2>&1
  exit $?
fi

if command -v wget >/dev/null 2>&1; then
  if wget -qO- "${URL}" >/dev/null 2>&1; then
    exit 0
  fi
  wget -qO- "${API_URL}" >/dev/null 2>&1
  exit $?
fi

echo "carina-healthcheck: need curl or wget" >&2
exit 1
