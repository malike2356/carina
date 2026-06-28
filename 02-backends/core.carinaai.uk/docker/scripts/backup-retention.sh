#!/usr/bin/env bash
# Prune local Postgres backup dumps:
# - Keep all backups from the last 7 days
# - Between 7 and 90 days: keep Sunday and 1st-of-month anchors only
# - Delete everything older than 90 days
# Remote retention mirrors local when BACKUP_REMOTE is configured.
set -euo pipefail

# shellcheck source=backup-common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-common.sh"

LOG_FILE="${LOG_DIR}/backup.log"
KEEP_DAILY="${KEEP_DAILY:-7}"

backup_log_init "${LOG_FILE}"

log() {
  backup_log "${LOG_FILE}" "retention: $*"
}

find_older_than_days() {
  find "${BACKUP_DIR}" -maxdepth 1 -name '*.dump' -mtime +"$1" 2>/dev/null | sort
}

while IFS= read -r f; do
  [[ -f "${f}" ]] || continue
  log "Deleting (>90 days): ${f}"
  rm -f "${f}"
done < <(find_older_than_days 90)

while IFS= read -r f; do
  [[ -f "${f}" ]] || continue
  filename=$(basename "${f}")
  date_part=$(echo "${filename}" | grep -oE '[0-9]{8}' | head -1)
  [[ -n "${date_part}" ]] || continue
  year="${date_part:0:4}"
  month="${date_part:4:2}"
  day="${date_part:6:2}"
  dow=$(date -d "${year}-${month}-${day}" +%u 2>/dev/null || true)

  if [[ "${dow}" == "7" || "${day}" == "01" ]]; then
    log "Keeping (weekly/monthly): ${f}"
  else
    log "Deleting (outside retention): ${f}"
    rm -f "${f}"
  fi
done < <(find_older_than_days "${KEEP_DAILY}")

if [[ -n "${BACKUP_REMOTE}" ]] && command -v rclone >/dev/null 2>&1; then
  rclone delete "${BACKUP_REMOTE}/" --min-age 91d --log-level INFO 2>&1 | tee -a "${LOG_FILE}" \
    || log "WARNING: remote retention prune failed (non-fatal)"
fi

log "Retention complete."
