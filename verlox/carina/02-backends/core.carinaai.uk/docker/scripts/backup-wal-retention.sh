#!/usr/bin/env bash
# Prune WAL archive segments older than WAL_RETENTION_DAYS (default 7).
# Also prunes remote WAL when WAL_REMOTE is set and rclone is available.
set -euo pipefail

# shellcheck source=backup-common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-common.sh"

WAL_DIR="${WAL_DIR:-/var/backups/postgres/wal}"
RETENTION_DAYS="${WAL_RETENTION_DAYS:-7}"
LOG_FILE="${LOG_DIR}/backup.log"

backup_log_init "${LOG_FILE}"

if [[ ! -d "${WAL_DIR}" ]]; then
  backup_log "${LOG_FILE}" "WAL retention: directory missing (${WAL_DIR}); nothing to prune"
  exit 0
fi

deleted=$(find "${WAL_DIR}" -type f -mtime +"${RETENTION_DAYS}" -print -delete | wc -l)
backup_log "${LOG_FILE}" "WAL retention: removed ${deleted} local file(s) older than ${RETENTION_DAYS} days"

if [[ -n "${WAL_REMOTE}" ]] && command -v rclone >/dev/null 2>&1; then
  rclone delete "${WAL_REMOTE}/" --min-age "${RETENTION_DAYS}d" --log-level INFO 2>&1 | tee -a "${LOG_FILE}" \
    || backup_log "${LOG_FILE}" "WAL retention: WARNING remote prune failed (non-fatal)"
fi
