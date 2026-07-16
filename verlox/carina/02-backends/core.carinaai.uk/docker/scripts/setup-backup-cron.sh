#!/usr/bin/env bash
# Install backup cron jobs on the VPS (run once as the deploy user).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MARK="# carina-docker-backup"
ENV_FILE="/etc/verlox/backup.env"
ENV_PREFIX=""

if [[ -f "${ENV_FILE}" ]]; then
  ENV_PREFIX="set -a && source ${ENV_FILE} && set +a && "
fi

mkdir -p /var/log/verlox

(crontab -l 2>/dev/null | grep -v "${MARK}" || true; cat <<EOF
0 2 * * * ${ENV_PREFIX}cd ${ROOT_DIR} && bash docker/scripts/backup-postgres.sh >> /var/log/verlox/backup.log 2>&1 ${MARK}
0 3 * * * ${ENV_PREFIX}cd ${ROOT_DIR} && bash docker/scripts/backup-retention.sh >> /var/log/verlox/backup.log 2>&1 ${MARK}
30 3 * * * ${ENV_PREFIX}cd ${ROOT_DIR} && bash docker/scripts/backup-wal-retention.sh >> /var/log/verlox/backup.log 2>&1 ${MARK}
0 4 * * 0 ${ENV_PREFIX}cd ${ROOT_DIR} && bash docker/scripts/backup-restore-test.sh >> /var/log/verlox/backup-restore-test.log 2>&1 ${MARK}
EOF
) | crontab -

echo "Backup cron installed. Verify: crontab -l | grep carina-docker-backup"
echo "Ensure rclone is configured: bash docker/scripts/setup-rclone-backup.sh"
