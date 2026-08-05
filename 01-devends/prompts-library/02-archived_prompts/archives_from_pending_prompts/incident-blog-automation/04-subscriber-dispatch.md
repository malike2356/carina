# Prompt 04; subscriber dispatch

You are working in the Carina core repo. Your task is to connect incident blog publishing to subscriber outreach.

Primary goal:

- Notify confirmed subscribers when new incident articles are published
- Support digest delivery as an option
- Keep unsubscribe and confirmation behavior intact

Scope:

- Review and extend:
  - `carina/02-backends/core.carinaai.uk/src/blog/newsletter-send.ts`
  - `carina/02-backends/core.carinaai.uk/src/api/incident-blog.ts`
  - `carina/02-backends/core.carinaai.uk/src/blog/store.ts`
- Add a publish-triggered dispatch path
- Add digest mode if it can be done cleanly

What to implement:

- A publish event should be able to:
  - send immediately to confirmed subscribers
  - queue for digest delivery
  - both, depending on ops settings
- Only confirmed, active subscribers should receive mail
- Track send status so the same item is not repeatedly sent
- Preserve one-click unsubscribe and confirmation flows

Output required:

1. The code changes that wire publish to newsletter dispatch
2. Any queue or state changes needed to prevent duplicate sends
3. Tests for send-on-publish, digest behavior, and unsubscribe safety

Constraints:

- Do not send to unconfirmed subscribers
- Do not add a marketing blast that bypasses opt-in
- Keep the mailer behavior predictable and logged

Acceptance criteria:

- Publishing an incident can notify subscribers automatically
- Duplicate sends are prevented
- Subscriber opt-in rules still hold

