#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ "${DRY_RUN:-}" == "1" ]]; then
  echo "DRY_RUN: would run npm test && npm publish --access public"
  exit 0
fi

npm test
npm run build
npm publish --access public
echo "Published $(node -p "require('./package.json').version")"
