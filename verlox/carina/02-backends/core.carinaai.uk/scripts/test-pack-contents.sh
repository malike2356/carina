#!/usr/bin/env bash
# Verify @verlox/carina-core npm tarball excludes domain pack sources.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "${ROOT}"
pnpm build >/dev/null
node scripts/prune-pack-dist.mjs >/dev/null

TGZ_NAME="$(npm pack --pack-destination "${WORK}" 2>/dev/null | tail -1)"
TGZ_PATH="${WORK}/${TGZ_NAME}"

if tar tzf "${TGZ_PATH}" | grep -q 'skills/packs/'; then
  echo "FAIL: tarball still contains skills/packs/"
  tar tzf "${TGZ_PATH}" | grep 'skills/packs/' | head -5
  exit 1
fi

echo "test:pack-contents ok (${TGZ_NAME} has no skills/packs/)"
