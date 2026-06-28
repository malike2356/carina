#!/usr/bin/env bash
# One-time Backblaze B2 + rclone setup for off-site Postgres backups.
# Run on the VPS as the user that owns backup cron (usually deploy user or root).
set -euo pipefail

echo "=== Carina backup: rclone + Backblaze B2 setup ==="
echo ""
echo "Prerequisites:"
echo "  - Private B2 bucket: verlox-backups"
echo "  - Application Key with read/write on verlox-backups only (no public read)"
echo ""

if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone..."
  curl -fsSL https://rclone.org/install.sh | sudo bash
fi

rclone version
echo ""

RCLONE_CONF="${RCLONE_CONFIG:-${HOME}/.config/rclone/rclone.conf}"
mkdir -p "$(dirname "${RCLONE_CONF}")"

if rclone listremotes 2>/dev/null | grep -q '^backblaze:$'; then
  echo "Remote 'backblaze' already configured."
else
  echo "Configure rclone remote named 'backblaze' (type: b2, hard delete: No):"
  rclone config
fi

echo ""
echo "Testing connection..."
rclone ls "backblaze:verlox-backups/" | head -5 || {
  echo "ERROR: cannot list backblaze:verlox-backups/"
  exit 1
}

chmod 600 "${RCLONE_CONF}" 2>/dev/null || sudo chmod 600 "${RCLONE_CONF}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_TARGET="/etc/verlox/backup.env"

if [[ ! -f "${ENV_TARGET}" ]]; then
  echo ""
  echo "Installing ${ENV_TARGET} from backup.env.example..."
  sudo mkdir -p /etc/verlox
  sudo cp "${SCRIPT_DIR}/backup.env.example" "${ENV_TARGET}"
  sudo chmod 600 "${ENV_TARGET}"
  echo "Edit ${ENV_TARGET} if POSTGRES_DB or alert email differ."
fi

echo ""
echo "Done. Next steps:"
echo "  1. bash docker/scripts/backup-postgres.sh"
echo "  2. rclone ls backblaze:verlox-backups/postgres/daily/"
echo "  3. bash docker/scripts/setup-backup-cron.sh"
echo ""
echo "rclone config path (credentials, VPS only): ${RCLONE_CONF}"
