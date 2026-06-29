#!/usr/bin/env bash
# Enable GitHub Discussions and seed good-first issues on malike2356/carina-mutant.
# This is the PUBLIC community repo. Run after the initial release of Carina Mutant.
# Requires: gh auth login (with verlox org access)
set -euo pipefail

REPO="${GITHUB_REPO:-malike2356/carina-mutant}"

log() { echo "[mutant-community] $*"; }

if ! gh auth status &>/dev/null; then
  echo "ERROR: gh not authenticated. Run: gh auth login"
  exit 1
fi

log "Enabling Discussions on ${REPO}..."
gh repo edit "${REPO}" --enable-discussions 2>/dev/null || \
  log "Discussions may already be enabled (check repo Settings)"

create_issue() {
  local title="$1"
  local body="$2"
  local labels="$3"
  if gh issue list -R "${REPO}" --search "in:title ${title}" --json title --jq '.[].title' | grep -Fxq "${title}"; then
    log "Skip (exists): ${title}"
    return 0
  fi
  gh issue create -R "${REPO}" --title "${title}" --body "${body}" --label "${labels}"
  log "Created: ${title}"
}

log "Seeding good first issues..."

create_issue \
  "docs: add troubleshooting section for common setup errors" \
  "## Task
Add a Troubleshooting section to README covering:
- Python version below 3.11
- Missing CARINA_MUTANT_REDIS_PASSWORD
- Docker not running when Mutant Agent sandbox is enabled
- LLM provider rate limit errors on first run

## Acceptance
- PR updates README only
- No code changes required
Good for first-time OSS contributors." \
  "good first issue,documentation"

create_issue \
  "docs: write a short tutorial for adding a new LLM provider" \
  "## Task
Add a step-by-step tutorial showing how to register a new LLM provider in
carina_mutant/brain/providers.py.

Reference the existing DeepSeek and Groq providers as examples.

## Acceptance
- Doc added to docs/
- Clear env var list shown" \
  "good first issue,documentation,help wanted"

create_issue \
  "test: add pytest coverage for the egress filter allowlist" \
  "## Task
Add pytest tests in tests/security/test_egress_filter.py asserting:
- Private IPs are always blocked
- Known allowed domains pass
- Unknown domains are blocked
- Path restrictions on api.github.com work correctly

## Acceptance
- pytest passes
- No new dependencies required" \
  "good first issue,testing"

create_issue \
  "feat: add a new passive OSINT tool to the cyber suite" \
  "## Task
Add a new tool to carina_mutant/cyber/tools/ using a free public API (e.g., crt.sh
for certificate transparency, or ipinfo.io for IP geolocation).

## Acceptance
- Tool declared in TOOL_PRIVILEGE_MAP at PrivilegeLevel.PASSIVE
- Unit test added
- Registered in the tool registry" \
  "good first issue,help wanted,cyber"

create_issue \
  "skill: scaffold an example skill pack for Carina Mutant" \
  "## Task
Add carina_mutant/skills/packs/example_starter/ with a minimal skill definition,
a README explaining how to copy it, and a link from CONTRIBUTING.md.

## Acceptance
- No credentials in template
- pnpm test passes after adding the pack" \
  "good first issue,skill-pack"

log ""
log "Done. Open: https://github.com/${REPO}/discussions"
log "Next: pin the Welcome discussion and add a Discord/community link."
