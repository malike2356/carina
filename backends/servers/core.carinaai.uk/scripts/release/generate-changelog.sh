#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FROM_TAG="${1:-}"
TO_REF="${2:-HEAD}"
OUT="${ROOT}/CHANGELOG.md"

if [[ -z "$FROM_TAG" ]]; then
  if git -C "$ROOT" describe --tags --abbrev=0 2>/dev/null; then
    FROM_TAG="$(git -C "$ROOT" describe --tags --abbrev=0)"
  else
    echo "No from-tag; pass explicit tag or create initial tag" >&2
    FROM_TAG="$(git -C "$ROOT" rev-list --max-parents=0 HEAD | head -1)"
  fi
fi

{
  echo "# Changelog"
  echo ""
  echo "## Unreleased ($(date -u +%Y-%m-%d))"
  echo ""
  git -C "$ROOT" log "${FROM_TAG}..${TO_REF}" --pretty=format:'- %s (%h)' --no-merges || true
  echo ""
} > "$OUT"

echo "Wrote $OUT (${FROM_TAG}..${TO_REF})"
