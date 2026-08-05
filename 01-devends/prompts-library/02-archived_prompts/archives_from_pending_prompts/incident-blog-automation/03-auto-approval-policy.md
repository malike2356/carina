# Prompt 03; auto-approval policy

You are working in the Carina core repo. Your task is to add configurable approval policy for incident blog drafts.

Primary goal:

- Allow ops to define when a draft can be auto-approved or auto-published
- Keep the default behavior conservative
- Preserve manual review for weak or ambiguous stories

Scope:

- Add policy support around:
  - `carina/02-backends/core.carinaai.uk/src/api/incident-blog.ts`
  - `carina/02-backends/core.carinaai.uk/src/blog/store.ts`
  - any blog settings or policy helpers used by the incident blog
- Define policy inputs such as:
  - auto-approve enabled or disabled
  - auto-publish enabled or disabled
  - minimum confidence threshold
  - minimum source count
  - required source types or domains if needed
- Make policy decisions visible in stored incident metadata or audit logs

What the policy should do:

- Approve only when the incident is clearly named, recent, and source-backed
- Prefer at least one primary source and one corroborating source for higher confidence
- Keep manual approval for weaker claims
- Never publish unverified claims automatically

Output required:

1. The policy data model
2. The code path that evaluates the policy
3. The API and storage changes needed to persist the decision
4. Tests that prove auto-approve and manual fallback both behave correctly

Constraints:

- Do not remove human approval from the system
- Do not auto-publish without source quality checks
- Keep policy changes backward compatible

Acceptance criteria:

- Operators can configure approval behavior
- Strong drafts can move faster when policy allows it
- Weak drafts still require manual review

