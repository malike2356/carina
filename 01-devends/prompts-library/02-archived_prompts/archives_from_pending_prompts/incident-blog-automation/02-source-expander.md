# Prompt 02; source expander

You are working in the Carina core repo. Your task is to improve incident discovery so the blog finds new, relevant, source-backed incidents more reliably.

Primary goal:

- Expand the discovery pipeline so important incidents are less likely to be missed
- Keep the curation strict enough to avoid noise, duplicates, and marketing content
- Preserve the draft-first workflow

Scope:

- Update the incident discovery logic in:
  - `carina/02-backends/core.carinaai.uk/src/blog/research-filters.ts`
  - `carina/02-backends/core.carinaai.uk/src/blog/research-runner.ts`
  - any supporting search or dedupe helpers
- If needed, add a scheduler entry point that can run discovery automatically
- Keep all source URLs and dedupe behavior explicit

What to improve:

- Broaden query coverage for current incident types, especially:
  - autonomous agent failures
  - model misuse
  - breach and leak stories
  - outages caused by AI workflows
  - lawsuits, fines, settlements, and enforcement actions
- Add topic expansion from recent incident titles and bodies
- Deduplicate by canonical URL and title where appropriate
- Keep junk and trend reports out

Output required:

1. Updated code that improves discovery coverage
2. Tests for new query coverage and dedupe behavior
3. A short note explaining how the new coverage catches stories the old system missed

Constraints:

- Do not weaken source quality to get more results
- Do not publish automatically in this step
- Do not bypass operator review

Acceptance criteria:

- Discovery returns a broader and more relevant set of candidates
- The new logic still filters obvious junk
- The code remains source-backed and deterministic where possible

