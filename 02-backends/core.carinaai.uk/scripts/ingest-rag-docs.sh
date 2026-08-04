#!/usr/bin/env bash
# Ingest all RAG knowledge documents in 01-devends/RAG/ into the rag_chunks table.
# Run this after adding or editing any RAG-XXX.md file.
#
# Usage:
#   bash scripts/ingest-rag-docs.sh           # skip already-ingested sources
#   bash scripts/ingest-rag-docs.sh --force   # delete and re-ingest all

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RAG_DIR="${REPO_ROOT}/../../01-devends/RAG"
PACK="carina-rag"
FORCE_FLAG=""

if [[ "${1:-}" == "--force" ]]; then
  FORCE_FLAG="--force"
fi

if [[ ! -d "$RAG_DIR" ]]; then
  echo "ERROR: RAG directory not found at: $RAG_DIR" >&2
  exit 1
fi

echo "Ingesting RAG documents from: $RAG_DIR"
echo "Pack: $PACK"
[[ -n "$FORCE_FLAG" ]] && echo "Mode: force re-ingest"
echo ""

TOTAL=0
for file in "$RAG_DIR"/RAG-*.md; do
  [[ -f "$file" ]] || continue
  echo "  -> $(basename "$file")"
  pnpm exec tsx bin/carina.ts rag upload "$file" --pack "$PACK" $FORCE_FLAG || true
  TOTAL=$((TOTAL + 1))
done

echo ""
echo "Done. Processed $TOTAL documents."
echo ""
echo "Run 'pnpm exec tsx bin/carina.ts rag list --pack $PACK' to verify."
