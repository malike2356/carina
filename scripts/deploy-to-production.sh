#!/usr/bin/env bash
#
# Deploy propreneur-v2: git pull locally → rsync to server (no .git on server) → remote artisan/composer.
#
# One-time setup:
#   cp scripts/deploy.env.example scripts/deploy.env
#   nano scripts/deploy.env
#   chmod +x scripts/deploy-to-production.sh scripts/deploy-remote.sh
#
# Usage (from repo root, or any directory):
#   ./scripts/deploy-to-production.sh
#   ./scripts/deploy-to-production.sh --dry-run
#   ./scripts/deploy-to-production.sh --build-assets
#   ./scripts/deploy-to-production.sh --skip-git-pull --skip-migrate
#   ./scripts/check-production-mirror.sh
#   ./scripts/sync-from-production.sh   # recovery: aman → local → git push
#
# Mirror policy: docs/GIT_PRODUCTION_MIRROR.md
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
DEPLOY_GIT_BRANCH="${DEPLOY_GIT_BRANCH:-main}"
DEPLOY_REMOTE_PHP="${DEPLOY_REMOTE_PHP:-/www/server/php/83/bin/php}"
# Prefer aaPanel/global wrapper; override in deploy.env if needed
DEPLOY_REMOTE_COMPOSER="${DEPLOY_REMOTE_COMPOSER:-/usr/local/bin/composer}"
DEPLOY_REMOTE_USER="${DEPLOY_REMOTE_USER:-www}"
DEPLOY_SUPERVISOR_HORIZON="${DEPLOY_SUPERVISOR_HORIZON:-propreneur-horizon}"
DEPLOY_SUPERVISOR_SCHEDULER="${DEPLOY_SUPERVISOR_SCHEDULER:-propreneur-scheduler}"
DEPLOY_BUILD_ON_SERVER="${DEPLOY_BUILD_ON_SERVER:-0}"

# shellcheck source=lib/deploy-git-check.sh
source "$SCRIPT_DIR/lib/deploy-git-check.sh"

DRY_RUN=0
SKIP_GIT_PULL=0
SKIP_GIT_CHECK=0
ALLOW_DIRTY=0
SKIP_COMPOSER=0
SKIP_MIGRATE=0
SKIP_NPM=0
SKIP_RAG=1
BUILD_ASSETS_LOCAL=0
OPTIMIZE=0
RESTART_SUPERVISOR=1
RSYNC_DELETE=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  echo ""
  echo "Options:"
  echo "  --dry-run           Show rsync command without copying"
  echo "  --skip-git-pull     Do not git pull locally"
  echo "  --skip-git-check    Do not require clean tree / push parity with origin"
  echo "  --allow-dirty       Deploy with uncommitted local changes (emergency)"
  echo "  --skip-composer     Skip composer on server"
  echo "  --skip-migrate      Skip migrate --force on server"
  echo "  --skip-npm          Skip npm build on server"
  echo "  --with-rag          Run rag:ingest-brain-knowledge + sync-masterbrain (off by default)"
  echo "  --build-assets      npm ci && npm run build locally before rsync"
  echo "  --optimize          config/route/view cache on server (default: clear only)"
  echo "  --no-restart        Do not supervisorctl restart horizon/scheduler"
  echo "  --rsync-delete      Delete remote files not present locally (careful)"
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-git-pull) SKIP_GIT_PULL=1 ;;
    --skip-git-check) SKIP_GIT_CHECK=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --skip-composer) SKIP_COMPOSER=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --skip-npm) SKIP_NPM=1 ;;
    --with-rag) SKIP_RAG=0 ;;
    --build-assets) BUILD_ASSETS_LOCAL=1 ;;
    --optimize) OPTIMIZE=1 ;;
    --no-restart) RESTART_SUPERVISOR=0 ;;
    --rsync-delete) RSYNC_DELETE=1 ;;
    -h|--help) usage ;;
    *)
      echo "Unknown option: $arg (use --help)" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

if [[ ! -f artisan ]]; then
  echo "ERROR: Run from propreneur-v2 repo (artisan missing)." >&2
  exit 1
fi

if ! deploy_git_check "$DEPLOY_GIT_BRANCH" "$ALLOW_DIRTY" "$SKIP_GIT_CHECK"; then
  exit 1
fi

if [[ "$SKIP_GIT_PULL" != "1" ]]; then
  if [[ -d .git ]]; then
    echo "==> git pull origin $DEPLOY_GIT_BRANCH"
    git pull origin "$DEPLOY_GIT_BRANCH"
    if ! deploy_git_check "$DEPLOY_GIT_BRANCH" "$ALLOW_DIRTY" "$SKIP_GIT_CHECK"; then
      exit 1
    fi
  else
    echo "WARN: No .git in $REPO_ROOT — skipping pull (rsync current tree only)." >&2
  fi
fi

if [[ "$BUILD_ASSETS_LOCAL" == "1" ]]; then
  echo "==> npm ci && npm run build (local)"
  npm ci
  npm run build
  DEPLOY_BUILD_ON_SERVER=0
  SKIP_NPM=1
fi

# -O: do not set dir mtimes (avoids hundreds of "failed to set times" on www-owned trees)
RSYNC_OPTS=(-rlzO --human-readable --no-perms --no-group --omit-dir-times)
if [[ "$RSYNC_DELETE" == "1" ]]; then
  RSYNC_OPTS+=(--delete)
fi

# Never overwrite production secrets or user data
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
  --exclude 'public/storage'
  --exclude '.claude'
  --exclude 'tests'
  --exclude 'brain/prompts'
  --exclude 'brain/reference'
)

echo "==> rsync → ${DEPLOY_SSH}:${DEPLOY_REMOTE_ROOT}/"

if [[ "$DRY_RUN" == "1" ]]; then
  rsync "${RSYNC_OPTS[@]}" --dry-run "${RSYNC_EXCLUDES[@]}" \
    "$REPO_ROOT/" "${DEPLOY_SSH}:${DEPLOY_REMOTE_ROOT}/"
  echo "Dry run complete (remote steps skipped)."
  exit 0
fi

RSYNC_EXIT=0
rsync "${RSYNC_OPTS[@]}" "${RSYNC_EXCLUDES[@]}" \
  "$REPO_ROOT/" "${DEPLOY_SSH}:${DEPLOY_REMOTE_ROOT}/" || RSYNC_EXIT=$?

if [[ "$RSYNC_EXIT" -ne 0 ]]; then
  echo "WARN: rsync exited with code ${RSYNC_EXIT} (often permission on www-owned files). Continuing post-deploy." >&2
  echo "      Remote composer install refreshes vendor; fix ownership with deploy-remote.sh." >&2
fi

echo "==> upload deploy-remote.sh and run post-deploy"
# Inline exports in the remote script — sshd often blocks AcceptEnv, so VAR=value ssh prefixes fail.
ssh "$DEPLOY_SSH" bash -s <<REMOTE
set -euo pipefail
export DEPLOY_REMOTE_ROOT='${DEPLOY_REMOTE_ROOT}'
export DEPLOY_REMOTE_PHP='${DEPLOY_REMOTE_PHP}'
export DEPLOY_REMOTE_COMPOSER='${DEPLOY_REMOTE_COMPOSER}'
export DEPLOY_REMOTE_USER='${DEPLOY_REMOTE_USER}'
export DEPLOY_SUPERVISOR_HORIZON='${DEPLOY_SUPERVISOR_HORIZON}'
export DEPLOY_SUPERVISOR_SCHEDULER='${DEPLOY_SUPERVISOR_SCHEDULER}'
export DEPLOY_BUILD_ON_SERVER='${DEPLOY_BUILD_ON_SERVER}'
export SKIP_COMPOSER='${SKIP_COMPOSER}'
export SKIP_MIGRATE='${SKIP_MIGRATE}'
export SKIP_NPM='${SKIP_NPM}'
export SKIP_RAG='${SKIP_RAG}'
export OPTIMIZE='${OPTIMIZE}'
export RESTART_SUPERVISOR='${RESTART_SUPERVISOR}'
bash "\${DEPLOY_REMOTE_ROOT}/scripts/deploy-remote.sh"
REMOTE

DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DEPLOYED_COMMIT="$(deploy_git_full_sha)"
DEPLOYED_BRANCH="$(deploy_git_branch)"
DEPLOYED_SHORT="$(deploy_git_short_sha)"

echo "==> write deploy manifest on server (commit ${DEPLOYED_SHORT})"
MANIFEST_JSON="$(cat <<EOF
{
  "commit": "${DEPLOYED_COMMIT}",
  "branch": "${DEPLOYED_BRANCH}",
  "deployed_at": "${DEPLOYED_AT}",
  "deployed_from": "$(hostname -s 2>/dev/null || echo unknown)",
  "remote_root": "${DEPLOY_REMOTE_ROOT}"
}
EOF
)"
printf '%s\n' "$MANIFEST_JSON" | ssh "$DEPLOY_SSH" "mkdir -p '${DEPLOY_REMOTE_ROOT}/storage/app' && cat > '${DEPLOY_REMOTE_ROOT}/storage/app/deploy-manifest.json'"

echo ""
echo "Deploy complete → https://propreneur.uk"
echo "Mirror check: ./scripts/check-production-mirror.sh"
echo "Optional checks on server:"
echo "  grep \"'queue'\" ${DEPLOY_REMOTE_ROOT}/config/horizon.php"
echo "  sudo supervisorctl status"
echo "  redis-cli LLEN queues:security"
