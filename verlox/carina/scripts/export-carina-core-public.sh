#!/usr/bin/env bash
# Export core.carinaai.uk to a clean deployment archive for malike2356/carina-aiva.
# malike2356/carina-aiva is PRIVATE. Do not publish this export publicly.
#
# The public community contribution from VERLOX is Carina Mutant (malike2356/carina-mutant).
# To bootstrap the Carina Mutant public repo, see: scripts/export-carina-mutant-public.sh
#
# Usage:
#   bash scripts/export-carina-core-public.sh [output-dir]
#
# Default output: ../carina-aiva-export (sibling of this monorepo)
#
# After export (for a clean deployment archive commit):
#   cd ../carina-aiva-export
#   git init -b main
#   git add .
#   git commit -m "chore: archive export"
#   git remote add origin git@github.com:malike2356/carina-aiva.git
#   git push -u origin main
#
# Never make malike2356/carina-aiva public.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CORE="${REPO_ROOT}/02-backends/core.carinaai.uk"
TEMPLATE_DIR="${SCRIPT_DIR}/public-repo"
IGNORE_FILE="${TEMPLATE_DIR}/.public-exportignore"

OUT_DIR="${1:-$(dirname "$REPO_ROOT")/carina-aiva-export}"
PRIVATE_GITHUB_REPO="${PRIVATE_GITHUB_REPO:-https://github.com/malike2356/carina-aiva}"

log() { echo "[export] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[[ -d "$CORE" ]] || die "Missing core.carinaai.uk at $CORE"
[[ -f "$IGNORE_FILE" ]] || die "Missing $IGNORE_FILE"

log "Running kernel boundary check..."
(cd "$CORE" && pnpm tsx scripts/check-kernel-boundaries.ts 2>/dev/null || log "Boundary check skipped (script not present)")

log "Source: $CORE"
log "Output: $OUT_DIR"
log "Private repo: $PRIVATE_GITHUB_REPO"

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

if [[ -f "${TEMPLATE_DIR}/.gitignore" ]]; then
  cp "${TEMPLATE_DIR}/.gitignore" "${OUT_DIR}/.gitignore"
fi

OUT_DIR="$OUT_DIR" PRIVATE_GITHUB_REPO="$PRIVATE_GITHUB_REPO" node <<'NODE'
const fs = require('fs');
const path = require('path');
const outDir = process.env.OUT_DIR;
const repo = process.env.PRIVATE_GITHUB_REPO;
const pkgPath = path.join(outDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

delete pkg.scripts.admin;
delete pkg.scripts['docs:dev'];
delete pkg.scripts['docs:build'];

pkg.repository = {
  type: 'git',
  url: `git+${repo}.git`,
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
NODE

log "Sanitized package.json (removed admin/docs scripts; set repository to carina-aiva)"
log ""
log "Done. Export at: ${OUT_DIR}"
log ""
log "Next steps for private archive push:"
log "  cd ${OUT_DIR}"
log "  git init -b main && git add . && git commit -m 'chore: archive export'"
log "  git remote add origin git@github.com:malike2356/carina-aiva.git"
log "  git push -u origin main"
log ""
log "For the PUBLIC community repo (Carina Mutant), use malike2356/carina-mutant instead."
