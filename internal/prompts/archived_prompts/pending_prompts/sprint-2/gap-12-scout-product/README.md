# Gap 12; Scout: The Product Users Want & Need

**Date:** 2026-06-19
**Status:** Prompts written. Implementation pending.
**Scope:** Everything Scout needs to become a product users seek out, subscribe to, and refuse to leave.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Scout currently has a marketing website, a console shell, and architecture documents. It does not have an engine. Users land on labyrinthscout.com, see the vision, and have nothing to connect to. There is no scanning. There is no scoring. There is no alerting. There is no Scout.

This gap closes that. 9 prompts. Every feature users need to want Scout. Every feature users need to stay.

---

## Prompt Index

| # | Prompt | What It Builds | Effort | Why Users Want/Need It |
|---|--------|---------------|--------|----------------------|
| 01 | Scout Engine Core | Continuous scanning engine. 25 automated tools running on schedule. Target registration, scan orchestration, result persistence. | 8 days | Without this, Scout does nothing. This IS Scout. |
| 02 | Scout Score Engine | Real scoring with weighted categories. Historical trends. Score change alerts. Peer comparison baselines. | 3 days | The single number every CISO wants. "Are we getting better or worse?" |
| 03 | Scout Dashboard | Live console with findings table, trend charts, asset inventory, compliance status. Real data from the engine. | 5 days | Where users see what Scout found. Must be fast, filterable, actionable. |
| 04 | Alerting Pipeline | Real-time alerts via email, push, webhook. Severity routing. Alert suppression. Digest mode. | 4 days | Users don't check dashboards. They need Scout to reach them when something breaks. |
| 05 | Agent Monitoring | Connect external agents. Real-time event stream. Policy enforcement. Suspicious behavior detection. | 5 days | Scout's unique value: monitors AI agents, not just servers. No other tool does this. |
| 06 | Reporting Engine | Automated reports. PDF and HTML export. Scheduling. Executive summary + technical appendix. | 3 days | The board needs reports. Auditors need evidence. Scout generates both. |
| 07 | Scout API | REST API for Carina integration and third-party access. Webhooks. API keys. Rate limiting. | 4 days | Carina needs to talk to Scout. Third-party tools need to integrate. The API is the connective tissue. |
| 08 | Scout Onboarding | 5-minute setup wizard. Domain connection. First scan. Initial score. "What to do first" guide. | 3 days | Users who don't complete onboarding churn. Must be dead simple. One domain. One click. First scan. |
| 09 | Scout CLI | `carina scout` commands. Connect, status, scan, report. Full Scout control from terminal. | 2 days | Power users live in the terminal. Scout must be there. |

**Total: 37 build days. ~5 weeks with parallel agents. ~3 weeks calendar time running 3 agents.**

---

## Build Order

```
Phase 1: Foundation (Week 1; run 01, 08, 09 in parallel)
  01-scout-engine-core.md       The engine. Scout becomes real.
  08-scout-onboarding.md        Users can connect domains and start scanning.
  09-scout-cli.md               CLI for power users.

Phase 2: Intelligence (Week 2; depends on 01)
  02-scout-score-engine.md      Scoring on top of scan results.
  05-scout-agent-monitoring.md  Agent connection and monitoring.

Phase 3: Visibility (Week 3; depends on 01, 02)
  03-scout-dashboard.md         Live console with real data.
  04-scout-alerting-pipeline.md Alerts from live scan results.

Phase 4: Output (Week 4; depends on 02, 04)
  06-scout-reporting-engine.md  Reports from scores and findings.
  07-scout-api.md               API for Carina and third parties.
```

---

## What Exists vs. What's New

| Component | Current State | After Gap-12 |
|-----------|--------------|--------------|
| Scanning engine | None | 25 tools, scheduled, continuous |
| Scoring | None | Real-time, weighted, historical |
| Dashboard | Shell (HTML skeleton) | Live data, charts, tables, filters |
| Alerting | None | Email, push, webhook, severity routing |
| Agent monitoring | SDK stubs (3 adapters) | Real connections, event stream, policy engine |
| Reporting | None | Automated, scheduled, PDF/HTML |
| API | None | REST, webhooks, API keys |
| Onboarding | Static pages | Interactive wizard, first scan in 5 minutes |
| CLI | None | `carina scout` full command set |

---

## What Users Get After Gap-12

A CISO visits labyrinthscout.com. They click "Start Free Trial." They enter their domain. Scout begins scanning. Within 5 minutes, they see:

- A Scout Score (their first security baseline)
- Open ports, discovered subdomains, exposed services
- Any CVEs found on their infrastructure
- A "What to do first" prioritized list

They connect their Carina agent. Scout begins monitoring agent tool calls. They see every command their agents run, flagged for suspicious behavior. They set up alerts for critical findings. They schedule a weekly report for their board.

Scout is now a product. Not a marketing site. A product.
