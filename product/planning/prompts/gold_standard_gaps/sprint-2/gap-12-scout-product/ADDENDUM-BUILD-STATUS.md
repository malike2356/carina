## ADDENDUM — 2026-06-20: BUILD STATUS

**Overall: 6 FULLY BUILT, 3 PARTIALLY BUILT, 0 NOT BUILT (out of 9 prompts)**

### FULLY BUILT

| Prompt | Source Files |
|--------|-------------|
| **01 Scout Engine Core** | `scan-runner.ts` (153 lines), `scheduler.ts` (131 lines), `finding-processor.ts` (278 lines), `deduplicator.ts` (89 lines), `tools/registry.ts` (380 lines, 25 tools), `db/index.ts`, `db/migrate.ts`, `db/migrations/001-engine-core.sql` |
| **02 Scout Score Engine** | `scout-score.ts` (222 lines: 4-category weighted scoring), `score-job.ts` (79 lines: hourly cron), `db/migrations/002-scout-scores.sql` |
| **03 Scout Dashboard** | `index.html` (1,352 lines SPA), `dashboard.html` (2,526 lines), 12+ widget JS files, `api/attack-surface-dashboard.ts` |
| **04 Alerting Pipeline** | `alerts/rules.ts` (189 lines: 6 default rules), `alerts/delivery.ts` (521 lines: 5 channels), `alerts/digest.ts` (152 lines), suppression/DND APIs, `db/migrations/003-alerts-agents.sql` |
| **05 Agent Monitoring** | `agents/event-ingest.ts` (82 lines: 8 event types), `agents/suspicious-detector.ts` (153 lines: 6 detection patterns) |
| | **Known bug — 2026-06-21:** `dangerous_hours` pattern in `suspicious-detector.ts` uses UTC hours directly against local-time thresholds. Agent activity at 06:20 UTC (07:20 BST) triggers false "unusual hours" alerts every 5 minutes. Fix: apply workspace timezone offset before comparing. Source: live Scout Telegram alerts observed. |
| **06 Reporting Engine** | `reports/generator.ts` (328 lines: Handlebars + Puppeteer PDF), 4 report types, executive + technical |

### PARTIALLY BUILT

| Prompt | Built | Missing |
|--------|-------|---------|
| **07 Scout API** | All functional endpoints (targets, findings, scans, score, assets, agents, alerts, reports, compliance, webhooks) | JWT auth, rate limiting, OpenAPI 3.0/Swagger docs |
| **08 Scout Onboarding** | Fast scan mode (10 tools, ~2 min), account registration pages | Dedicated 5-step wizard UI, live scan progress, "What to do first" guide |
| **09 Scout CLI** | 9 commands: connect, status, pull, investigate, watch, deep-scan, report, score, enable/pair/test | 6 missing subcommands: targets, findings detail, agents, alerts, compliance |

**Scout is a functioning product with a real scanning engine, live dashboard, alert pipeline, and score engine. The gaps are polish (auth, onboarding UX, CLI coverage), not foundation.**
