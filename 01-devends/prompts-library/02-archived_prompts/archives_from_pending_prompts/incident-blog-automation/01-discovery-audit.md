# Prompt 01; discovery audit

You are working in the Carina core repo. Your task is to audit the incident blog discovery pipeline and produce a precise implementation plan before changing code.

Primary goal:

- Identify why important current incidents can be missed
- Map the current discovery path from search query to draft creation
- Identify where the current logic is too static, too narrow, or too manual
- Recommend the smallest safe set of code changes that makes discovery materially better

Scope:

- Read and reason about the current incident blog flow in:
  - `carina/02-backends/core.carinaai.uk/src/blog/research-runner.ts`
  - `carina/02-backends/core.carinaai.uk/src/blog/research-filters.ts`
  - `carina/02-backends/core.carinaai.uk/src/api/incident-blog.ts`
  - `carina/02-backends/core.carinaai.uk/src/agents/checks/incident-research-check.ts`
  - `carina/02-backends/core.carinaai.uk/src/index.ts`
- Inspect the current search query design, filtering, curation, dedupe, and draft creation flow
- Inspect any scheduler or cron hooks already present for related tasks

Output required:

1. A concise discovery audit with exact code references
2. A list of failure modes, ranked by severity
3. A proposed patch plan, in the order it should be implemented
4. A short test plan for discovery regressions

Constraints:

- Do not implement the full automation yet
- Do not widen scope into unrelated blog redesigns
- Keep the output source-backed and concrete
- Prefer exact file paths and function names over generalities

Acceptance criteria:

- The audit explains why current incidents can be missed
- The audit explains whether the current query set is too static
- The audit identifies the minimum code path to improve discovery reliability

