#!/usr/bin/env bash
# Shared backup configuration. Source from backup-*.sh (do not execute directly).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

for env_file in \
  "/etc/verlox/backup.env" \
  "${ROOT_DIR}/.env.docker.runtime" \
  "${ROOT_DIR}/shared/.env" \
  "/var/www/core.carinaai.uk/shared/.env"; do
  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${env_file}"
    set +a
    break
  fi
done

BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres/daily}"
LOG_DIR="${LOG_DIR:-/var/log/verlox}"
BACKUP_REMOTE="${BACKUP_REMOTE:-backblaze:verlox-backups/postgres/daily}"
WAL_REMOTE="${WAL_REMOTE:-backblaze:verlox-backups/wal}"
BACKUP_ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-lordsesame@gmail.com}"
BACKUP_SIZE_WARN_BYTES="${BACKUP_SIZE_WARN_BYTES:-102400}"
DB_NAME="${POSTGRES_DB:-carina}"
DB_USER="${POSTGRES_USER:-carina}"

backup_log_init() {
  local log_file="$1"
  mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"
  touch "${log_file}"
}

backup_log() {
  local log_file="$1"
  shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${log_file}"
}

backup_send_mail() {
  local subject="$1"
  local body="$2"
  local recipient="${BACKUP_ALERT_EMAIL:-}"
  [[ -n "${recipient}" ]] || return 0
  echo "${body}" | mail -s "${subject}" "${recipient}" 2>/dev/null || true
}
