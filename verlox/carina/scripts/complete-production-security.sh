#!/usr/bin/env bash
# complete-production-security.sh - Apply safe production security env defaults
# Usage:
#   SCOUT_ALERT_TO_EMAIL=ops@yourdomain.com bash scripts/complete-production-security.sh vps
#   RESEND_WEBHOOK_SECRET=whsec_... bash scripts/complete-production-security.sh vps
#
# Never commits secrets. Only updates .env on the target host.

set -euo pipefail

TARGET="${1:-vps}"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
SCOUT_REMOTE="/home/malike/apps/console.labyrinthscout.com"
CORE_REMOTE="/home/malike/apps/core.carinaai.uk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SCOUT_LOCAL="${REPO_ROOT}/internal/servers/console.labyrinthscout.com"
CORE_LOCAL="${REPO_ROOT}/internal/servers/core.carinaai.uk"

log() { echo "[complete-security] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

ensure_kv() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    local current
    current="$(grep -m1 "^${key}=" "$file" | cut -d= -f2-)"
    if [[ -n "$current" && "$current" != change_me* && "$current" != "change-me-in-production" ]]; then
      log "  keep  ${key} (already set)"
      return
    fi
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    log "  set   ${key}"
  else
    echo "${key}=${value}" >> "$file"
    log "  add   ${key}"
  fi
}

copy_non_empty() {
  local from="$1"
  local to="$2"
  local key="$3"
  local src
  src="$(grep -m1 "^${key}=" "$from" 2>/dev/null | cut -d= -f2- || true)"
  if [[ -z "$src" ]]; then
    log "  skip  ${key} (source empty in ${from})"
    return
  fi
  ensure_kv "$to" "$key" "$src"
}

apply_on_host() {
  local scout_dir="$1"
  local core_dir="$2"

  log "Applying production security defaults..."
  [[ -f "${scout_dir}/.env" ]] || die "Missing ${scout_dir}/.env"
  [[ -f "${core_dir}/.env" ]] || die "Missing ${core_dir}/.env"

  ensure_kv "${scout_dir}/.env" "SCOUT_CORS_ORIGIN" "https://console.labyrinthscout.com,https://carinaai.uk,https://labyrinthscout.com"
  ensure_kv "${core_dir}/.env" "CORS_ORIGIN" "https://core.carinaai.uk"
  ensure_kv "${scout_dir}/.env" "SCOUT_ALERT_FROM_EMAIL" "hello@carinaai.uk"
  ensure_kv "${scout_dir}/.env" "ALERT_EMAIL_FROM" "hello@carinaai.uk"

  copy_non_empty "${core_dir}/.env" "${scout_dir}/.env" "RESEND_API_KEY"
  local resend_val
  resend_val="$(grep -m1 "^RESEND_API_KEY=" "${scout_dir}/.env" 2>/dev/null | cut -d= -f2- || true)"
  if [[ -n "$resend_val" ]]; then
    ensure_kv "${scout_dir}/.env" "SCOUT_RESEND_API_KEY" "${resend_val}"
  fi

  if [[ -n "${SCOUT_ALERT_TO_EMAIL:-}" ]]; then
    ensure_kv "${scout_dir}/.env" "SCOUT_ALERT_TO_EMAIL" "${SCOUT_ALERT_TO_EMAIL}"
    ensure_kv "${scout_dir}/.env" "ALERT_EMAIL_TO" "${SCOUT_ALERT_TO_EMAIL}"
  else
    log "  note  Set SCOUT_ALERT_TO_EMAIL=you@domain.com to enable email alerts"
  fi

  if [[ -n "${RESEND_WEBHOOK_SECRET:-}" ]]; then
    ensure_kv "${core_dir}/.env" "RESEND_WEBHOOK_SECRET" "${RESEND_WEBHOOK_SECRET}"
  else
    log "  note  Set RESEND_WEBHOOK_SECRET=whsec_... (from Resend dashboard) for inbound email verification"
  fi

  if [[ "${LABYRINTH_ENABLED:-}" == "true" ]]; then
    ensure_kv "${core_dir}/.env" "LABYRINTH_ENABLED" "true"
  fi

  chmod 600 "${scout_dir}/.env" "${core_dir}/.env" 2>/dev/null || true
  log "Done. Restart services and run verify script."
}

run_local() {
  apply_on_host "$SCOUT_LOCAL" "$CORE_LOCAL"
}

run_vps() {
  local remote_script="/tmp/carina-complete-security-$$.sh"
  scp -q "${SCRIPT_DIR}/complete-production-security.sh" "${VPS_USER}@${VPS_HOST}:${remote_script}"
  ssh "${VPS_USER}@${VPS_HOST}" \
    "SCOUT_ALERT_TO_EMAIL='${SCOUT_ALERT_TO_EMAIL:-}' RESEND_WEBHOOK_SECRET='${RESEND_WEBHOOK_SECRET:-}' bash ${remote_script} _apply_vps ${SCOUT_REMOTE} ${CORE_REMOTE}"
  ssh "${VPS_USER}@${VPS_HOST}" 'rm -f /tmp/carina-complete-security-*.sh; sudo supervisorctl restart labyrinth-scout carina-core 2>/dev/null || true'
}

if [[ "${1:-}" == "_apply_vps" ]]; then
  SCOUT_REMOTE="${2:?}"
  CORE_REMOTE="${3:?}"
  apply_on_host "$SCOUT_REMOTE" "$CORE_REMOTE"
  exit 0
fi

case "$TARGET" in
  local) run_local ;;
  vps)   run_vps ;;
  *)     die "Usage: bash scripts/complete-production-security.sh [local|vps]" ;;
esac

log "Next: bash scripts/verify-security-config.sh ${TARGET}"
log "Next: bash scripts/post-deploy-security-check.sh ${TARGET}"
