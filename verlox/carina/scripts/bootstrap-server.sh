#!/usr/bin/env bash
# Bootstrap a new server for Carina + Labyrinth Scout Docker deployment.
# Tested on Ubuntu 22.04 LTS and Ubuntu 24.04 LTS.
# Run as root or with sudo: bash scripts/bootstrap-server.sh

set -euo pipefail

APPS_DIR="${APPS_DIR:-/home/malike/apps}"
APPS_USER="${APPS_USER:-malike}"

log() { echo "[bootstrap] $*"; }
fail() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

. /etc/os-release 2>/dev/null || fail "Cannot read /etc/os-release"
if [[ "$ID" != "ubuntu" ]]; then
  fail "This script requires Ubuntu. Detected: $ID $VERSION_ID"
fi
log "OS: Ubuntu $VERSION_ID"

if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > \
    /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log "Docker installed."
else
  log "Docker already installed: $(docker --version)"
fi

if id "$APPS_USER" &>/dev/null; then
  usermod -aG docker "$APPS_USER"
  log "Added $APPS_USER to docker group."
fi

if ! command -v certbot &>/dev/null; then
  log "Installing certbot..."
  apt-get install -y -qq snapd
  snap install core && snap refresh core
  snap install --classic certbot
  ln -sf /snap/bin/certbot /usr/bin/certbot
  log "certbot installed."
else
  log "certbot already installed."
fi

apt-get install -y -qq rsync curl jq python3

docker network inspect proxy >/dev/null 2>&1 || docker network create proxy
log "proxy Docker network ready."

mkdir -p \
  "${APPS_DIR}/core.carinaai.uk" \
  "${APPS_DIR}/ops.carinaai.uk" \
  "${APPS_DIR}/app.carinaai.uk" \
  "${APPS_DIR}/console.labyrinthscout.com" \
  "${APPS_DIR}/scout-engine"

if id "$APPS_USER" &>/dev/null; then
  chown -R "${APPS_USER}:${APPS_USER}" "${APPS_DIR}"
fi
log "App directories created at ${APPS_DIR}."

mkdir -p /etc/carina/ssl
log "SSL directory ready at /etc/carina/ssl."

echo ""
echo "========================================="
echo "Bootstrap complete. Manual steps required:"
echo "========================================="
echo ""
echo "1. Issue TLS certificates:"
echo "   certbot certonly --standalone -d carinaai.uk -d www.carinaai.uk \\"
echo "     -d app.carinaai.uk -d core.carinaai.uk -d hub.carinaai.uk \\"
echo "     -d ops.carinaai.uk -d docs.carinaai.uk -d install.carinaai.uk"
echo "   certbot certonly --standalone -d labyrinthscout.com -d www.labyrinthscout.com \\"
echo "     -d console.labyrinthscout.com"
echo ""
echo "   Then link or copy certs to /etc/carina/ssl/:"
echo "   ln -s /etc/letsencrypt /etc/carina/ssl"
echo "   (Or set CARINA_SSL_DIR=/etc/letsencrypt in your .env)"
echo ""
echo "2. Copy .env files to the server:"
echo "   scp .env.docker.runtime ${APPS_USER}@SERVER:${APPS_DIR}/core.carinaai.uk/"
echo "   scp ops.env             ${APPS_USER}@SERVER:${APPS_DIR}/ops.carinaai.uk/.env"
echo "   scp cloud.env           ${APPS_USER}@SERVER:${APPS_DIR}/app.carinaai.uk/.env"
echo "   scp scout.env           ${APPS_USER}@SERVER:${APPS_DIR}/console.labyrinthscout.com/.env"
echo ""
echo "3. Trigger the first deploy:"
echo "   APPS_ROOT=${APPS_DIR} bash scripts/deploy-carina.sh"
echo "   (Or push to main to trigger GitHub Actions deploy.yml)"
echo ""
echo "4. Verify all domains respond:"
echo "   curl -fsS https://core.carinaai.uk/api/health"
echo "   curl -fsS https://console.labyrinthscout.com/api/health"
