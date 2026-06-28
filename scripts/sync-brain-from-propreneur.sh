#!/usr/bin/env bash
# Sync Propreneur brain knowledge into Carina property-uk mirror.
# Usage: sync-brain-from-propreneur.sh [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERLOX_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SOURCE_KNOWLEDGE="${VERLOX_ROOT}/propreneur/propreneur-v2/brain/knowledge"
DEST_KNOWLEDGE="${VERLOX_ROOT}/carina/02-backends/core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/knowledge"
SOURCE_CARINA_RAG="${VERLOX_ROOT}/propreneur/propreneur-v2/brain/masterbrain/carina_rag"
DEST_CARINA_RAG="${VERLOX_ROOT}/carina/02-backends/core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/masterbrain/carina_rag"
CORE_ROOT="${VERLOX_ROOT}/carina/02-backends/core.carinaai.uk"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ ! -d "${SOURCE_KNOWLEDGE}" ]]; then
  echo "ERROR: Propreneur knowledge source not found: ${SOURCE_KNOWLEDGE}" >&2
  exit 1
fi

mkdir -p "${DEST_KNOWLEDGE}" "${DEST_CARINA_RAG}"

RSYNC_FLAGS=(-a --delete --include='*.md' --exclude='*')
if [[ "${DRY_RUN}" -eq 1 ]]; then
  RSYNC_FLAGS+=(--dry-run -v)
  echo "DRY RUN: would sync Propreneur brain -> Carina mirror"
fi

echo "Sync knowledge: ${SOURCE_KNOWLEDGE} -> ${DEST_KNOWLEDGE}"
rsync "${RSYNC_FLAGS[@]}" "${SOURCE_KNOWLEDGE}/" "${DEST_KNOWLEDGE}/"

if [[ -d "${SOURCE_CARINA_RAG}" ]]; then
  echo "Sync carina_rag: ${SOURCE_CARINA_RAG} -> ${DEST_CARINA_RAG}"
  rsync "${RSYNC_FLAGS[@]}" "${SOURCE_CARINA_RAG}/" "${DEST_CARINA_RAG}/"
else
  echo "WARN: carina_rag source missing; skipping ${SOURCE_CARINA_RAG}" >&2
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "DRY RUN complete (no files written, manifest skipped)"
  exit 0
fi

if [[ -x "$(command -v node)" ]] && [[ -f "${CORE_ROOT}/src/skills/brain-sync-manifest.ts" ]]; then
  echo "Writing .brain-skill-manifest.json"
  (cd "${CORE_ROOT}" && npx --yes tsx src/skills/brain-sync-manifest.ts "${DEST_KNOWLEDGE}")
else
  echo "WARN: tsx/node unavailable; skipped manifest generation" >&2
fi

echo "Brain sync complete."
