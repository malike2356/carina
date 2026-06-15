#!/usr/bin/env bash
# Export core.carinaai.uk to a clean directory for the PUBLIC carina-agent GitHub repo.
# Does not copy git history. Run from the private monorepo root.
#
# Usage:
#   bash scripts/export-carina-core-public.sh [output-dir]
#
# Default output: ../carina-agent-public (sibling of this monorepo)
#
# After export:
#   cd ../carina-agent-public
#   git init -b main
#   git add .
#   git commit -m "feat: initial public release of carina-agent core"
#   gh repo create malike2356/carina-agent --public --source=. --remote=origin --push
#
# Keep malike2356/carina-ai PRIVATE. Never make the full monorepo public.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CORE="${REPO_ROOT}/core.carinaai.uk"
TEMPLATE_DIR="${SCRIPT_DIR}/public-repo"
IGNORE_FILE="${TEMPLATE_DIR}/.public-exportignore"

OUT_DIR="${1:-$(dirname "$REPO_ROOT")/carina-agent-public}"
PUBLIC_GITHUB_REPO="${PUBLIC_GITHUB_REPO:-https://github.com/malike2356/carina-agent}"

log() { echo "[export] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[[ -d "$CORE" ]] || die "Missing core.carinaai.uk at $CORE"
[[ -f "$IGNORE_FILE" ]] || die "Missing $IGNORE_FILE"

log "Running kernel boundary check..."
(cd "$CORE" && node scripts/prune-pack-dist.mjs && pnpm tsx scripts/check-kernel-boundaries.ts)

log "Source: $CORE"
log "Output: $OUT_DIR"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

RSYNC_EXCLUDES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" ]] && continue
  RSYNC_EXCLUDES+=(--exclude="$line")
done < "$IGNORE_FILE"

rsync -a "${RSYNC_EXCLUDES[@]}" "${CORE}/" "${OUT_DIR}/"

cp "${TEMPLATE_DIR}/.gitignore" "${OUT_DIR}/.gitignore"
# Workflows: prefer core.carinaai.uk/.github; fall back to scripts/public-repo templates
if [[ ! -f "${OUT_DIR}/.github/workflows/ci.yml" ]]; then
  mkdir -p "${OUT_DIR}/.github/workflows"
  cp "${TEMPLATE_DIR}/ci.yml" "${OUT_DIR}/.github/workflows/ci.yml"
  cp "${TEMPLATE_DIR}/publish.yml" "${OUT_DIR}/.github/workflows/publish.yml"
fi

OUT_DIR="$OUT_DIR" PUBLIC_GITHUB_REPO="$PUBLIC_GITHUB_REPO" node <<'NODE'
const fs = require('fs');
const path = require('path');
const outDir = process.env.OUT_DIR;
const repo = process.env.PUBLIC_GITHUB_REPO;
const pkgPath = path.join(outDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

delete pkg.scripts.admin;
delete pkg.scripts['docs:dev'];
delete pkg.scripts['docs:build'];

pkg.repository = {
  type: 'git',
  url: `git+${repo}.git`,
};

// Public export is @verlox/carina-core; carina-agent meta-package publishes separately.
if (pkg.name === 'carina-agent') {
  pkg.name = '@verlox/carina-core';
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
NODE

log "Sanitized package.json (removed admin/docs monorepo scripts; updated repository URL)"
log "Done. Next steps:"
echo "  cd ${OUT_DIR}"
echo "  git init -b main && git add . && git commit -m 'feat: initial public carina-agent core'"
echo "  gh repo create malike2356/carina-agent --public --source=. --remote=origin --push"
echo ""
echo "See PUBLIC_REPOSITORY.md in the private monorepo for the full checklist."
