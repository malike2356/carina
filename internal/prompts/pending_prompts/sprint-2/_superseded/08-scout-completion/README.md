# Sprint 2 - Category 08: Scout Completion


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## What Exists

- `console.labyrinthscout.com/` - Scout server with trust API, account system, dashboard HTML
- `src/security/scout-client.ts` - Carina sends events to Scout
- `console.labyrinthscout.com/src/middleware/plan-gate.ts` - Plan-gated endpoints
- Basic dashboard with fleet widget

## What Is Missing

- Complete risk scoring algorithm (CVSS-based, with asset value weighting)
- Full dashboard UI (charts, history, real-time event feed)
- Alerting and notification system (email, Slack, SMS for critical events)
- Reporting system (PDF/CSV exports, scheduled digests)
- Public REST API with API key auth for external integrations
- Onboarding flow and CLI setup wizard

## Prompts in This Category

- `01-risk-scoring.md` - CVSS-based risk score with asset weighting and trend tracking
- `02-full-dashboard-ui.md` - Charts, live event feed, history, severity breakdown
- `03-alerting-notifications.md` - Email, Slack, SMS alerts for configurable severity levels
- `04-reporting-system.md` - PDF/CSV exports and scheduled email digests
- `05-public-api.md` - REST API with API key auth, webhook support, rate limiting
- `06-onboarding-cli.md` - First-run wizard, CLI `carina scout setup` command

## Original Reference

`sprint-2/gap-12-scout-product/`
