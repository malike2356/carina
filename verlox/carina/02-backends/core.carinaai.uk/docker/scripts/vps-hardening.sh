#!/usr/bin/env bash
# One-time VPS host hardening (ufw, fail2ban). Run on VPS with sudo.
# Carina traffic stays on Docker nginx; this secures the host.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash docker/scripts/vps-hardening.sh" >&2
  exit 1
fi

echo "[1/3] Configuring ufw..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

echo "[2/3] Installing fail2ban (if missing)..."
if ! command -v fail2ban-client >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y fail2ban
fi

cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log

[nginx-auth]
enabled  = true
port     = http,https
filter   = nginx-auth
logpath  = /var/log/nginx/error.log
maxretry = 10
findtime = 5m
bantime  = 30m
EOF

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../nginx/fail2ban/nginx-auth.conf" ]]; then
  cp "${SCRIPT_DIR}/../nginx/fail2ban/nginx-auth.conf" /etc/fail2ban/filter.d/nginx-auth.conf
fi

systemctl enable fail2ban
systemctl restart fail2ban

echo "[3/3] Ensuring /var/log/verlox exists..."
mkdir -p /var/log/verlox /var/backups/postgres/daily
chmod 755 /var/log/verlox

echo "Host hardening complete. PostgreSQL must stay off public ports (Docker internal only)."
