# Prompt 01 - OpenClaw Onboarding, Gateway, and Routing

## Objective

Adopt the OpenClaw pieces that make the product feel easy to start, easy to connect, and easy to route across channels and agents. Keep the work focused on the missing onboarding and routing behavior, not on redoing existing Carina setup screens.

Reuse rule: adopt the behavior and workflow, then restate it in Carina language. Do not reuse OpenClaw wording, labels, or onboarding copy verbatim.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/openclaw/README.md`
- `instructions/prompts/researched_gap/3-agents-to-adopt/openclaw/docs/` if needed for setup and channels
- `core.carinaai.uk/src/cli/registry.ts`
- `core.carinaai.uk/src/cli/first-run.ts`
- `core.carinaai.uk/src/gateway/`
- `core.carinaai.uk/docs/getting-started.md`
- `core.carinaai.uk/docs/gateways/`

---

## What to Check

1. First-run onboarding flow and whether it covers gateway setup, channels, keys, and workspace state clearly enough.
2. Channel routing and allowlist behavior for inbound messages.
3. Agent routing by channel, account, peer, or workspace.
4. Remote access and exposure docs for people who are not sitting on the same machine.
5. Any missing setup steps that OpenClaw solves with `onboard` or gateway prompts.

---

## Deliverable

Implement only the missing pieces needed to make onboarding and routing feel guided and predictable:

- a clearer setup path for first-time users
- explicit routing rules where Carina currently relies on implicit defaults
- documentation or UI hints where users need to understand how to connect channels or agent targets

---

## Acceptance Criteria

- A new user can get from install to a working channel or workspace route without guessing.
- Channel routing rules are explicit and testable.
- Nothing already handled by the current Carina setup wizard is duplicated.
