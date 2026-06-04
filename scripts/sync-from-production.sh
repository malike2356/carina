#!/usr/bin/env bash
#
# Pull application code FROM production (aman) back to this machine.
# Use when GitHub or local clone is lost/corrupt but the VPS still has a good tree.
#
# After sync: review diff, commit on a recovery branch, push to GitHub.
#
#   ./scripts/sync-from-production.sh --dry-run
#   ./scripts/sync-from-production.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$SCRIPT_DIR/deploy.env" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/deploy.env"
fi

DEPLOY_SSH="${DEPLOY_SSH:-malike@80.190.81.208}"
DEPLOY_REMOTE_ROOT="${DEPLOY_REMOTE_ROOT:-/www/wwwroot/propreneur-v2}"

DRY_RUN=0
CONFIRM=0

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  echo ""
  echo "Options:"
  echo "  --dry-run     Show rsync plan only"
  echo "  --yes         Skip interactive confirmation"
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes) CONFIRM=1 ;;
    -h|--help) usage ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

RSYNC_OPTS=(-rlzO --human-readable --no-perms --no-group --omit-dir-times)
RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude '.env'
  --exclude '.env.*'
  --exclude 'vendor'
  --exclude 'node_modules'
  --exclude 'storage/logs'
  --exclude 'storage/framework/cache/data'
  --exclude 'storage/framework/sessions'
  --exclude 'storage/framework/views'
  --exclude 'bootstrap/cache/packages.php'
  --exclude 'bootstrap/cache/services.php'
  --exclude 'bootstrap/cache/config.php'
  --exclude 'storage/app/public'
  --exclude 'storage/app/private'
)

echo "==> Sync FROM ${DEPLOY_SSH}:${DEPLOY_REMOTE_ROOT}/"
echo "    INTO ${REPO_ROOT}/"
echo ""
echo "    .env, vendor, and runtime storage are NOT copied (rebuild locally)."
echo ""

if [[ "$DRY_RUN" == "1" ]]; then
  rsync "${RSYNC_OPTS[@]}" --dry-run "${RSYNC_EXCLUDES[@]}" \
    "${DEPLOY_SSH}:${DEPLOY_REMOTE_ROOT}/" "$REPO_ROOT/"
  echo "Dry run complete."
  exit 0
fi

if [[ "$CONFIRM" != "1" ]]; then
  read -r -p "Overwrite local app files with production copy? [y/N] " answer
  if [[ "${answer,,}" != "y" && "${answer,,}" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

MANIFEST_REMOTE="${DEPLOY_REMOTE_ROOT}/storage/app/deploy-manifest.json"
echo "==> Production deploy manifest (if present):"
ssh "$DEPLOY_SSH" "cat '$MANIFEST_REMOTE' 2>/dev/null || echo '(no manifest - deploy after enabling manifest write)'"
echo ""

rsync "${RSYNC_OPTS[@]}" "${RSYNC_EXCLUDES[@]}" \
  "${DEPLOY_SSH}:${DEPLOY_REMOTE_ROOT}/" "$REPO_ROOT/"

echo ""
echo "Sync complete. Next steps:"
echo "  1. composer install && npm ci (if you use front-end build)"
echo "  2. git checkout -b recovery/from-production-\$(date +%Y%m%d)"
echo "  3. git add -A && git status   # review carefully"
echo "  4. git commit -m \"Recovery: sync application code from production\""
echo "  5. git push -u origin recovery/from-production-\$(date +%Y%m%d)"
echo "  6. Open PR to main when satisfied"
