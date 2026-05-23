#!/usr/bin/env bash
# ship.sh — commit, push, deploy, verify in one command
# Usage: ./scripts/ship.sh "commit message" [--build-assets] [--skip-migrate] [--dry-run] [--build-mobile]
#
# Runs from repo root. Wraps:
#   git add -A && git commit -m "..." && git push origin main
#   ./scripts/deploy-to-production.sh [flags]
#   [--build-mobile] Build release APK and upload to production server
#   ./scripts/check-production-mirror.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "Usage: ./scripts/ship.sh \"commit message\" [--build-assets] [--skip-migrate] [--dry-run] [--build-mobile]"
  exit 1
fi

# Collect passthrough flags (everything after the message)
shift
DEPLOY_FLAGS=()
BUILD_MOBILE=0
for arg in "$@"; do
  case "$arg" in
    --build-mobile) BUILD_MOBILE=1 ;;
    *) DEPLOY_FLAGS+=("$arg") ;;
  esac
done

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

# --- Mobile APK build & deploy (optional, flag: --build-mobile) ---
if [[ "$BUILD_MOBILE" == "1" ]]; then
  echo ""
  echo "==> [MOBILE] Building release APK..."
  MOBILE_ROOT="/opt/lampp/htdocs/VERLOX/propreneur/propreneur-mobile/v2"
  # The mobile project lives under the /opt/lampp/htdocs git root (separate repo).
  MOBILE_GIT_ROOT="/opt/lampp/htdocs"

  if [[ ! -d "$MOBILE_ROOT" ]]; then
    echo "ERROR: Mobile app root not found at $MOBILE_ROOT" >&2
    exit 1
  fi

  # Load deploy env for SSH target (needed throughout this block)
  if [[ -f "$SCRIPT_DIR/deploy.env" ]]; then
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/deploy.env"
  fi
  DEPLOY_SSH="${DEPLOY_SSH:-malike@80.190.81.208}"
  APK_REMOTE_DIR="/www/wwwroot/propreneur-v2/public/downloads"
  APK_REMOTE_PATH="${APK_REMOTE_DIR}/propreneur-mobile.apk"

  # Read current version from app.json (expo.version key)
  CURRENT_VER=$(grep '"version"' "$MOBILE_ROOT/app.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
  if [[ -z "$CURRENT_VER" ]]; then
    echo "ERROR: Could not read version from $MOBILE_ROOT/app.json" >&2
    exit 1
  fi

  # Compute new patch version (1.0.0 → 1.0.1)
  MAJOR="${CURRENT_VER%%.*}"
  MINOR_PATCH="${CURRENT_VER#*.}"
  MINOR="${MINOR_PATCH%%.*}"
  PATCH="${MINOR_PATCH#*.}"
  NEW_VER="${MAJOR}.${MINOR}.$((PATCH + 1))"

  echo "    Version: $CURRENT_VER → $NEW_VER"

  # 1. Bump app.json BEFORE building so the APK contains the new version.
  sed -i "s/\"version\": \"$CURRENT_VER\"/\"version\": \"$NEW_VER\"/" "$MOBILE_ROOT/app.json"
  echo "    app.json updated to $NEW_VER"

  # 2. Build the release APK (picks up the bumped version from app.json).
  cd "$MOBILE_ROOT"
  bash "$MOBILE_ROOT/scripts/build-apk-release.sh"
  cd "$REPO_ROOT"

  APK_SRC="$MOBILE_ROOT/dist/propreneur-mobile-release.apk"
  if [[ ! -f "$APK_SRC" ]]; then
    echo "ERROR: APK not found at $APK_SRC after build" >&2
    exit 1
  fi

  # 3. Upload APK to production server.
  #    The file may be owned by the www user (written by a prior web process), so we
  #    remove it first (malike owns the directory and can unlink www-owned files in it),
  #    then scp a fresh copy as malike.
  echo "==> [MOBILE] Uploading APK to server..."
  ssh "$DEPLOY_SSH" "mkdir -p '$APK_REMOTE_DIR' && rm -f '$APK_REMOTE_PATH'"
  scp "$APK_SRC" "${DEPLOY_SSH}:${APK_REMOTE_PATH}"

  # 4. Update MOBILE_ANDROID_VERSION in server .env (and ensure APK path is set).
  echo "==> [MOBILE] Updating server .env ($NEW_VER, APK path)..."
  ssh "$DEPLOY_SSH" bash -s -- "$NEW_VER" "$APK_REMOTE_PATH" <<'REMOTE'
set -euo pipefail
NEW_VER="$1"
APK_PATH="$2"
ENV_FILE="/www/wwwroot/propreneur-v2/.env"
# Remove every existing occurrence of each var (handles duplicates).
sed -i '/^MOBILE_ANDROID_VERSION=/d' "$ENV_FILE"
sed -i '/^MOBILE_ANDROID_APK_PATH=/d' "$ENV_FILE"
echo "MOBILE_ANDROID_VERSION=$NEW_VER" >> "$ENV_FILE"
echo "MOBILE_ANDROID_APK_PATH=$APK_PATH" >> "$ENV_FILE"
echo "    Server .env: MOBILE_ANDROID_VERSION=$NEW_VER  MOBILE_ANDROID_APK_PATH=$APK_PATH"
REMOTE

  # 5. Clear Laravel config cache so the new version is visible immediately.
  ssh "$DEPLOY_SSH" "cd /www/wwwroot/propreneur-v2 && php artisan config:cache" \
    && echo "    Config cache cleared on server."

  # 6. Commit the version bump in the mobile git root (/opt/lampp/htdocs).
  #    app.json is tracked relative to that root, not the propreneur-v2 repo.
  echo "==> [MOBILE] Committing version bump ($NEW_VER) in mobile repo..."
  git -C "$MOBILE_GIT_ROOT" add "$MOBILE_ROOT/app.json"
  git -C "$MOBILE_GIT_ROOT" commit -m "Bump mobile app version to $NEW_VER

[skip ci]"

  echo ""
  echo "==> [MOBILE] APK deployed:"
  echo "    Local:  $APK_SRC"
  echo "    Remote: ${DEPLOY_SSH}:${APK_REMOTE_PATH}"
  echo "    Download: https://xelox.propreneur.uk/mobile/android"
  echo "    Version: $CURRENT_VER → $NEW_VER"
fi

# --- Post-deploy verification ---
echo ""
echo "==> check-production-mirror.sh"
"$SCRIPT_DIR/check-production-mirror.sh"

echo ""
echo "Ship complete."
