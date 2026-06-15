#!/usr/bin/env bash
# Publish @verlox/carina-core, @verlox/carina-web, @verlox/carina-scout, and carina-agent meta to npm.
# Requires: npm login or NPM_TOKEN.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE="${ROOT}/core.carinaai.uk"

if [[ -n "${NPM_TOKEN:-}" ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > "${CORE}/.npmrc.publish"
  export NPM_CONFIG_USERCONFIG="${CORE}/.npmrc.publish"
fi

if ! npm whoami &>/dev/null; then
  echo "ERROR: Not logged in to npm. Run: npm login"
  echo "Or set NPM_TOKEN and export it before running this script."
  exit 1
fi

echo "Publishing as: $(npm whoami)"

cd "${CORE}"

echo "Building and testing @verlox/carina-core..."
pnpm build
pnpm boundary-check
pnpm test
pnpm test:smoke
node scripts/prune-pack-dist.mjs

echo "Publishing workspace packages (workspace:* deps resolve to pinned versions)..."
pnpm --filter @verlox/carina-core publish --access public --no-git-checks
pnpm --filter @verlox/carina-web publish --access public --no-git-checks
pnpm --filter @verlox/carina-scout publish --access public --no-git-checks
pnpm --filter carina-agent publish --access public --no-git-checks

echo "Done. Verify:"
echo "  npm view @verlox/carina-core version"
echo "  npm view @verlox/carina-web version"
echo "  npm view carina-agent version"
