#!/usr/bin/env bash
# deploy-carina.sh - Deploy core.carinaai.uk and ops.carinaai.uk to Contabo VPS
# Run from the carina repo root: bash scripts/deploy-carina.sh
# First deployment: bash scripts/deploy-carina.sh --init

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
CORE_REMOTE="/home/malike/apps/core.carinaai.uk"
OPS_REMOTE="/home/malike/apps/ops.carinaai.uk"
NVM_NODE="/home/malike/.nvm/versions/node/v22.23.0/bin/node"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_LOCAL="${REPO_ROOT}/internal/servers/core.carinaai.uk"
OPS_LOCAL="${REPO_ROOT}/internal/admin/ops.carinaai.uk"

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
  local runner="$NVM_NODE"

  if [[ "$start_cmd" == *.sh ]]; then
    runner="/bin/bash"
  fi

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

    # Load nvm so the pnpm-compatible Node.js 22 is on PATH
    export NVM_DIR="\$HOME/.nvm"
    [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
    # CI=true lets pnpm purge stale node_modules without a TTY prompt
    export CI=true

    cd "$remote_dir"

    echo "  Node: \$(node --version), pnpm: \$(corepack pnpm --version 2>/dev/null || echo n/a)"
    echo "  Clearing stale build output..."
    rm -rf dist

    if [[ -f pnpm-lock.yaml ]]; then
      echo "  Installing dependencies with pnpm..."
      corepack pnpm install --frozen-lockfile 2>&1 | tail -5

      echo "  Building TypeScript..."
      corepack pnpm build 2>&1 | tail -5
    else
      echo "  Installing dependencies..."
      npm install --include=dev 2>&1 | tail -3

      echo "  Building TypeScript..."
      npm run build 2>&1 | tail -5
    fi

    echo "  Build complete."
    chmod +x start.sh 2>/dev/null || true
    pkill -f '/usr/bin/node dist/src/index.js' 2>/dev/null || true
REMOTE

  log "[$label] Setting up supervisor..."
  local sup_conf
  sup_conf="[program:${sup_name}]
command=${runner} ${remote_dir}/${start_cmd}
directory=${remote_dir}
autostart=true
autorestart=true
user=${VPS_USER}
stdout_logfile=/home/${VPS_USER}/logs/${sup_name}.out.log
stderr_logfile=/home/${VPS_USER}/logs/${sup_name}.err.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
stopwaitsecs=30
environment=NODE_ENV=\"production\"${extra_env}"

  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    export NVM_DIR="\$HOME/.nvm"
    [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"

    set -euo pipefail
    CONF_PATH="/etc/supervisor/conf.d/${sup_name}.conf"

    mkdir -p /home/${VPS_USER}/logs

    if sudo -n tee "\$CONF_PATH" > /dev/null << 'CONF'
${sup_conf}
CONF
    then
      echo "  Supervisor conf installed at \$CONF_PATH"
      sudo -n supervisorctl reread 2>/dev/null || true
      sudo -n supervisorctl update 2>/dev/null || true
      sudo -n supervisorctl restart "${sup_name}" 2>/dev/null || \
        sudo -n supervisorctl start "${sup_name}" 2>/dev/null || \
        echo "WARN: supervisorctl unavailable (no passwordless sudo) - using pkill restart"
    else
      echo "WARN: No passwordless sudo for supervisorctl - printing conf for manual install:"
      echo "--- /etc/supervisor/conf.d/${sup_name}.conf ---"
      cat << 'CONF'
${sup_conf}
CONF
      echo "---"
    fi

    # Always attempt a direct process restart regardless of supervisorctl outcome
    echo "  Restarting ${sup_name} process directly..."
    pkill -f "${remote_dir}/dist/server.js" 2>/dev/null || true
    pkill -f "${remote_dir}/start.sh" 2>/dev/null || true
    pkill -f "${remote_dir}/dist/src/index.js" 2>/dev/null || true
    sleep 2
    nohup ${runner} ${remote_dir}/${start_cmd} >> /home/${VPS_USER}/logs/${sup_name}.out.log 2>> /home/${VPS_USER}/logs/${sup_name}.err.log &
    echo "  Process restarted (PID \$!)"
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
    "start.sh" "carina-core" \
    ",WEB_ENABLED=\"true\",SKIP_CLI=\"true\",HOSTED_MODE=\"false\",CARINA_OPERATOR_HOSTS=\"core.carinaai.uk\""

  deploy_app "ops.carinaai.uk" "$OPS_LOCAL" "$OPS_REMOTE" \
    "dist/server.js" "carina-ops" \
    ",PORT=\"4002\""

  log "All apps deployed."

  if [[ -x "${SCRIPT_DIR}/post-deploy-security-check.sh" ]]; then
    log "Running post-deploy security checks..."
    bash "${SCRIPT_DIR}/post-deploy-security-check.sh" vps || \
      log "WARN: post-deploy security checks failed; see scripts/verify-security-config.sh"
  fi

  echo ""
  echo "=== POST-DEPLOY CHECKLIST ==="
  echo ""
  echo "1. Set production .env on VPS:"
  echo "   scp internal/admin/ops.carinaai.uk/.env ${VPS_USER}@${VPS_HOST}:${OPS_REMOTE}/.env"
  echo "   scp internal/servers/core.carinaai.uk/.env ${VPS_USER}@${VPS_HOST}:${CORE_REMOTE}/.env"
  echo "   (Edit them on the VPS to use production DB/Redis/API keys, then restart)"
  echo "   ssh ${VPS_USER}@${VPS_HOST} 'sudo supervisorctl restart carina-core carina-ops'"
  echo ""
  echo "2. Create carina postgres DB (on VPS as postgres user):"
  echo "   CREATE USER carina WITH PASSWORD 'YOUR_PASSWORD';"
  echo "   CREATE DATABASE carina_central OWNER carina;"
  echo "   CREATE DATABASE carina_skills_hub OWNER carina;"
  echo ""
  print_nginx_hint "core.carinaai.uk" "3333"
  print_nginx_hint "ops.carinaai.uk" "4002"
  echo ""
  echo "3. Carina Hub (hub.carinaai.uk):"
  echo "   DNS: A/AAAA hub.carinaai.uk -> VPS (same IP as carinaai.uk)"
  echo "   TLS: certbot certonly --nginx -d hub.carinaai.uk (or add SAN to carinaai.uk cert)"
  echo "   Docker prod: docker-compose -f docker-compose.prod.yml up carina-hub nginx"
  echo "   Nginx: internal/servers/core.carinaai.uk/docker/nginx/hub.carinaai.uk.conf -> carina-hub:3001"
  echo "   Legacy skills.carinaai.uk redirects to hub.carinaai.uk"
  print_nginx_hint "hub.carinaai.uk" "3001"
}

main "$@"
