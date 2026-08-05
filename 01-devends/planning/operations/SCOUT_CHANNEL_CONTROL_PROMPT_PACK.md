# Scout channel control prompt pack

Status: COMPLETE; archived to `01-devends/prompts-library/02-archived_prompts/archives_from_pending_prompts/scout-channel-kill/`

Use this pack to ship emergency Scout controls through Telegram, WhatsApp, Slack, and the web dashboard.

The goal is simple: trusted operators must be able to pause, suspend, quarantine, or kill safely from the channel they already use daily.

## Prompt 1: Design the trusted channel control model

```text
You are working in the Carina and Scout codebase. Design the trusted channel control model for Scout emergency actions.

Goal:
- Let verified operators trigger Scout actions from Telegram, WhatsApp, Slack, and web.
- Keep the control path faster than opening the dashboard, but not weaker than the dashboard.
- Make sure customer channels cannot trigger controls.

Scope:
- Define the channel linking flow.
- Define operator identity verification.
- Define command and button based control syntax.
- Define the control ladder: pause, suspend, quarantine, restrict, kill.
- Define how to handle ambiguous targets, stale tokens, and replay attempts.
- Define what must be audited for every control event.

Requirements:
- Use the existing Scout and Channel Shield code paths where possible.
- Reuse current channel adapters, not a parallel messaging stack.
- Keep the first version focused on Telegram and WhatsApp, with Slack and web fallback.
- Make the model explicit about allowed and denied paths.
- Add or update tests for identity, token expiry, replay, target selection, and audit metadata.

Deliverables:
- Architecture note in the Scout baseline docs.
- Clear state machine for control intents and confirmations.
- File and route map for implementation.

Acceptance:
- A reviewer can explain in one page how a trusted operator reaches a valid emergency action from a daily channel.
- A reviewer can also explain why an untrusted user or channel cannot do the same.
```

## Prompt 2: Implement channel control execution and audit

```text
You are working in the Carina core and Scout integration code. Implement the execution path for Scout emergency controls from trusted channels.

Goal:
- Receive a control intent from Telegram, WhatsApp, Slack, or web.
- Validate operator identity, target, role, token freshness, and action scope.
- Execute the selected Scout action once and only once.
- Write a durable audit record and send a response back on the same channel.

Scope:
- Add the control intent store, confirmation store, and action ledger.
- Add idempotency and replay protection.
- Add command parsing or button payload handling for channel messages.
- Wire the flow into the existing Scout bridge and Channel Shield paths.
- Support pause, suspend, quarantine, policy restriction, and full kill switch.
- Keep dashboard fallback available if channel delivery fails.

Implementation targets:
- Scout control service or equivalent under core backend source.
- Channel adapter handlers for Telegram and WhatsApp first.
- Slack and web handlers if the existing abstractions make this cheap.
- Shared audit/event logging so Scout sees every control action.

Requirements:
- Every destructive action must have a preview and a confirm step.
- Every action must be tied to a single workspace, instance, or channel binding.
- Every action must emit a durable audit event and a user-facing confirmation.
- Any ambiguity must fail closed.

Tests:
- Linked operator can pause a worker from Telegram.
- Linked operator can suspend a channel from WhatsApp.
- Linked operator cannot trigger a control action from an unlinked chat.
- Replayed confirmation cannot execute twice.
- Expired token is rejected.
- Failed channel delivery falls back cleanly without losing the queued action.

Acceptance:
- Emergency control works from a trusted channel in production-shaped tests.
- The audit trail shows who asked, what was targeted, what happened, and when.
```

## Prompt 3: Ship operator UX, rollout, and trust language

```text
You are working in the Scout dashboard, Carina docs, and public trust language.

Goal:
- Make the emergency channel controls discoverable, explainable, and safe to use.
- Show the linked channels, last control action, and current policy state.
- Keep the public and customer language honest about what exists.

Scope:
- Add dashboard views for linked operator channels and emergency action history.
- Add quick actions for pause, suspend, quarantine, restrict, and kill where allowed.
- Add channel pairing and unpairing UX.
- Add docs that explain the control ladder and when to use each level.
- Add status copy for success, rejection, pending confirm, and failure.
- Update launch and readiness docs to match the built behavior.

Requirements:
- Do not expose destructive controls to unverified users.
- Do not hide the confirm step for destructive actions.
- Do not claim channel support that is not implemented.
- Make the UI usable on mobile, because that is a primary use case.
- Keep the audit view and incident export one click away.

Tests:
- Dashboard shows linked channels and last action.
- Quick action opens the correct confirm flow.
- Unverified user sees read-only state.
- Mobile layout does not hide the emergency controls or the audit trail.

Acceptance:
- An operator can understand, link, and use the feature without reading source code.
- Product, engineering, and security docs all describe the same control path.
```
