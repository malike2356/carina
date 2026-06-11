#!/usr/bin/env bash
# rotate-scout-secrets.sh - Generate new Scout API/session secrets (operator-run rotation)
# Usage:
#   bash scripts/rotate-scout-secrets.sh vps
# Then update Carina LABYRINTH_API_KEY to match, restart both sides, and re-run doctor.

set -euo pipefail

TARGET="${1:-vps}"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
SCOUT_REMOTE="/home/malike/apps/console.labyrinthscout.com"
CORE_REMOTE="/home/malike/apps/core.carinaai.uk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0}")" && pwd)"
SCOUT_LOCAL="$(dirname "$SCRIPT_DIR")/console.labyrinthscout.com"

NEW_API_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
NEW_SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

log() { echo "[rotate-scout] $*"; }

apply_rotation() {
  local scout_env="$1"
  local core_env="$2"
  cp "${scout_env}" "${scout_env}.bak-${STAMP}"
  cp "${core_env}" "${core_env}.bak-${STAMP}"
  sed -i "s|^SCOUT_API_KEY=.*|SCOUT_API_KEY=${NEW_API_KEY}|" "${scout_env}"
  sed -i "s|^SCOUT_SESSION_SECRET=.*|SCOUT_SESSION_SECRET=${NEW_SESSION_SECRET}|" "${scout_env}"
  sed -i "s|^LABYRINTH_API_KEY=.*|LABYRINTH_API_KEY=${NEW_API_KEY}|" "${core_env}"
  chmod 600 "${scout_env}" "${core_env}"
}

log "Generated new secrets (stored in .env only, not printed here)."
log "Backups: .env.bak-${STAMP}"

case "$TARGET" in
  local)
    apply_rotation "${SCOUT_LOCAL}/.env" "$(dirname "$SCRIPT_DIR")/core.carinaai.uk/.env"
    ;;
  vps)
    ssh "${VPS_USER}@${VPS_HOST}" bash -s <<REMOTE
set -euo pipefail
NEW_API_KEY='${NEW_API_KEY}'
NEW_SESSION_SECRET='${NEW_SESSION_SECRET}'
STAMP='${STAMP}'
SCOUT_ENV='${SCOUT_REMOTE}/.env'
CORE_ENV='${CORE_REMOTE}/.env'
cp "\$SCOUT_ENV" "\$SCOUT_ENV.bak-\$STAMP"
cp "\$CORE_ENV" "\$CORE_ENV.bak-\$STAMP"
sed -i "s|^SCOUT_API_KEY=.*|SCOUT_API_KEY=\$NEW_API_KEY|" "\$SCOUT_ENV"
sed -i "s|^SCOUT_SESSION_SECRET=.*|SCOUT_SESSION_SECRET=\$NEW_SESSION_SECRET|" "\$SCOUT_ENV"
sed -i "s|^LABYRINTH_API_KEY=.*|LABYRINTH_API_KEY=\$NEW_API_KEY|" "\$CORE_ENV"
chmod 600 "\$SCOUT_ENV" "\$CORE_ENV"
sudo supervisorctl restart labyrinth-scout carina-core 2>/dev/null || true
REMOTE
    ;;
  *)
    echo "Usage: bash scripts/rotate-scout-secrets.sh [local|vps]" >&2
    exit 1
    ;;
esac

log "Rotation applied. Run: bash scripts/post-deploy-security-check.sh ${TARGET}"
log "Record rotation in instructions/operator-trust-log.md (date, operator, reason)."
