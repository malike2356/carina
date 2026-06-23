# Sprint 4 - Master Build Index

**Last updated:** 2026-06-23
**Status:** Ready to build - 28 prompts across 7 phases

---

## What this sprint builds

The complete Aiva platform end-to-end: infrastructure, the Aiva product itself, all channel
adapters, the web chat widget, billing, the backend admin dashboard, and the supporting
subsystems (email, usage limits, conversations, GDPR, business plan features).

"Aiva" is the VERLOX brand name for an AI worker (Artificially Intelligent Virtual Assistant).
The tagline is: "Your Aiva, from VERLOX. Powered by Carina."

---

## Execution order

Files are numbered 01 through 28 in build order. The number IS the sequence.
Run phases in order. Within a phase, items marked "parallel" can run at the same time.

---

### Phase 1: Infrastructure
*Build these first. Every later phase depends on working deploy scripts and a stable server.*

| # | File | Agent | Hours | Run |
|---|------|-------|-------|-----|
| 01 | `01-deploy-scripts.md` | Claude Code | 6-8 h | first |
| 02 | `02-security-hardening.md` | Claude Code | 8-10 h | after 01 |
| 03 | `03-backups-and-restore.md` | Claude Code | 4-6 h | after 01, parallel with 02 |
| 04 | `04-monitoring-and-ops.md` | Claude Code | 6-8 h | after 01, parallel with 02-03 |
| 05 | `05-pgbouncer-connection-pooling.md` | Claude Code | 3-4 h | after 01 |
| 06 | `06-staging-environment.md` | Claude Code | 4-5 h | after 01 |

**Parallel groups in Phase 1:**
- 01 alone first
- Then 02, 03, 04, 05, 06 all in parallel

---

### Phase 2: Core Aiva product
*The Aiva hire flow, worker brain, onboarding wizard, and transactional email stack.*

| # | File | Agent | Hours | Run |
|---|------|-------|-------|-----|
| 07 | `07-aiva-landing-page.md` | Codex | 3-4 h | parallel with 08 |
| 08 | `08-worker-brain.md` | Claude Code | 10-14 h | first in this phase |
| 09 | `09-onboarding-and-first-launch.md` | Cursor | 6-8 h | after 08 |
| 10 | `10-worker-portal-ui.md` | Cursor | 8-10 h | after 08 |
| 11 | `11-transactional-email-system.md` | Claude Code + Cursor | 8-10 h | parallel with 09 and 10 |

**Parallel groups in Phase 2:**
- 07 and 08 in parallel
- After 08: 09, 10, 11 all in parallel

---

### Phase 3: Channel adapters and web widget
*Aiva can now receive and send messages via WhatsApp, Email, Slack, Telegram, and the web widget.*

| # | File | Agent | Hours | Run |
|---|------|-------|-------|-----|
| 12 | `12-channel-infrastructure.md` | Claude Code | 8-10 h | first in this phase (after 08) |
| 13 | `13-whatsapp-adapter.md` | Claude Code | 6-8 h | after 12, parallel with 14-17 |
| 14 | `14-email-channel-adapter.md` | Claude Code | 5-6 h | after 12, parallel with 13,15-17 |
| 15 | `15-slack-adapter.md` | Claude Code | 5-6 h | after 12, parallel with 13-14,16-17 |
| 16 | `16-telegram-adapter.md` | Claude Code | 3-4 h | after 12, parallel with 13-15,17 |
| 17 | `17-web-chat-widget.md` | Claude Code + Cursor | 8-10 h | after 12, parallel with 13-16 |

**Parallel groups in Phase 3:**
- 12 alone first
- Then 13, 14, 15, 16, 17 all in parallel

---

### Phase 4: Feature completeness
*VA reply interface, usage caps, conversation view, analytics, and GDPR compliance.*

| # | File | Agent | Hours | Run |
|---|------|-------|-------|-----|
| 18 | `18-va-response-interface.md` | Cursor + Claude Code | 4-5 h | after 12 (needs channel adapters) |
| 19 | `19-usage-limits-per-tier.md` | Claude Code | 5-6 h | after 08 + 11 (needs brain + email) |
| 20 | `20-conversation-view-and-analytics.md` | Cursor | 8-10 h | after 10 (needs portal) |
| 21 | `21-gdpr-privacy-cookies.md` | Cursor + Claude Code | 8-10 h | independent; run in parallel |

**Parallel groups in Phase 4:**
- 18, 19, 20, 21 all in parallel (check dependencies above)

---

### Phase 5: Billing
*Stripe subscriptions per workspace, billing UI, plan gates, and upgrade flows.*

| # | File | Agent | Hours | Run |
|---|------|-------|-------|-----|
| 22 | `22-billing-backend.md` | Claude Code | 8-10 h | first in this phase (after 08) |
| 23 | `23-billing-ui.md` | Cursor | 6-8 h | after 22 |
| 24 | `24-billing-plan-gates.md` | Claude Code + Cursor | 6-8 h | after 22 |

**Parallel groups in Phase 5:**
- 22 alone first
- Then 23 and 24 in parallel

---

### Phase 6: Admin dashboard
*Standalone Next.js app at admin.carinaai.uk: customer management, fleet monitoring, VA queue.*

| # | File | Agent | Hours | Run |
|---|------|-------|-------|-----|
| 25 | `25-admin-auth-and-customers.md` | Claude Code + Cursor | 10-14 h | first in this phase (after 22) |
| 26 | `26-admin-fleet-dashboard.md` | Claude Code + Cursor | 8-12 h | after 25, parallel with 27 |
| 27 | `27-admin-va-queue-revenue.md` | Claude Code + Cursor | 10-14 h | after 25, parallel with 26 |

**Parallel groups in Phase 6:**
- 25 alone first
- Then 26 and 27 in parallel

---

### Phase 7: Business plan features
*White-label widget, custom knowledge base training, custom Scout governance rules.*

| # | File | Agent | Hours | Run |
|---|------|-------|-------|-----|
| 28 | `28-business-plan-features.md` | Cursor + Claude Code | 12-16 h | after 22 (billing) + 08 (brain) |

---

## Full sequence at a glance

```
Phase 1: Infrastructure
  01  deploy-scripts
  02  security-hardening        (parallel with 03, 04, 05, 06)
  03  backups-and-restore        (parallel with 02, 04, 05, 06)
  04  monitoring-and-ops         (parallel with 02, 03, 05, 06)
  05  pgbouncer                  (parallel with 02, 03, 04, 06)
  06  staging-environment        (parallel with 02, 03, 04, 05)

Phase 2: Core Aiva product
  07  aiva-landing-page          (parallel with 08)
  08  worker-brain               (parallel with 07)
  09  onboarding-wizard          (after 08; parallel with 10, 11)
  10  worker-portal-ui           (after 08; parallel with 09, 11)
  11  transactional-email        (after 08; parallel with 09, 10)

Phase 3: Channels
  12  channel-infrastructure     (after 08)
  13  whatsapp-adapter           (after 12; parallel with 14-17)
  14  email-channel-adapter      (after 12; parallel with 13,15-17)
  15  slack-adapter              (after 12; parallel with 13-14,16-17)
  16  telegram-adapter           (after 12; parallel with 13-15,17)
  17  web-chat-widget            (after 12; parallel with 13-16)

Phase 4: Feature completeness
  18  va-response-interface      (after 12)
  19  usage-limits               (after 08 + 11)
  20  conversation-view          (after 10)
  21  gdpr-privacy-cookies       (independent)

Phase 5: Billing
  22  billing-backend            (after 08)
  23  billing-ui                 (after 22; parallel with 24)
  24  billing-plan-gates         (after 22; parallel with 23)

Phase 6: Admin dashboard
  25  admin-auth-and-customers   (after 22)
  26  admin-fleet-dashboard      (after 25; parallel with 27)
  27  admin-va-queue-revenue     (after 25; parallel with 26)

Phase 7: Business plan
  28  business-plan-features     (after 22 + 08)
```

---

## Time estimates

| Phase | Prompts | Sequential hours | Parallel hours (approx) |
|-------|---------|-----------------|-------------------------|
| 1 - Infrastructure | 6 | 31-41 h | 14-18 h |
| 2 - Core product | 5 | 35-46 h | 18-24 h |
| 3 - Channels | 6 | 35-44 h | 16-20 h |
| 4 - Features | 4 | 25-31 h | 10-12 h |
| 5 - Billing | 3 | 20-26 h | 14-18 h |
| 6 - Admin | 3 | 28-40 h | 20-28 h |
| 7 - Business plan | 1 | 12-16 h | 12-16 h |
| **Total** | **28** | **186-244 h** | **~104-136 h** |

---

## Agent key

| Agent | Best for |
|-------|----------|
| Claude Code | Backend TypeScript, APIs, DB migrations, infrastructure scripts |
| Cursor | React/Next.js UI, component work, wizard flows |
| Codex | Static HTML/CSS pages following existing site patterns |

---

## What is NOT in this sprint

- Third-party CRM/helpdesk integrations (post-launch)
- Mobile apps (post-launch)
- Multi-language Aiva personas (post-launch)
- Enterprise SSO (post-launch)

---

## Planning docs

Background product strategy and phased rollout notes are in `../plan/`:
- `../plan/CARINA_AI_EMPLOYEE_PLAN.md`
- `../plan/ai_va_planning.md`
