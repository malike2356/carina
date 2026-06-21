# Prompt 03 - OpenClaw Security, Sandbox, and Remote Access

## Objective

Adopt the OpenClaw operational safety model where it is missing in Carina: sandbox defaults, command approval behavior, remote exposure rules, and clear channel trust boundaries.

Reuse rule: security posture can match, but wording cannot. Rewrite warnings, prompts, and settings copy in Carina vocabulary.

---

## Read First

- `instructions/prompts/researched_gap/3-agents-to-adopt/openclaw/README.md`
- `core.carinaai.uk/src/security/`
- `core.carinaai.uk/docs/security/`
- `core.carinaai.uk/docs/gateways/`
- `console.labyrinthscout.com/docs/security/` for Scout boundary patterns

---

## What to Check

1. What Carina already enforces at the tool, session, and channel layer.
2. Where approval, sandboxing, and exposure rules still rely on operator memory instead of code.
3. Whether remote-access guidance is visible enough for people who are not reading source docs.
4. Whether any OpenClaw DM pairing or allowlist concepts are worth copying directly, or whether Carina already has a stronger equivalent.

---

## Deliverable

Add the missing safety and exposure pieces only where Carina is weaker:

- explicit sandbox or approval defaults for untrusted input
- better remote-access and gateway exposure guidance
- test coverage for any new guardrails

---

## Acceptance Criteria

- Untrusted inbound messages or connections do not silently gain extra power.
- Remote exposure is documented and enforced in code where possible.
- No duplicate security system is introduced if Carina already has one.
