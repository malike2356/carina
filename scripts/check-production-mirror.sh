#!/usr/bin/env bash
#
# Compare local Git HEAD with the commit recorded on production (deploy manifest).
#
#   ./scripts/check-production-mirror.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=lib/deploy-git-check.sh
source "$SCRIPT_DIR/lib/deploy-git-check.sh"

if [[ -f "$SCRIPT_DIR/deploy.env" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/deploy.env"
fi

DEPLOY_SSH="${DEPLOY_SSH:-malike@80.190.81.208}"
DEPLOY_REMOTE_ROOT="${DEPLOY_REMOTE_ROOT:-/www/wwwroot/propreneur-v2}"
MANIFEST_PATH="${DEPLOY_REMOTE_ROOT}/storage/app/deploy-manifest.json"

cd "$REPO_ROOT"

echo "==> Local Git"
if [[ -d .git ]]; then
  echo "    branch: $(deploy_git_branch)"
  echo "    commit: $(deploy_git_full_sha) ($(deploy_git_short_sha))"
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "    status: DIRTY (uncommitted changes)"
  else
    echo "    status: clean"
  fi
else
  echo "    (no .git directory)"
fi

echo ""
echo "==> Production manifest (${DEPLOY_SSH})"
REMOTE_JSON="$(ssh "$DEPLOY_SSH" "cat '$MANIFEST_PATH' 2>/dev/null" || true)"
if [[ -z "$REMOTE_JSON" ]]; then
  echo "    (missing — run ./scripts/deploy-to-production.sh once to write it)"
  exit 0
fi

echo "$REMOTE_JSON" | sed 's/^/    /'

if [[ ! -d .git ]]; then
  exit 0
fi

REMOTE_SHA="$(echo "$REMOTE_JSON" | sed -n 's/.*"commit"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
LOCAL_SHA="$(deploy_git_full_sha)"

echo ""
if [[ "$REMOTE_SHA" == "$LOCAL_SHA" ]]; then
  echo "==> Mirror status: IN SYNC (local HEAD == production deploy commit)"
  exit 0
fi

echo "==> Mirror status: OUT OF SYNC"
echo "    Local:      $LOCAL_SHA"
echo "    Production: $REMOTE_SHA"
echo "    Fix: git push/pull as needed, then ./scripts/deploy-to-production.sh"
exit 1
