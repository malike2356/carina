#!/usr/bin/env bash
# Secret scanner: blocks commits (or CI runs) containing API keys, tokens,
# private keys, or database URLs anywhere in the Carina tree.
#
# Usage:
#   scripts/scan-secrets.sh                 # scan staged git changes (pre-commit use)
#   scripts/scan-secrets.sh --all           # scan every tracked file in the tree
#   scripts/scan-secrets.sh path/to/file... # scan specific files
#
# Exit code is the number of files with at least one match; 0 means clean.
#
# Pre-commit hook (optional, not installed automatically):
#   ln -s ../../carina/scripts/scan-secrets.sh .git/hooks/pre-commit
# or call it from an existing pre-commit hook / CI workflow step.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Pattern -> label. Order matters only for readability of output.
PATTERNS=(
  'sk-[a-zA-Z0-9]{32,}|OpenAI/generic secret key (sk-...)'
  'sk-ant-[a-zA-Z0-9_-]{32,}|Anthropic secret key'
  'sk-proj-[a-zA-Z0-9_-]{32,}|OpenAI project key'
  'xai-[a-zA-Z0-9]{32,}|xAI secret key'
  'sk_live_[a-zA-Z0-9]{24,}|Stripe live secret key'
  'sk_test_[a-zA-Z0-9]{24,}|Stripe test secret key (should still not be committed)'
  'rk_live_[a-zA-Z0-9]{24,}|Stripe live restricted key'
  'whsec_[a-zA-Z0-9]{24,}|Stripe webhook signing secret'
  'AIza[0-9A-Za-z_-]{35}|Google API key'
  'ya29\.[0-9A-Za-z_-]+|Google OAuth access token'
  'ghp_[a-zA-Z0-9]{36,}|GitHub personal access token'
  'github_pat_[a-zA-Z0-9_]{36,}|GitHub fine-grained PAT'
  'gho_[a-zA-Z0-9]{36,}|GitHub OAuth token'
  'xox[baprs]-[a-zA-Z0-9-]{10,}|Slack token'
  'AKIA[0-9A-Z]{16}|AWS access key ID'
  'postgres(ql)?://[^ "'"'"']*:[^ "'"'"']*@[^ "'"'"']+|Postgres connection URL with credentials'
  'mongodb(\+srv)?://[^ "'"'"']*:[^ "'"'"']*@[^ "'"'"']+|MongoDB connection URL with credentials'
  'redis://[^ "'"'"']*:[^ "'"'"']*@[^ "'"'"']+|Redis connection URL with credentials'
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Private key block'
  'resend_[a-zA-Z0-9]{20,}|Resend API key'
)

# Directories and file suffixes that are never meaningful to scan (build
# artifacts, dependency trees, lockfiles with long hashes that look like
# secrets but are not).
EXCLUDE_DIRS_RE='(^|/)(node_modules|dist|build|coverage|\.git|\.next|\.turbo|vendor|\.pnpm)(/|$)'
# .env.example/.sample/.template files are committed-by-design placeholder
# templates (see AGENTS.md); real .env files are not excluded here.
EXCLUDE_FILES_RE='(^|/)(pnpm-lock\.yaml|package-lock\.json|composer\.lock|yarn\.lock)$|\.(min\.js|map|lock)$|\.env\.(example|sample|template)$'

collect_all_files() {
  git ls-files -- "$ROOT" | grep -Ev "$EXCLUDE_DIRS_RE" | grep -Ev "$EXCLUDE_FILES_RE"
}

collect_staged_files() {
  git diff --cached --name-only --diff-filter=ACM -- "$ROOT" \
    | grep -Ev "$EXCLUDE_DIRS_RE" | grep -Ev "$EXCLUDE_FILES_RE"
}

MODE="staged"
EXPLICIT_FILES=()
for arg in "$@"; do
  case "$arg" in
    --all) MODE="all" ;;
    --staged) MODE="staged" ;;
    *) EXPLICIT_FILES+=("$arg") ;;
  esac
done

if [ "${#EXPLICIT_FILES[@]}" -gt 0 ]; then
  FILES="$(printf '%s\n' "${EXPLICIT_FILES[@]}")"
elif [ "$MODE" = "all" ]; then
  FILES="$(collect_all_files)"
else
  FILES="$(collect_staged_files)"
fi

if [ -z "$FILES" ]; then
  echo "scan-secrets: no files to scan."
  exit 0
fi

echo "=== Secret scan (${MODE}) ==="

FILES_WITH_MATCHES=0
TOTAL_MATCHES=0

while IFS='|' read -r pattern label; do
  [ -z "$pattern" ] && continue
  MATCHES="$(printf '%s\n' "$FILES" | xargs -r grep -InE "$pattern" -- 2>/dev/null || true)"
  if [ -n "$MATCHES" ]; then
    echo ""
    echo "FOUND: $label"
    echo "Pattern: $pattern"
    echo "$MATCHES" | while IFS=: read -r file line _rest; do
      echo "  - $file:$line"
    done
    COUNT="$(printf '%s\n' "$MATCHES" | wc -l | tr -d ' ')"
    TOTAL_MATCHES=$((TOTAL_MATCHES + COUNT))
    FILES_WITH_MATCHES=$((FILES_WITH_MATCHES + 1))
  fi
done < <(printf '%s\n' "${PATTERNS[@]}")

echo ""
if [ "$TOTAL_MATCHES" -gt 0 ]; then
  echo "COMMIT BLOCKED: $TOTAL_MATCHES potential secret(s) found across $FILES_WITH_MATCHES pattern group(s)."
  echo "Move secrets to .env (gitignored) or a secrets manager. Never commit them."
  exit "$FILES_WITH_MATCHES"
fi

echo "Clean: no secrets detected."
exit 0
