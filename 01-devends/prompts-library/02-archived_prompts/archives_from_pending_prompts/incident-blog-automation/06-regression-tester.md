# Prompt 06; regression tester

You are working in the Carina core repo. Your task is to add regression coverage for the incident blog automation pipeline.

Primary goal:

- Prove the new automation works without losing safety
- Catch missing sources, duplicate drafts, accidental auto-publish, and bad subscriber dispatch

Scope:

- Add tests around:
  - discovery coverage
  - curation and dedupe
  - approval policy
  - publish-triggered dispatch
  - settings persistence if applicable
- Focus on the following code paths:
  - `carina/02-backends/core.carinaai.uk/src/blog/research-runner.ts`
  - `carina/02-backends/core.carinaai.uk/src/blog/research-filters.ts`
  - `carina/02-backends/core.carinaai.uk/src/blog/newsletter-send.ts`
  - `carina/02-backends/core.carinaai.uk/src/blog/store.ts`
  - `carina/02-backends/core.carinaai.uk/src/api/incident-blog.ts`

Test cases to include:

- a current incident that should now be discovered
- a generic trend article that should still be rejected
- a strong source-backed draft that can auto-approve
- a weak draft that must stay manual
- a publish event that triggers subscriber mail
- an unsubscribed or unconfirmed subscriber that must not receive mail

Output required:

1. Regression tests for the new automation
2. Notes on any manual checks that still need to be run
3. A concise summary of what the tests prove

Constraints:

- Do not loosen source verification to satisfy tests
- Do not let tests encode unsafe defaults
- Keep the checks fast enough to run in normal development

Acceptance criteria:

- The full incident blog automation path is covered
- Safety regressions are visible in tests
- The behavior is still operator controlled

