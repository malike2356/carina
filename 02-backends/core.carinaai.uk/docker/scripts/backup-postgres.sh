#!/usr/bin/env bash
# Docker Postgres backup for Carina production stack.
# Run on VPS: cd core.carinaai.uk && bash docker/scripts/backup-postgres.sh
set -euo pipefail

# shellcheck source=backup-common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-common.sh"

LOG_FILE="${LOG_DIR}/backup.log"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

backup_log_init "${LOG_FILE}"

cd "${ROOT_DIR}"

backup_log "${LOG_FILE}" "Starting backup: ${DB_NAME} -> ${BACKUP_FILE}"

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${DB_USER}" -Fc --no-password "${DB_NAME}" > "${BACKUP_FILE}"

BACKUP_BYTES=$(stat -c%s "${BACKUP_FILE}")
BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
backup_log "${LOG_FILE}" "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

if [[ "${BACKUP_BYTES}" -lt "${BACKUP_SIZE_WARN_BYTES}" ]]; then
  backup_log "${LOG_FILE}" "WARNING: backup file is very small (${BACKUP_BYTES} bytes)"
  backup_send_mail "BACKUP SIZE WARNING" \
    "Verlox backup warning: backup file is only ${BACKUP_BYTES} bytes on $(date)"
fi

REMOTE_OK=1
if [[ -n "${BACKUP_REMOTE}" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    if rclone copy "${BACKUP_FILE}" "${BACKUP_REMOTE}/" --log-level INFO 2>&1 | tee -a "${LOG_FILE}"; then
      backup_log "${LOG_FILE}" "Uploaded to ${BACKUP_REMOTE}/$(basename "${BACKUP_FILE}")"
    else
      backup_log "${LOG_FILE}" "ERROR: rclone upload failed"
      REMOTE_OK=0
    fi
  else
    backup_log "${LOG_FILE}" "ERROR: rclone not installed; remote upload required"
    REMOTE_OK=0
  fi
fi

if [[ "${REMOTE_OK}" -eq 0 ]]; then
  exit 1
fi

date +%s > "${LOG_DIR}/backup-last-success.epoch"
backup_log "${LOG_FILE}" "Done."
