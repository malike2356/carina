# Carina Ops Sprint 6.2: Onboarding wizard UI

## Goal

Guided wizard on first visit to Carina Ops that walks users through onboarding steps.

## Context

- Checklist API from prompt 30
- Shell from prompt 14

## Dependencies

- `14-ops-static-shell.md`
- `30-onboarding-checklist-api.md`

## Files to create

- `core.carinaai.uk/src/gateway/web/ops/onboarding.html`
- `core.carinaai.uk/src/gateway/web/ops/onboarding.js`

## Files to modify

- `core.carinaai.uk/src/gateway/web/ops/layout.js`
- `core.carinaai.uk/src/gateway/web.ts` (route `/ops/onboarding`)

## Step-by-step

1. On first `/ops/` visit when `percentComplete < 100` and not dismissed, redirect to `/ops/onboarding` (store dismiss in localStorage + server flag).

2. Wizard UI:

- Progress bar
- Step list with checkmarks
- Primary CTA per incomplete step (links to `/ops/vault`, `/ops/workbench`, `/ops/billing`, settings invite)
- Skip link: "I'll do this later"

3. `onboarding.js` polls `GET /api/carina-ops/onboarding` every 10s while page open.

4. On 100% complete, show success state with link to overview.

5. Copy tone: operational, not marketing fluff.

Example CTA labels:

- "Connect your first API key"
- "Run a test prompt"
- "Invite a teammate"

## Expected behavior

- New trial user lands on wizard after first ops login
- Completing BYOK step auto-checks on poll
- Dismiss hides wizard on future visits

## Test

Manual walkthrough on localhost; no automated UI test required.

Time to first prompt target: under 10 minutes with wizard.
