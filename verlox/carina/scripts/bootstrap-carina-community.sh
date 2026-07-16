#!/usr/bin/env bash
# Enable GitHub Discussions and seed good-first issues on malike2356/carina-aiva.
# Requires: gh auth login
# Note: malike2356/carina-aiva is PRIVATE. This seeds internal team tracking issues.
# When Carina Mutant (malike2356/carina-mutant) is published, run a separate community
# bootstrap script targeting that public repo.
set -euo pipefail

REPO="${GITHUB_REPO:-malike2356/carina-aiva}"

log() { echo "[community] $*"; }

if ! gh auth status &>/dev/null; then
  echo "ERROR: gh not authenticated. Run: gh auth login"
  exit 1
fi

log "Enabling Discussions on ${REPO}..."
gh api -X PUT "repos/${REPO}" -f has_discussions=true 2>/dev/null || \
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
  "docs: add troubleshooting section to README for common setup errors" \
  "## Task
Add a **Troubleshooting** section to README.md covering:
- Node version below 22
- Missing \`DATABASE_URL\` / Redis when using postgres memory
- \`carina setup\` wizard failures

## Acceptance
- PR updates README only
- No code changes required

Good for first-time OSS contributors." \
  "good first issue,documentation"

create_issue \
  "docs: document Telegram gateway setup in a short example" \
  "## Task
Add a concise Telegram setup example (env vars + bot father steps) to docs or README.

Reference existing gateway code under \`src/gateway/\`.

## Acceptance
- Clear env var list
- Link to official Telegram bot docs" \
  "good first issue,documentation,help wanted"

create_issue \
  "test: add unit test for tool registry export surface" \
  "## Task
Add a Vitest test that asserts a known tool from \`TOOLSET_MAP\` is registered with a valid MCP schema shape.

## Acceptance
- Test in \`src/tools/*.test.ts\`
- \`pnpm test\` passes" \
  "good first issue,help wanted"

create_issue \
  "pack: scaffold example minimal skill pack in templates/" \
  "## Task
Add \`templates/skill-pack-starter/\` with minimal \`pack.json\`, one skill in \`skills.ts\`, and a README explaining how to copy it.

Helps new contributors start packs without reading property-uk first.

## Acceptance
- No credentials in template content
- Linked from CONTRIBUTING.md" \
  "good first issue,skill-pack"

create_issue \
  "chore: add GitHub issue label colors for skill-pack and good first issue" \
  "## Task
Document recommended label colors in CONTRIBUTING or a maintainer note:
- \`good first issue\` (green)
- \`skill-pack\` (purple)
- \`documentation\` (blue)

Optional: add \`.github/labels.yml\` if we adopt labeler action later." \
  "good first issue,chore"

log "Done. Open: https://github.com/${REPO}/issues"
log ""
log "REMINDER: malike2356/carina-aiva is private. For the public community repo, use:"
log "  GITHUB_REPO=malike2356/carina-mutant bash scripts/bootstrap-carina-mutant-community.sh"
