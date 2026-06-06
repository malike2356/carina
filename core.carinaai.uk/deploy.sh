#!/bin/bash
# deploy.sh - Deploy Carina to Contabo VPS (80.190.81.208)
# Run from your LOCAL machine: bash deploy.sh
# First deploy: bash deploy.sh --init
# Subsequent deploys: bash deploy.sh

set -euo pipefail

VPS_HOST="80.190.81.208"
VPS_USER="root"
DEPLOY_DIR="/opt/carina"
DOMAIN="carinaai.uk"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# Check SSH connectivity
check_ssh() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok &>/dev/null || \
    die "Cannot SSH to ${VPS_USER}@${VPS_HOST}. Check your SSH key."
}

# First-time init: install Docker, clone repo, get SSL cert
init_vps() {
  log "First-time VPS initialisation..."

  ssh "${VPS_USER}@${VPS_HOST}" bash << 'REMOTE'
    set -euo pipefail

    # Install Docker if missing
    if ! command -v docker &>/dev/null; then
      curl -fsSL https://get.docker.com | sh
      systemctl enable --now docker
    fi

    # Install pnpm if missing
    if ! command -v pnpm &>/dev/null; then
      curl -fsSL https://get.pnpm.io/install.sh | sh -
      source ~/.bashrc
    fi

    # Clone or update repo
    if [ -d /opt/carina ]; then
      cd /opt/carina && git pull
    else
      git clone https://github.com/verlox/carina.git /opt/carina
    fi

    mkdir -p /etc/carina/ssl /var/www/certbot

    echo "VPS init complete. Copy .env.production to /opt/carina/.env before continuing."
REMOTE

  log "VPS init done. Now:"
  log "  1. Copy .env.production to the VPS: scp .env.production ${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/.env"
  log "  2. Run: bash deploy.sh --ssl   (get Let's Encrypt certificate)"
  log "  3. Run: bash deploy.sh         (deploy)"
}

# Get initial SSL certificate using HTTP-01 challenge
get_ssl() {
  log "Getting SSL certificate for ${DOMAIN} and *.${DOMAIN}..."

  # Start a temporary nginx for the ACME challenge
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    cd ${DEPLOY_DIR}

    # Temp nginx on port 80 for ACME challenge only
    docker run --rm -d --name certbot-nginx \
      -p 80:80 \
      -v /var/www/certbot:/var/www/certbot \
      nginx:alpine \
      sh -c 'echo "server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } }" > /etc/nginx/conf.d/default.conf && nginx -g "daemon off;"'

    # Request cert
    docker run --rm \
      -v /etc/carina/ssl:/etc/letsencrypt \
      -v /var/www/certbot:/var/www/certbot \
      certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email hello@carinaai.uk \
        --agree-tos \
        --no-eff-email \
        -d ${DOMAIN} -d www.${DOMAIN} -d app.${DOMAIN} -d docs.${DOMAIN} -d skills.${DOMAIN} -d install.${DOMAIN}

    docker stop certbot-nginx

    # Download recommended SSL params if missing
    if [ ! -f /etc/carina/ssl/options-ssl-nginx.conf ]; then
      curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
        -o /etc/carina/ssl/options-ssl-nginx.conf
      openssl dhparam -out /etc/carina/ssl/ssl-dhparams.pem 2048
    fi
REMOTE

  log "SSL certificate obtained."
}

# Main deploy
deploy() {
  log "Deploying to ${VPS_HOST}..."

  # Build docs locally
  log "Building VitePress docs..."
  pnpm docs:build 2>/dev/null || log "Docs build skipped (vitepress not installed locally)"

  # Sync code to VPS
  log "Syncing code..."
  rsync -az --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='laravel/vendor' \
    --exclude='laravel/node_modules' \
    --exclude='archive' \
    --exclude='*.env' \
    --exclude='.env' \
    --exclude='ops.carinaai.uk/.env' \
    --exclude='data/' \
    . "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/"

  # Sync docs build if it exists
  if [ -d "docs/.vitepress/dist" ]; then
    log "Syncing docs build..."
    rsync -az docs/.vitepress/dist/ "${VPS_USER}@${VPS_HOST}:/var/www/docs/"
  fi

  # Sync public website
  rsync -az public_website/ "${VPS_USER}@${VPS_HOST}:/var/www/public_website/"

  # Sync install script
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p /var/www/install"
  rsync -az install.sh "${VPS_USER}@${VPS_HOST}:/var/www/install/install.sh"

  # Remote build and restart
  ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
    set -euo pipefail
    cd ${DEPLOY_DIR}

    log() { echo "[VPS \$(date +%H:%M:%S)] \$*"; }

    log "Building Docker images..."
    docker compose -f docker-compose.prod.yml build --parallel

    log "Starting services..."
    docker compose -f docker-compose.prod.yml up -d --remove-orphans

    log "Running ingest (property pack)..."
    docker compose -f docker-compose.prod.yml exec -T carina-web \
      node dist/src/skills/ingestion.js --pack property-uk 2>/dev/null || \
      log "Ingest skipped (already done or embeddings not configured)"

    log "Health check..."
    sleep 5
    curl -sf https://app.carinaai.uk/api/providers | grep -q "deepseek" && \
      log "app.carinaai.uk: OK" || log "WARNING: health check failed"

    log "Deploy complete."
REMOTE

  log "Done. Live at https://app.carinaai.uk"
}

# Parse args
case "${1:-deploy}" in
  --init)  check_ssh && init_vps ;;
  --ssl)   check_ssh && get_ssl ;;
  deploy|"") check_ssh && deploy ;;
  *) echo "Usage: bash deploy.sh [--init|--ssl]" && exit 1 ;;
esac
