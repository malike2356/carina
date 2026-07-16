#!/usr/bin/env bash
# Apply Google OAuth Client ID/Secret to Aiva app + carina-web, then recreate containers.
#
# Preferred: Ops panel → Fleet → Google OAuth → Save and apply.
# This script is the CLI fallback when Ops is unreachable.
#
# Usage (on the VPS, from any cwd):
#   export GOOGLE_CLIENT_ID='....apps.googleusercontent.com'
#   export GOOGLE_CLIENT_SECRET='GOCSPX-...'
#   bash /home/malike/apps/core.carinaai.uk/docker/scripts/apply-google-oauth-credentials.sh
#
# Or:
#   bash apply-google-oauth-credentials.sh --id '...' --secret '...'
#
# After Google Cloud Console is ready, register ALL of these redirect URIs on the Web client:
#   https://app.carinaai.uk/api/auth/callback/google
#   https://admin.hireaiva.co.uk/api/auth/callback/google
#   https://app.carinaai.uk/api/aiva/tools/oauth/google/callback
#   https://app.carinaai.uk/api/aiva/email/oauth/gmail/callback
# Keep the OAuth consent screen in Testing; add the charity org Gmail as a test user.

set -euo pipefail

CORE_DIR="${CORE_DIR:-/home/malike/apps/core.carinaai.uk}"
APP_DIR="${APP_DIR:-/home/malike/apps/app.carinaai.uk}"
CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
RECREATE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) CLIENT_ID="${2:-}"; shift 2 ;;
    --secret) CLIENT_SECRET="${2:-}"; shift 2 ;;
    --no-recreate) RECREATE=0; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${CLIENT_ID}" || -z "${CLIENT_SECRET}" ]]; then
  echo "ERROR: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or pass --id / --secret)." >&2
  exit 1
fi

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  mkdir -p "$(dirname "$file")"
  if [[ ! -f "$file" ]]; then
    printf '%s=%s\n' "$key" "$value" >"$file"
    echo "created $file ($key)"
    return
  fi
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$file"; then
    # Replace existing key (including empty values)
    awk -v k="$key" -v v="$value" '
      BEGIN { done=0 }
      index($0, k "=") == 1 && !done { print k "=" v; done=1; next }
      { print }
      END { if (!done) print k "=" v }
    ' "$file" >"$tmp"
  else
    cat "$file" >"$tmp"
    printf '\n%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  cp "$file" "${file}.bak.google-oauth.$(date +%Y%m%d%H%M%S)"
  mv "$tmp" "$file"
  echo "updated $file ($key)"
}

ensure_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  if [[ ! -f "$file" ]]; then
    return
  fi
  if grep -qE "^${key}=" "$file"; then
    # Keep existing non-empty; fill if empty
    local cur
    cur="$(grep -E "^${key}=" "$file" | head -1 | cut -d= -f2-)"
    if [[ -z "${cur}" ]]; then
      upsert_env "$file" "$key" "$value"
    fi
  else
    upsert_env "$file" "$key" "$value"
  fi
}

echo "=== Applying Google OAuth credentials ==="

# App (Better Auth Continue with Google)
upsert_env "${APP_DIR}/.env" GOOGLE_CLIENT_ID "$CLIENT_ID"
upsert_env "${APP_DIR}/.env" GOOGLE_CLIENT_SECRET "$CLIENT_SECRET"

# Cloud docker runtime (carina-cloud image env_file)
upsert_env "${CORE_DIR}/.env.cloud.runtime" GOOGLE_CLIENT_ID "$CLIENT_ID"
upsert_env "${CORE_DIR}/.env.cloud.runtime" GOOGLE_CLIENT_SECRET "$CLIENT_SECRET"

# Core docker runtime (carina-web: Drive tools + Gmail OAuth)
upsert_env "${CORE_DIR}/.env.docker.runtime" GOOGLE_CLIENT_ID "$CLIENT_ID"
upsert_env "${CORE_DIR}/.env.docker.runtime" GOOGLE_CLIENT_SECRET "$CLIENT_SECRET"
upsert_env "${CORE_DIR}/.env.docker.runtime" GOOGLE_OAUTH_CLIENT_ID "$CLIENT_ID"
upsert_env "${CORE_DIR}/.env.docker.runtime" GOOGLE_OAUTH_CLIENT_SECRET "$CLIENT_SECRET"
ensure_key "${CORE_DIR}/.env.docker.runtime" AIVA_APP_URL "https://app.carinaai.uk"
ensure_key "${CORE_DIR}/.env.docker.runtime" AIVA_GOOGLE_TOOLS_OAUTH_REDIRECT_URI \
  "https://app.carinaai.uk/api/aiva/tools/oauth/google/callback"

# Optional secrets overlay used by start.sh
if [[ -f /home/malike/secrets/app.carinaai.uk.env ]]; then
  upsert_env /home/malike/secrets/app.carinaai.uk.env GOOGLE_CLIENT_ID "$CLIENT_ID"
  upsert_env /home/malike/secrets/app.carinaai.uk.env GOOGLE_CLIENT_SECRET "$CLIENT_SECRET"
fi

echo "Credential lengths: id=${#CLIENT_ID} secret=${#CLIENT_SECRET}"

if [[ "$RECREATE" != "1" ]]; then
  echo "Skipping container recreate (--no-recreate)."
  exit 0
fi

if [[ ! -d "$CORE_DIR" ]]; then
  echo "CORE_DIR missing ($CORE_DIR); credentials written where possible."
  exit 0
fi

cd "$CORE_DIR"
echo "=== Recreating carina-web (Drive / tools OAuth) ==="
docker compose -f docker-compose.prod.yml -f docker-compose.deploy.yml up -d --force-recreate --no-deps carina-web

echo "=== Recreating carina-cloud (Continue with Google) ==="
# Prefer rebuild if Dockerfile.runtime context is wired; force-recreate picks up env_file either way.
export CARINA_CLOUD_CONTEXT="${APP_DIR}"
docker compose -f docker-compose.prod.yml -f docker-compose.deploy.yml up -d --force-recreate --no-deps carina-cloud

echo "=== Verify (values redacted) ==="
docker exec corecarinaaiuk-carina-web-1 sh -c \
  'env | grep -E "^GOOGLE_CLIENT_ID=|^GOOGLE_CLIENT_SECRET=|^AIVA_APP_URL=" | sed "s/=.\\+/=set/"'
docker exec corecarinaaiuk-carina-cloud-1 sh -c \
  'env | grep -E "^GOOGLE_CLIENT_ID=|^GOOGLE_CLIENT_SECRET=" | sed "s/=.\\+/=set/"'

echo "Done."
echo "Smoke checks:"
echo "  1. https://app.carinaai.uk/login  → Continue with Google visible"
echo "  2. Worker → Tools → Google Drive → Connect with Google redirects to accounts.google.com"
echo "  3. Consent screen Testing: add the org Gmail as a test user"
