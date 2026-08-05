# Scout Trust Hardening

You are working across Carina and Scout. Close the trust gap so production users can rely on Scout for defense, audit, and compliance.

Product goal:
- a prompt injection attempt is blocked
- the user sees the block
- the event is logged
- the audit trail is searchable
- a compliance report can be generated and passed to a decision maker

Why this matters:
- This is the trust moment that converts curiosity into standardization.

Scope:
- prompt injection defenses
- audit logging
- compliance reporting
- alert delivery
- trust event attribution
- kill switch or suspension flow
- policy visibility
- report export

Requirements:
- Review the current Scout security path from detection to audit log to report output.
- Make prompt injection handling deterministic and explainable.
- Ensure blocked events generate a clear audit record.
- Make the compliance or posture report complete enough for real review.
- Make the alert path reliable enough that a user can trust the notification.
- Expose the trust story in the GUI without hiding critical detail behind raw logs only.
- Add tests for blocking, alerting, audit persistence, report generation, and operator review.

Implementation notes:
- Keep the security surface honest about partial behavior if any step is incomplete.
- Prefer one clear source of truth for policy and audit state.
- Make sure the GUI and exported report describe the same event.
- Keep trust artifacts readable by non-developers.

Acceptance criteria:
- A suspicious action is blocked and recorded.
- The audit trail is easy to inspect.
- The compliance report is credible enough to support a production rollout.

