# Sprint 2 - Category 08: Scout Completion

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
