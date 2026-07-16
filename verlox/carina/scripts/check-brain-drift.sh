#!/usr/bin/env bash
# Compare Propreneur brain sources with the Carina mirror. Exit 1 on drift.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERLOX_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SOURCE_KNOWLEDGE="${VERLOX_ROOT}/propreneur/propreneur-v2/brain/knowledge"
DEST_KNOWLEDGE="${VERLOX_ROOT}/carina/02-backends/core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/knowledge"
SOURCE_CARINA_RAG="${VERLOX_ROOT}/propreneur/propreneur-v2/brain/masterbrain/carina_rag"
DEST_CARINA_RAG="${VERLOX_ROOT}/carina/02-backends/core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/masterbrain/carina_rag"

hash_dir() {
  local src="$1"
  if [[ ! -d "${src}" ]]; then
    echo ""
    return
  fi
  (
    cd "${src}" || exit 1
    find . -type f -name '*.md' | sort | xargs sha256sum 2>/dev/null | sha256sum | awk '{print $1}'
  )
}

compare_pair() {
  local label="$1"
  local src="$2"
  local dest="$3"
  if [[ ! -d "${src}" ]]; then
    echo "SKIP ${label}: source missing"
    return 0
  fi
  if [[ ! -d "${dest}" ]]; then
    echo "DRIFT ${label}: mirror missing at ${dest}"
    return 1
  fi
  local src_hash dest_hash
  src_hash="$(hash_dir "${src}")"
  dest_hash="$(hash_dir "${dest}")"
  if [[ "${src_hash}" != "${dest_hash}" ]]; then
    echo "DRIFT ${label}: mirror out of date (run sync-brain-from-propreneur.sh)"
    return 1
  fi
  echo "OK ${label}"
  return 0
}

FAILED=0
compare_pair "knowledge" "${SOURCE_KNOWLEDGE}" "${DEST_KNOWLEDGE}" || FAILED=1
compare_pair "carina_rag" "${SOURCE_CARINA_RAG}" "${DEST_CARINA_RAG}" || FAILED=1

if [[ "${FAILED}" -ne 0 ]]; then
  exit 1
fi

echo "Brain mirror matches Propreneur source."
