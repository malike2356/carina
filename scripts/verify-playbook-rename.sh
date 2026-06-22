#!/usr/bin/env bash
# verify-playbook-rename.sh - Check cookbook-to-playbook user-facing rename
# Usage: bash scripts/verify-playbook-rename.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CORE="${REPO_ROOT}/backends/servers/core.carinaai.uk"
WEB_ASSETS="${CORE}/packages/web/assets/web"
FAIL=0

log() { echo "[verify-playbook-rename] $*"; }
fail() { log "FAIL: $*"; FAIL=1; }
pass() { log "PASS: $*"; }

# 1. No user-visible "Cookbook" in workspace HTML (exclude internal prompt-pack filenames)
log "Checking workspace HTML for user-visible Cookbook..."
HTML_HITS=0
while IFS= read -r -d '' file; do
  while IFS= read -r line; do
    if [[ "$line" =~ Cookbook ]] && [[ ! "$line" =~ cookbook-to-playbook-migration ]]; then
      fail "Cookbook in $(basename "$file"): ${line// /}"
      HTML_HITS=$((HTML_HITS + 1))
    fi
  done < <(grep -n 'Cookbook' "$file" 2>/dev/null || true)
done < <(find "$WEB_ASSETS" -maxdepth 1 -name '*.html' -print0 2>/dev/null)

if [[ "$HTML_HITS" -eq 0 ]]; then
  pass "No user-visible Cookbook in ${WEB_ASSETS}/*.html"
fi

# 2. Internal cookbook module still present
if [[ -d "${CORE}/src/cookbook" ]]; then
  pass "Internal src/cookbook/ module present"
else
  fail "Missing internal src/cookbook/ module"
fi

# 3. Playbook route and redirect assets exist
if [[ -f "${WEB_ASSETS}/playbook.html" ]]; then
  pass "playbook.html present"
else
  fail "Missing playbook.html"
fi

if [[ -f "${WEB_ASSETS}/cookbook.html" ]]; then
  pass "cookbook.html redirect stub present"
else
  fail "Missing cookbook.html redirect stub"
fi

# 4. CLI: carina playbook registered; cookbook alias prints deprecation notice
cd "$CORE"
PLAYBOOK_HELP="$(pnpm exec tsx bin/carina.ts playbook --help 2>&1 || true)"
if [[ "$PLAYBOOK_HELP" == *"carina playbook"* ]]; then
  pass "carina playbook --help works"
else
  fail "carina playbook --help missing expected usage text"
fi

COOKBOOK_OUT="$(pnpm exec tsx bin/carina.ts cookbook 2>&1 || true)"
if [[ "$COOKBOOK_OUT" == *"carina cookbook is now carina playbook"* ]] \
  || [[ "$COOKBOOK_OUT" == *"carina cookbook is deprecated"* ]]; then
  pass "carina cookbook prints deprecation notice"
else
  fail "carina cookbook missing deprecation notice (got: ${COOKBOOK_OUT:0:120}...)"
fi

if [[ "$FAIL" -eq 0 ]]; then
  log "All playbook rename checks passed."
  exit 0
fi

log "One or more playbook rename checks failed."
exit 1
