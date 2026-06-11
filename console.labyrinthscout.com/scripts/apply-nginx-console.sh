#!/usr/bin/env bash
# Push nginx vhost for console.labyrinthscout.com and reload.
# Public: /, /account, /pricing, /api
# Protected: /dashboard only (operator Basic Auth)
# Run: bash scripts/apply-nginx-console.sh

set -euo pipefail

VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_CONF="${SCRIPT_DIR}/../nginx.console.conf"
REMOTE_CONF="/etc/nginx/conf.d/console.labyrinthscout.com.conf"

log() { echo "[apply-nginx] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[[ -f "$LOCAL_CONF" ]] || die "Missing ${LOCAL_CONF}"

render_conf() {
  awk '
    /^#/ { next }
    /listen 443 ssl;/ {
      print "    listen 80.190.81.208:443 ssl;"
      next
    }
    /include proxy_params.conf;/ {
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Upgrade $http_upgrade;"
      print "        proxy_set_header Connection upgrade;"
      print "        proxy_set_header Host $host;"
      print "        proxy_set_header X-Real-IP $remote_addr;"
      print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto $scheme;"
      print "        proxy_cache_bypass $http_upgrade;"
      print "        proxy_read_timeout 120s;"
      next
    }
    /ssl_certificate/ { next }
    { print }
  ' "$LOCAL_CONF"
}

log "Uploading ${REMOTE_CONF} to ${VPS_USER}@${VPS_HOST} (sudo password required)..."
render_conf | ssh -t "${VPS_USER}@${VPS_HOST}" bash << 'REMOTE'
  set -euo pipefail
  CONF="/etc/nginx/conf.d/console.labyrinthscout.com.conf"
  TMP="/home/malike/console.labyrinthscout.com.conf.new"
  cat > "$TMP"
  sudo cp "$TMP" "$CONF"
  rm -f "$TMP"
  sudo nginx -t
  sudo systemctl reload nginx
  echo "OK: nginx reloaded"
REMOTE

log "Smoke checks..."
curl -sS -m 10 -o /dev/null -w "home:%{http_code}\n" "https://console.labyrinthscout.com/" || true
curl -sS -m 10 -o /dev/null -w "account_login:%{http_code}\n" "https://console.labyrinthscout.com/account/login" || true
curl -sS -m 10 -o /dev/null -w "pricing:%{http_code}\n" "https://console.labyrinthscout.com/pricing" || true
curl -sS -m 10 -o /dev/null -w "dashboard:%{http_code}\n" "https://console.labyrinthscout.com/dashboard" || true
