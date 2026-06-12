#!/usr/bin/env bash
# Publish carina-agent to npm (public). Requires: npm login or NPM_TOKEN.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="${ROOT}/core.carinaai.uk"

cd "${PKG}"

if [[ -n "${NPM_TOKEN:-}" ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > "${PKG}/.npmrc.publish"
  export NPM_CONFIG_USERCONFIG="${PKG}/.npmrc.publish"
fi

if ! npm whoami &>/dev/null; then
  echo "ERROR: Not logged in to npm. Run: npm login"
  echo "Or set NPM_TOKEN and export it before running this script."
  exit 1
fi

echo "Publishing as: $(npm whoami)"

echo "Building and testing carina-agent..."
pnpm build
pnpm test
pnpm test:smoke

echo "Publishing carina-agent@$(node -p "require('./package.json').version")..."
npm publish --access public

echo "Done. Verify: npm view carina-agent version"
