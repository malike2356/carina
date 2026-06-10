#!/usr/bin/env bash
# deploy-carina.sh - Deploy core.carinaai.uk and ops.carinaai.uk to Contabo VPS
# Run from the carina repo root: bash scripts/deploy-carina.sh
# First deployment: bash scripts/deploy-carina.sh --init

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
CORE_REMOTE="/home/malike/apps/core.carinaai.uk"
OPS_REMOTE="/home/malike/apps/ops.carinaai.uk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_LOCAL="$REPO_ROOT/core.carinaai.uk"
OPS_LOCAL="$REPO_ROOT/ops.carinaai.uk"

log()  { echo "[$(date +%H:%M:%S)] $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check SSH key."
}

install_node_tools() {
  ssh "${VPS_USER}@${VPS_HOST}" bash << 'REMOTE'
    set -euo pipefail
    command -v npm &>/dev/null || { echo "npm not found - Node.js must be installed first"; exit 1; }
    echo "Node tools OK (node: $(node --version), npm: $(npm --version))"
REMOTE
}

deploy_app() {
  local label="$1"
  local local_dir="$2"
  local remote_dir="$3"
  local start_cmd="$4"
  local sup_name="$5"
  local extra_env="${6:-}"

  log "[$label] Syncing code..."
  rsync -az --delete \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='/data/' \
    "$local_dir/" "${VPS_USER}@${VPS_HOST}:${remote_dir}/"

  log "[$label] Building on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    cd "$remote_dir"

    echo "  Installing dependencies..."
    npm install --include=dev 2>&1 | tail -3

    echo "  Building TypeScript..."
    npm run build 2>&1 | tail -5

    echo "  Build complete."
REMOTE

  log "[$label] Setting up supervisor..."
  local sup_conf
  sup_conf="[program:${sup_name}]
command=/usr/bin/node ${remote_dir}/${start_cmd}
directory=${remote_dir}
autostart=true
autorestart=true
user=${VPS_USER}
stdout_logfile=/var/log/supervisor/${sup_name}.out.log
stderr_logfile=/var/log/supervisor/${sup_name}.err.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
stopwaitsecs=30
environment=NODE_ENV=\"production\"${extra_env}"

  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    CONF_PATH="/etc/supervisor/conf.d/${sup_name}.conf"
    CONF_CONTENT='${sup_conf}'

    mkdir -p /var/log/supervisor

    if sudo tee "\$CONF_PATH" > /dev/null << 'CONF'
${sup_conf}
CONF
    then
      echo "  Supervisor conf installed at \$CONF_PATH"
      sudo supervisorctl reread 2>/dev/null || true
      sudo supervisorctl update 2>/dev/null || true
      sudo supervisorctl restart "${sup_name}" 2>/dev/null || \
        sudo supervisorctl start "${sup_name}" 2>/dev/null || \
        echo "WARN: could not start ${sup_name} via supervisorctl"
    else
      echo ""
      echo "WARN: Could not write to /etc/supervisor/conf.d/ - create this file manually:"
      echo "--- /etc/supervisor/conf.d/${sup_name}.conf ---"
      cat << 'CONF'
${sup_conf}
CONF
      echo "--- end ---"
      echo "Then run: sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start ${sup_name}"
    fi
REMOTE

  log "[$label] Done."
}

print_nginx_hint() {
  local domain="$1"
  local port="$2"
  echo ""
  echo "--- aaPanel: Add site for $domain with this reverse proxy config ---"
  echo "In aaPanel > Websites > $domain > Reverse Proxy, set target: http://127.0.0.1:$port"
  echo "Then enable SSL via Let's Encrypt."
  echo ""
  echo "Or add this block to the nginx vhost for $domain:"
  cat << NGINX
location / {
    proxy_pass         http://127.0.0.1:${port};
    proxy_http_version 1.1;
    proxy_set_header   Upgrade \$http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host \$host;
    proxy_set_header   X-Real-IP \$remote_addr;
    proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
}
NGINX
}

main() {
  log "Carina production deploy starting..."
  check_ssh
  install_node_tools

  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p /home/malike/apps/core.carinaai.uk /home/malike/apps/ops.carinaai.uk"

  deploy_app "core.carinaai.uk" "$CORE_LOCAL" "$CORE_REMOTE" \
    "dist/src/index.js" "carina-core" \
    ",WEB_ENABLED=\"true\",SKIP_CLI=\"true\",HOSTED_MODE=\"false\",CARINA_OPERATOR_HOSTS=\"core.carinaai.uk\""

  deploy_app "ops.carinaai.uk" "$OPS_LOCAL" "$OPS_REMOTE" \
    "dist/server.js" "carina-ops" ""

  log "All apps deployed."

  echo ""
  echo "=== POST-DEPLOY CHECKLIST ==="
  echo ""
  echo "1. Set production .env on VPS:"
  echo "   scp ops.carinaai.uk/.env ${VPS_USER}@${VPS_HOST}:${OPS_REMOTE}/.env"
  echo "   scp core.carinaai.uk/.env ${VPS_USER}@${VPS_HOST}:${CORE_REMOTE}/.env"
  echo "   (Edit them on the VPS to use production DB/Redis/API keys, then restart)"
  echo "   ssh ${VPS_USER}@${VPS_HOST} 'sudo supervisorctl restart carina-core carina-ops'"
  echo ""
  echo "2. Create carina postgres DB (on VPS as postgres user):"
  echo "   CREATE USER carina WITH PASSWORD 'YOUR_PASSWORD';"
  echo "   CREATE DATABASE carina_central OWNER carina;"
  echo "   CREATE DATABASE carina_skills_hub OWNER carina;"
  echo ""
  print_nginx_hint "core.carinaai.uk" "3333"
  print_nginx_hint "ops.carinaai.uk" "4000"
}

main "$@"
