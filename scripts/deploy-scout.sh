#!/usr/bin/env bash
# deploy-scout.sh - Deploy Scout engine and console.labyrinthscout.com to VPS
# Run from the carina repo root: bash scripts/deploy-scout.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="malike"
REMOTE="/home/malike/apps/console.labyrinthscout.com"
ENGINE_REMOTE="/home/malike/apps/scout-engine"
ENGINE_PORT="4455"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
LOCAL="${REPO_ROOT}/02-backends/console.labyrinthscout.com"
ENGINE_LOCAL="${REPO_ROOT}/02-backends/scout-engine"
SUP_NAME="labyrinth-scout"
ENGINE_SUP_NAME="scout-engine"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_ssh() {
  ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check SSH key."
}

setup_engine_service() {
  log "Configuring scout-engine persistence..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    ENGINE_DIR="${ENGINE_REMOTE}"
    LOG_DIR="/home/${VPS_USER}/logs"
    ENSURE_SCRIPT="\${ENGINE_DIR}/deploy/ensure-running.sh"
    ENABLE_BOOT="\${ENGINE_DIR}/deploy/enable-boot.sh"
    SUP_CONF="${ENGINE_SUP_NAME}.conf"
    SUP_PATH="/etc/supervisor/conf.d/\${SUP_CONF}"
    USER_UNIT="\$HOME/.config/systemd/user/scout-engine.service"
    CRON_MARK="# scout-engine ensure-running"

    mkdir -p "\${LOG_DIR}" "\$HOME/.config/systemd/user"
    chmod +x "\${ENSURE_SCRIPT}" "\${ENABLE_BOOT}"

    SUP_INSTALLED=0
    if sudo -n tee "\${SUP_PATH}" > /dev/null << CONF
[program:scout-engine]
command=/usr/bin/node ${ENGINE_REMOTE}/dist/server.js
directory=${ENGINE_REMOTE}
autostart=true
autorestart=true
user=${VPS_USER}
stdout_logfile=/var/log/supervisor/scout-engine.out.log
stderr_logfile=/var/log/supervisor/scout-engine.err.log
stdout_logfile_maxbytes=10MB
stderr_logfile_maxbytes=10MB
stopwaitsecs=30
environment=NODE_ENV="production"
CONF
    then
      echo "  Supervisor config installed at \${SUP_PATH}"
      sudo -n supervisorctl reread 2>/dev/null || true
      sudo -n supervisorctl update 2>/dev/null || true
      sudo -n supervisorctl restart "${ENGINE_SUP_NAME}" 2>/dev/null || \
        sudo -n supervisorctl start "${ENGINE_SUP_NAME}" 2>/dev/null || true
      SUP_INSTALLED=1
    else
      echo "  WARN: No passwordless sudo for supervisor; using user systemd"
      echo "  Manual supervisor install:"
      echo "    sudo cp \${ENGINE_DIR}/deploy/scout-engine.supervisor.conf \${SUP_PATH}"
      echo "    sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start scout-engine"
    fi

    if [[ "\${SUP_INSTALLED}" -eq 0 ]]; then
      cp "\${ENGINE_DIR}/deploy/scout-engine.service" "\${USER_UNIT}"
      systemctl --user daemon-reload
      systemctl --user enable scout-engine 2>/dev/null || true
      systemctl --user restart scout-engine 2>/dev/null || "\${ENSURE_SCRIPT}"

      LINGER=\$(loginctl show-user "${VPS_USER}" -p Linger --value 2>/dev/null || echo "no")
      if [[ "\${LINGER}" == "yes" ]]; then
        echo "  Linger enabled; scout-engine starts at boot via systemd"
      elif sudo -n loginctl enable-linger "${VPS_USER}" 2>/dev/null; then
        echo "  Linger enabled; scout-engine starts at boot via systemd"
      else
        echo ""
        echo "  ACTION REQUIRED (one-time, on VPS):"
        echo "    bash \${ENABLE_BOOT}"
        echo "  Or: sudo loginctl enable-linger ${VPS_USER}"
        echo "  Without linger, the user systemd service does not start at boot."
      fi

      TMP_CRON="\$(mktemp)"
      crontab -l 2>/dev/null \
        | grep -Fv "\${CRON_MARK}" \
        | grep -Fv "\${ENSURE_SCRIPT}" > "\${TMP_CRON}" || true
      crontab "\${TMP_CRON}" 2>/dev/null || true
      rm -f "\${TMP_CRON}"
    fi

    sleep 2
    if [[ "\${SUP_INSTALLED}" -eq 1 ]]; then
      sudo -n supervisorctl status "${ENGINE_SUP_NAME}" 2>/dev/null || pgrep -af "\${ENGINE_DIR}/dist/server.js" || true
    else
      systemctl --user is-active scout-engine 2>/dev/null || pgrep -af "\${ENGINE_DIR}/dist/server.js" || true
    fi
REMOTE
}

restart_console_service() {
  log "Restarting console (labyrinth-scout)..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    if sudo -n supervisorctl restart "${SUP_NAME}" 2>/dev/null; then
      sudo -n supervisorctl status "${SUP_NAME}" 2>/dev/null || true
    else
      pkill -f "${REMOTE}/dist/server.js" 2>/dev/null || true
      sleep 2
      nohup /usr/bin/node "${REMOTE}/dist/server.js" \
        >> /home/${VPS_USER}/logs/${SUP_NAME}.out.log \
        2>> /home/${VPS_USER}/logs/${SUP_NAME}.err.log &
      pgrep -af "${REMOTE}/dist/server.js" || true
    fi
REMOTE
}

main() {
  log "Scout engine and console deploy starting..."
  check_ssh

  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p ${REMOTE} ${ENGINE_REMOTE}"

  log "Syncing engine code..."
  rsync -az --delete \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.pnpm-store' \
    --exclude='dist' \
    --exclude='*.deb' \
    "${ENGINE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${ENGINE_REMOTE}/"

  log "Syncing console code..."
  rsync -az --delete \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.pnpm-store' \
    --exclude='dist' \
    --exclude='docs/.vitepress' \
    "${LOCAL}/" "${VPS_USER}@${VPS_HOST}:${REMOTE}/"

  log "Building on VPS..."
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail

    if [[ ! -f "${ENGINE_REMOTE}/.env" && -f "${REMOTE}/.env" ]]; then
      cp "${REMOTE}/.env" "${ENGINE_REMOTE}/.env"
      if ! grep -q '^SCOUT_PORT=' "${ENGINE_REMOTE}/.env"; then
        echo 'SCOUT_PORT=${ENGINE_PORT}' >> "${ENGINE_REMOTE}/.env"
      else
        sed -i 's|^SCOUT_PORT=.*|SCOUT_PORT=${ENGINE_PORT}|' "${ENGINE_REMOTE}/.env"
      fi
    elif [[ -f "${ENGINE_REMOTE}/.env" ]]; then
      if ! grep -q '^SCOUT_PORT=' "${ENGINE_REMOTE}/.env"; then
        echo 'SCOUT_PORT=${ENGINE_PORT}' >> "${ENGINE_REMOTE}/.env"
      else
        sed -i 's|^SCOUT_PORT=.*|SCOUT_PORT=${ENGINE_PORT}|' "${ENGINE_REMOTE}/.env"
      fi
    fi

    cd "${ENGINE_REMOTE}"
    echo "  Installing engine dependencies..."
    npm install --include=dev 2>&1 | tail -3

    echo "  Building engine..."
    npm run build 2>&1 | tail -5

    cd "${REMOTE}"
    if ! grep -q '^SCOUT_ENGINE_URL=' .env 2>/dev/null; then
      echo 'SCOUT_ENGINE_URL=http://127.0.0.1:${ENGINE_PORT}' >> .env
    else
      sed -i 's|^SCOUT_ENGINE_URL=.*|SCOUT_ENGINE_URL=http://127.0.0.1:${ENGINE_PORT}|' .env
    fi
    if ! grep -q '^SCOUT_ENGINE_API_KEY=' .env 2>/dev/null; then
      SCOUT_KEY=\$(grep '^SCOUT_API_KEY=' .env | tail -1 | cut -d= -f2- || true)
      echo "SCOUT_ENGINE_API_KEY=\${SCOUT_KEY}" >> .env
    fi

    echo "  Installing console dependencies..."
    npm install --include=dev 2>&1 | tail -3

    echo "  Building console TypeScript..."
    npm run build 2>&1 | tail -5

    echo "  Build complete."
REMOTE

  setup_engine_service
  restart_console_service

  log "Scout engine and console deployed."
}

main "$@"
