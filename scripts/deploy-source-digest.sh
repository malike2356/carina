#!/usr/bin/env bash
# Produce a stable digest for the exact first-party source selected for release.
set -euo pipefail

TARGET_DIR="${1:-}"
[[ -n "${TARGET_DIR}" && -d "${TARGET_DIR}" ]] || {
  echo "ERROR: Usage: deploy-source-digest.sh <tracked-product-directory>" >&2
  exit 1
}

GIT_ROOT="$(git -C "${TARGET_DIR}" rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: Deployment source must be inside a Git worktree." >&2
  exit 1
}
TARGET_ABS="$(cd "${TARGET_DIR}" && pwd)"
TARGET_REL="$(realpath --relative-to="${GIT_ROOT}" "${TARGET_ABS}")"

tracked_count="$(git -C "${GIT_ROOT}" ls-files -- "${TARGET_REL}" | wc -l)"
(( tracked_count >= 100 )) || {
  echo "ERROR: Refusing untracked or incomplete deployment source: ${TARGET_ABS}" >&2
  echo "ERROR: Expected at least 100 tracked files, found ${tracked_count}." >&2
  exit 1
}

manifest="$(mktemp)"
trap 'rm -f "${manifest}"' EXIT

while IFS= read -r -d '' path; do
  [[ -f "${GIT_ROOT}/${path}" ]] || continue
  digest="$(sha256sum "${GIT_ROOT}/${path}" | awk '{print $1}')"
  printf '%s  %s\n' "${digest}" "${path}" >> "${manifest}"
done < <(
  git -C "${GIT_ROOT}" ls-files --cached --others --exclude-standard -z -- "${TARGET_REL}" \
    | sort -z
)

[[ -s "${manifest}" ]] || {
  echo "ERROR: Deployment source manifest is empty: ${TARGET_ABS}" >&2
  exit 1
}

sha256sum "${manifest}" | awk '{print $1}'
