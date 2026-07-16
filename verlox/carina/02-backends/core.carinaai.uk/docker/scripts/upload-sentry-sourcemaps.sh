#!/usr/bin/env bash
# Upload core source maps to Sentry after build (optional; requires SENTRY_AUTH_TOKEN).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
ORG="${SENTRY_ORG:-verlox}"
PROJECT="${SENTRY_PROJECT_CORE:-carina-core}"

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "SENTRY_AUTH_TOKEN not set; skipping source map upload"
  exit 0
fi

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "dist/ missing; run pnpm build first"
  exit 1
fi

cd "${ROOT_DIR}"
npx --yes @sentry/cli sourcemaps upload "${DIST_DIR}" \
  --auth-token "${SENTRY_AUTH_TOKEN}" \
  --org "${ORG}" \
  --project "${PROJECT}"

echo "Source maps uploaded to Sentry project ${PROJECT}"
