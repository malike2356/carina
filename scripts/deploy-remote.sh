#!/usr/bin/env bash
#
# Post-rsync steps on the production server. Invoked via SSH from deploy-to-production.sh.
# Do not run standalone unless you know the app root is already up to date.
#
set -euo pipefail

# When run on the server directly (not via deploy-to-production.sh), default to cwd
if [[ -z "${DEPLOY_REMOTE_ROOT:-}" ]]; then
  if [[ -f artisan ]]; then
    DEPLOY_REMOTE_ROOT="$(pwd)"
  elif [[ -f "$(dirname "${BASH_SOURCE[0]}")/../artisan" ]]; then
    DEPLOY_REMOTE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  fi
fi

REMOTE_ROOT="${DEPLOY_REMOTE_ROOT:?DEPLOY_REMOTE_ROOT required (cd to app root or export DEPLOY_REMOTE_ROOT=/www/wwwroot/propreneur-v2)}"
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
  local artisan_path="$REMOTE_ROOT/artisan"
  if [[ "$(id -un)" == "$REMOTE_USER" ]]; then
    "$REMOTE_PHP" "$artisan_path" "$@"
    return
  fi

  if sudo -u "$REMOTE_USER" -H "$REMOTE_PHP" "$artisan_path" "$@" 2>/dev/null; then
    return
  fi

  echo "WARN: sudo -u ${REMOTE_USER} artisan $* failed (no passwordless sudo?). Retrying as $(id -un)..." >&2
  echo "      Add to /etc/sudoers.d/propreneur-deploy to avoid this:" >&2
  echo "      malike ALL=(${REMOTE_USER}) NOPASSWD: ${REMOTE_PHP} ${artisan_path} *" >&2
  "$REMOTE_PHP" "$artisan_path" "$@"
}

composer_argv() {
  local -a cmd=()
  if [[ -n "${REMOTE_COMPOSER:-}" && "${REMOTE_COMPOSER}" != "composer" ]]; then
    read -r -a cmd <<< "$REMOTE_COMPOSER"
  elif [[ -x /usr/local/bin/composer ]]; then
    cmd=(/usr/local/bin/composer)
  elif [[ -x /www/server/composer/composer ]]; then
    cmd=(/www/server/composer/composer)
  elif [[ -f /usr/local/bin/composer.phar ]]; then
    cmd=("$REMOTE_PHP" /usr/local/bin/composer.phar)
  else
    echo "ERROR: No composer found. Set DEPLOY_REMOTE_COMPOSER in deploy.env or install /usr/local/bin/composer on the server." >&2
    exit 1
  fi
  # If only a .phar path was configured, run it via PHP CLI
  if [[ ${#cmd[@]} -eq 1 && "${cmd[0]}" == *.phar ]]; then
    cmd=("$REMOTE_PHP" "${cmd[0]}")
  fi
  printf '%q ' "${cmd[@]}"
}

run_composer() {
  local composer_shell
  composer_shell="$(composer_argv)"
  echo "==> ${composer_shell}install --no-dev"
  if [[ "$(id -un)" == "$REMOTE_USER" ]]; then
    bash -lc "cd '$REMOTE_ROOT' && ${composer_shell}install --no-dev --optimize-autoloader --no-interaction"
    return
  fi

  if sudo -u "$REMOTE_USER" -H bash -lc "cd '$REMOTE_ROOT' && ${composer_shell}install --no-dev --optimize-autoloader --no-interaction"; then
    return
  fi

  echo "WARN: composer as ${REMOTE_USER} failed (vendor permissions?). Retrying as $(id -un)…" >&2
  bash -lc "cd '$REMOTE_ROOT' && ${composer_shell}install --no-dev --optimize-autoloader --no-interaction"
  ensure_runtime_ownership
}

ensure_runtime_ownership() {
  # Rsync as malike leaves vendor/public assets owned by malike; composer runs as www.
  local -a paths=(vendor storage bootstrap/cache public/js public/css)
  if ! command -v sudo >/dev/null 2>&1; then
    echo "WARN: sudo not available; skip ownership fix (filament:upgrade may fail)." >&2
    return 0
  fi
  echo "==> ensure ${REMOTE_USER} owns runtime + public asset dirs"
  sudo chown -R "$REMOTE_USER:$REMOTE_USER" "${paths[@]}" 2>/dev/null || {
    echo "WARN: chown failed (need sudo). On server run:" >&2
    echo "  sudo chown -R ${REMOTE_USER}:${REMOTE_USER} vendor storage bootstrap/cache public/js public/css" >&2
  }
  sudo chmod -R ug+rwX storage bootstrap/cache 2>/dev/null || true
}

echo "==> Remote deploy in $REMOTE_ROOT"

clear_bootstrap_package_cache() {
  echo "==> clear bootstrap package cache (avoid dev providers on production)"
  rm -f bootstrap/cache/packages.php bootstrap/cache/services.php bootstrap/cache/config.php 2>/dev/null || true
}

ensure_runtime_ownership
clear_bootstrap_package_cache

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

if [[ ! -L public/storage ]] || [[ "$(readlink public/storage)" != "$REMOTE_ROOT/storage/app/public" ]]; then
  echo "==> fix public/storage symlink"
  rm -f public/storage
  ln -s "$REMOTE_ROOT/storage/app/public" public/storage
fi

if [[ "$SKIP_MIGRATE" != "1" ]]; then
  echo "==> artisan migrate --force (central)"
  run_artisan migrate --force
  echo "==> artisan tenants:migrate --force"
  run_artisan tenants:migrate --force
fi

echo "==> clear caches"
run_artisan config:clear
run_artisan route:clear
run_artisan view:clear
run_artisan event:clear

echo "==> sync Carina RAG (knowledge + masterbrain)"
run_artisan rag:ingest-brain-knowledge || echo "WARN: rag:ingest-brain-knowledge failed (non-fatal)" >&2
run_artisan rag:sync-masterbrain || echo "WARN: rag:sync-masterbrain failed (non-fatal)" >&2

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

ensure_runtime_ownership

if [[ "$RESTART_SUPERVISOR" == "1" ]]; then
  echo "==> graceful horizon:terminate (signals all subscribers via Redis)"
  run_artisan horizon:terminate || echo "WARN: horizon:terminate non-zero exit (likely no master running)." >&2
  sleep 4

  echo "==> kill any stray (non-supervisord) artisan horizon processes"
  if command -v pgrep >/dev/null 2>&1; then
    STRAY_PIDS=$(pgrep -af 'artisan horizon$' 2>/dev/null | awk '{print $1}' || true)
    if [[ -n "$STRAY_PIDS" ]]; then
      echo "WARN: stray horizon master PIDs after terminate: $STRAY_PIDS — sending TERM" >&2
      sudo kill -TERM $STRAY_PIDS 2>/dev/null || true
      sleep 3
      STILL=$(pgrep -af 'artisan horizon$' 2>/dev/null | awk '{print $1}' || true)
      if [[ -n "$STILL" ]]; then
        echo "WARN: stray horizon survived TERM: $STILL — sending KILL" >&2
        sudo kill -KILL $STILL 2>/dev/null || true
      fi
    fi
  fi

  echo "==> supervisor restart ($SUP_HORIZON, $SUP_SCHEDULER)"
  if command -v supervisorctl >/dev/null 2>&1; then
    sudo supervisorctl restart "$SUP_HORIZON" "$SUP_SCHEDULER" || {
      echo "WARN: supervisorctl restart failed; try aaPanel Supervisor or check program names." >&2
    }
    echo "==> final horizon master count (expect 1):"
    pgrep -af 'artisan horizon$' 2>/dev/null | wc -l
  else
    echo "WARN: supervisorctl not found; restart Horizon manually." >&2
  fi
fi

echo "==> Remote deploy finished."
