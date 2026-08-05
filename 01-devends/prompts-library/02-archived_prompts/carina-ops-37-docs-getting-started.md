# Carina Ops Sprint 7.2: Documentation (getting started)

## Goal

Add user-facing docs for Carina Ops onboarding, BYOK, audit, and plan comparison.

## Context

- Canonical docs: `docs.carinaai.uk/`
- Do not edit legacy `core.carinaai.uk/docs/` for new user guides

## Dependencies

- `31-onboarding-wizard-ui.md`

## Files to create

```
docs.carinaai.uk/docs/user/carina-ops/
  index.md              Overview and product ladder
  getting-started.md    Register to first prompt
  byok.md               Connect provider keys
  audit-and-exports.md  Audit log and CSV exports
  plans.md              Free vs Starter vs Team
```

## Files to modify

- `docs.carinaai.uk/sidebars.ts` (add Carina Ops section under User docs)

## Step-by-step

1. `index.md`:

- Define Carina AI vs Carina Ops vs Scout in three sentences
- Link to app.carinaai.uk register

2. `getting-started.md`:

- Numbered steps matching onboarding wizard
- Screenshots optional; use ASCII flow if no screenshots yet

3. `byok.md`:

- Supported providers v1 (OpenAI, Anthropic, DeepSeek minimum)
- Keys encrypted at rest; never echoed in UI
- Rotation: delete and re-add

4. `audit-and-exports.md`:

- What events are logged
- Retention by plan
- Team CSV export steps

5. `plans.md`:

- Feature matrix from `plan-features.ts`
- Trial: 14-day Team trial called out

6. Keep prose plain; no emojis; no em dashes.

## Expected behavior

- `cd docs.carinaai.uk && pnpm build` succeeds
- New pages appear in sidebar

## Test

```bash
cd docs.carinaai.uk && pnpm build
```

Link check: internal links resolve in built output.
