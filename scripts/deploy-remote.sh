#!/usr/bin/env bash
#
# Post-rsync steps on the production server. Invoked via SSH from deploy-to-production.sh.
# Do not run standalone unless you know the app root is already up to date.
#
set -euo pipefail

REMOTE_ROOT="${DEPLOY_REMOTE_ROOT:?DEPLOY_REMOTE_ROOT required}"
REMOTE_PHP="${DEPLOY_REMOTE_PHP:-php}"
REMOTE_COMPOSER="${DEPLOY_REMOTE_COMPOSER:-composer}"
REMOTE_USER="${DEPLOY_REMOTE_USER:-www}"
SUP_HORIZON="${DEPLOY_SUPERVISOR_HORIZON:-propreneur-horizon}"
SUP_SCHEDULER="${DEPLOY_SUPERVISOR_SCHEDULER:-propreneur-scheduler}"

SKIP_COMPOSER="${SKIP_COMPOSER:-0}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"
SKIP_NPM="${SKIP_NPM:-0}"
OPTIMIZE="${OPTIMIZE:-0}"
RESTART_SUPERVISOR="${RESTART_SUPERVISOR:-1}"
BUILD_ON_SERVER="${DEPLOY_BUILD_ON_SERVER:-0}"

cd "$REMOTE_ROOT"

if [[ ! -f artisan ]]; then
  echo "ERROR: artisan not found in $REMOTE_ROOT" >&2
  exit 1
fi

run_artisan() {
  if [[ "$(id -un)" == "$REMOTE_USER" ]]; then
    "$REMOTE_PHP" artisan "$@"
  else
    sudo -u "$REMOTE_USER" -H "$REMOTE_PHP" artisan "$@"
  fi
}

run_composer() {
  # shellcheck disable=SC2086
  if [[ "$(id -un)" == "$REMOTE_USER" ]]; then
    $REMOTE_COMPOSER install --no-dev --optimize-autoloader --no-interaction
  else
    # shellcheck disable=SC2086
    sudo -u "$REMOTE_USER" -H $REMOTE_COMPOSER install --no-dev --optimize-autoloader --no-interaction
  fi
}

echo "==> Remote deploy in $REMOTE_ROOT"

if [[ "$SKIP_COMPOSER" != "1" ]]; then
  echo "==> composer install --no-dev"
  run_composer
fi

if [[ "$SKIP_NPM" != "1" && "$BUILD_ON_SERVER" == "1" ]]; then
  echo "==> npm ci && npm run build"
  if [[ "$(id -un)" == "$REMOTE_USER" ]]; then
    npm ci
    npm run build
  else
    sudo -u "$REMOTE_USER" -H bash -lc "cd '$REMOTE_ROOT' && npm ci && npm run build"
  fi
fi

mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache

if [[ "$SKIP_MIGRATE" != "1" ]]; then
  echo "==> artisan migrate --force"
  run_artisan migrate --force
fi

echo "==> clear caches"
run_artisan config:clear
run_artisan route:clear
run_artisan view:clear
run_artisan event:clear

if [[ "$OPTIMIZE" == "1" ]]; then
  echo "==> optimize (config/route/view cache)"
  run_artisan config:cache
  run_artisan route:cache
  run_artisan view:cache
  run_artisan event:cache
fi

if [[ -w storage ]] || sudo -u "$REMOTE_USER" test -w storage 2>/dev/null; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) deploy-remote" >> storage/deploy.txt
fi

if [[ "$(id -un)" == "root" ]] || sudo -n true 2>/dev/null; then
  echo "==> ensure storage/bootstrap owned by $REMOTE_USER"
  sudo chown -R "$REMOTE_USER:$REMOTE_USER" storage bootstrap/cache 2>/dev/null || true
  sudo chmod -R ug+rwX storage bootstrap/cache 2>/dev/null || true
fi

if [[ "$RESTART_SUPERVISOR" == "1" ]]; then
  echo "==> supervisor restart ($SUP_HORIZON, $SUP_SCHEDULER)"
  if command -v supervisorctl >/dev/null 2>&1; then
    sudo supervisorctl restart "$SUP_HORIZON" "$SUP_SCHEDULER" || {
      echo "WARN: supervisorctl restart failed; try aaPanel Supervisor or check program names." >&2
    }
  else
    echo "WARN: supervisorctl not found; restart Horizon manually." >&2
  fi
fi

echo "==> Remote deploy finished."
