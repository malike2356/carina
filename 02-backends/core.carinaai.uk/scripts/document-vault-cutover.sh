#!/usr/bin/env bash
# document-vault-cutover.sh - Print cutover env and run programme-close tests (715).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[document-vault-cutover] Recommended env:"
cat <<'EOF'
DOCUMENT_VAULT_V1_ENABLED=1
DOCUMENT_VAULT_COMPAT_ADAPTERS=1
DOCUMENT_VAULT_DUAL_WRITE=0
DOCUMENT_VAULT_MIGRATE_DRY_RUN=0
DOCUMENT_VAULT_RETIRE_LEGACY_STORES=0
DOCUMENT_VAULT_CHANNEL_OPS=1
DOCUMENT_VAULT_SEARCH_OPS=1
EOF

echo "[document-vault-cutover] Rollback env:"
cat <<'EOF'
DOCUMENT_VAULT_V1_ENABLED=0
DOCUMENT_VAULT_COMPAT_ADAPTERS=1
DOCUMENT_VAULT_RETIRE_LEGACY_STORES=0
EOF

export DOCUMENT_VAULT_V1_ENABLED="${DOCUMENT_VAULT_V1_ENABLED:-1}"
export DOCUMENT_VAULT_COMPAT_ADAPTERS="${DOCUMENT_VAULT_COMPAT_ADAPTERS:-1}"
export DOCUMENT_VAULT_DUAL_WRITE="${DOCUMENT_VAULT_DUAL_WRITE:-0}"
export DOCUMENT_VAULT_MIGRATE_DRY_RUN="${DOCUMENT_VAULT_MIGRATE_DRY_RUN:-0}"
export DOCUMENT_VAULT_RETIRE_LEGACY_STORES="${DOCUMENT_VAULT_RETIRE_LEGACY_STORES:-0}"

echo "[document-vault-cutover] Running programme-close + vault suites..."
pnpm exec vitest run src/document-vault/programme-close.test.ts src/document-vault/search-rag-ops.test.ts src/document-vault/characterization.test.ts

EVIDENCE="$ROOT/docs/integrations/evidence/document-vault-conformance-715.json"
if [[ -f "$EVIDENCE" ]]; then
  echo "[document-vault-cutover] Evidence: $EVIDENCE"
else
  echo "[document-vault-cutover] WARNING: evidence file missing after tests" >&2
  exit 1
fi

echo "[document-vault-cutover] Done. Keep RETIRE_LEGACY_STORES=0 through soak."
