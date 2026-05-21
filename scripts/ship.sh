#!/usr/bin/env bash
# ship.sh — commit, push, deploy, verify in one command
# Usage: ./scripts/ship.sh "commit message" [--build-assets] [--skip-migrate] [--dry-run]
#
# Runs from repo root. Wraps:
#   git add -A && git commit -m "..." && git push origin main
#   ./scripts/deploy-to-production.sh [flags]
#   ./scripts/check-production-mirror.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: ./scripts/ship.sh \"commit message\" [--build-assets] [--skip-migrate] [--dry-run]"
  exit 1
fi

# Collect passthrough flags (everything after the message)
shift
DEPLOY_FLAGS=("$@")

echo "==> git add -A"
git add -A

if git diff --cached --quiet; then
  echo "    (nothing staged — skipping commit)"
else
  echo "==> git commit"
  git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
fi

echo "==> git push origin main"
git push origin main

echo "==> deploy-to-production.sh ${DEPLOY_FLAGS[*]:-}"
"$SCRIPT_DIR/deploy-to-production.sh" "${DEPLOY_FLAGS[@]+"${DEPLOY_FLAGS[@]}"}"

echo "==> check-production-mirror.sh"
"$SCRIPT_DIR/check-production-mirror.sh"

echo ""
echo "Ship complete."
