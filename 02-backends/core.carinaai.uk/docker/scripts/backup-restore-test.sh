#!/usr/bin/env bash
# Weekly restore test: download latest off-site backup, restore to test DB, verify tables, drop.
# Does NOT touch the production database.
set -euo pipefail

# shellcheck source=backup-common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-common.sh"

LOG_FILE="${LOG_DIR}/backup-restore-test.log"
TEST_DB="${DB_NAME}_restore_test"
RESTORE_TMP=""

cleanup() {
  if [[ -n "${RESTORE_TMP}" && -d "${RESTORE_TMP}" ]]; then
    rm -rf "${RESTORE_TMP}"
  fi
}
trap cleanup EXIT

backup_log_init "${LOG_FILE}"

log() { backup_log "${LOG_FILE}" "$*"; }
fail() {
  log "RESTORE TEST FAILED: $*"
  backup_send_mail "BACKUP RESTORE TEST FAILED" \
    "Verlox backup restore test FAILED on $(hostname): $*"
  exit 1
}

cd "${ROOT_DIR}"
log "=== Weekly restore test starting ==="

RESTORE_TMP=$(mktemp -d)
BACKUP_FILE=""

if [[ -n "${BACKUP_REMOTE}" ]] && command -v rclone >/dev/null 2>&1; then
  LATEST_REMOTE=$(rclone lsf "${BACKUP_REMOTE}/" --format "t;n" 2>/dev/null | sort -r | head -1 | cut -d';' -f2)
  [[ -n "${LATEST_REMOTE}" ]] || fail "No backups found in ${BACKUP_REMOTE}"
  log "Latest remote backup: ${LATEST_REMOTE}"
  rclone copy "${BACKUP_REMOTE}/${LATEST_REMOTE}" "${RESTORE_TMP}/"
  BACKUP_FILE="${RESTORE_TMP}/${LATEST_REMOTE}"
fi

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  BACKUP_FILE=$(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -1 || true)
fi

[[ -f "${BACKUP_FILE}" ]] || fail "No backup file available (remote or local)"
log "Using backup: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${DB_USER}" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${TEST_DB};"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${DB_USER}" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${TEST_DB} OWNER ${DB_USER};"

cat "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_restore -U "${DB_USER}" -d "${TEST_DB}" --no-owner --role="${DB_USER}" -v \
  || fail "pg_restore exited with error"

log "Restore complete. Running schema checks..."

table_exists() {
  local table="$1"
  docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}';" \
    2>/dev/null | tr -d ' '
}

check_table() {
  local table="$1"
  local min_rows="${2:-0}"
  local exists count

  exists=$(table_exists "${table}")
  if [[ "${exists}" != "1" ]]; then
    log "  ${table}: missing (skip if pre-Aiva schema)"
    return 0
  fi

  count=$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "-1")
  if [[ "${count}" == "-1" ]]; then
    fail "Table ${table} exists but COUNT query failed"
  fi
  if [[ "${count}" -lt "${min_rows}" ]]; then
    fail "Table ${table} has ${count} rows (expected >= ${min_rows})"
  fi
  log "  ${table}: ${count} rows - OK"
}

check_table workspaces 0
check_table users 0
check_table ai_workers 0
check_table ai_worker_activity 0
check_table ai_worker_automations 0
check_table aiva_subscriptions 0
check_table aiva_invoices 0
check_table aiva_escalations 0
check_table scout_signal_cache 0
check_table admin_audit_log 0
check_table admin_operators 0

if [[ "$(table_exists ai_worker_activity)" == "1" ]]; then
  LAST_ACTIVITY=$(docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U "${DB_USER}" -d "${TEST_DB}" -t -A -c \
    "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) FROM ai_worker_activity;" 2>/dev/null | tr -d ' ')
  if [[ -n "${LAST_ACTIVITY}" && "${LAST_ACTIVITY}" != "" ]] && command -v bc >/dev/null 2>&1; then
    if [[ "$(echo "${LAST_ACTIVITY} > 90000" | bc)" == "1" ]]; then
      log "WARNING: last activity is more than 25 hours old (${LAST_ACTIVITY} seconds)"
    fi
  fi
fi

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${DB_USER}" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE ${TEST_DB};"
log "Test DB dropped."

date +%s > "${LOG_DIR}/restore-test-last-success.epoch"
log "=== Restore test PASSED ==="
