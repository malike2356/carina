# Scout Bundling and AI Employee: Gap Analysis

**Status: COMPLETED 2026-07-19**

**What was built:** Gap tracker archived. Remaining seat-price SoT item tracked under launch readiness.


Status date: 2026-06-30

This document maps each acceptance criterion from `scout-bundling-and-ai-employee.md` to implementation files and remaining work.

## Naming alignment (workers vs employees)

| Spec term | Code term | UI term |
| --- | --- | --- |
| AI Employee | `ai_workers` table, `/api/aiva/workers` | "AI Employees" in nav and list headings |
| Employee task log | `ai_worker_activity`, `worker_email_approvals` | Activity tab + Approval inbox |
| Employee approvals | `worker_email_approvals` | `/aiva/approvals` |

Routes and database tables keep `worker` identifiers for backward compatibility. Product copy uses "AI Employee".

---

## Part 1: Scout bundling

| Criterion | Status | Primary files | Notes |
| --- | --- | --- | --- |
| Paid subscription triggers Scout provisioning | Done (SaaS path) | `aiva-stripe-events.ts`, `aiva-scout-provisioning.ts` | Runs on Stripe `checkout.session.completed` |
| Keys server triggers Scout on activation | Done (scaffold) | `carina/keys-server/app/api/webhooks.py`, `app/api/scout.py` | Calls Scout internal provision API; notify core via `AIVA_CORE_WEBHOOK_URL` |
| Scout credentials stored within 60s | Partial | `aiva-scout-store.ts` | Encrypted with `CHANNEL_CREDENTIAL_KEY`; retry scheduler handles slow Scout API |
| Scout pending does not block Aiva | Done | `aiva-scout-provisioning.ts` | `scout_status=pending`, workspace remains usable |
| Governance section in sidebar | Done | `GovernanceSidebarCard.tsx`, `workspace-nav.ts`, `/aiva/governance` | |
| Scout status indicator (green/amber/red) | Done | `GovernanceSidebarCard.tsx`, `GET /api/aiva/scout/governance` | |
| Open Scout dashboard link | Done | `aiva-scout-store.ts` (dashboard URL), governance UI | |
| Kill switch suspends employee, queues triggers | Done | `scout-worker-killswitch.ts`, `kill-switch-listener.ts`, `worker_pending_triggers` | Poll skipped while suspended; triggers queued on inbound path |
| Owner notified within 60s of kill switch | Done | `scout-worker-killswitch.ts` | Email via Resend |
| Scout event queue drains after outage | Done | `scout-event-queue.ts`, `aiva-scout-schedulers.ts` | |
| Heartbeat every 60 seconds | Done | `aiva-scout-schedulers.ts` | Cron every minute per connected workspace |

---

## Part 2: AI Employee / Email Handler MVP

| Criterion | Status | Primary files | Notes |
| --- | --- | --- | --- |
| Create Email Handler with persona + IMAP | Existing | `aiva-email-api.ts`, worker hire flow | Connect IMAP on worker detail |
| IMAP poll every 5 minutes | Done | `email-poll-config.ts` (`*/5 * * * *`) | |
| Categorise email (client/invoice/spam/urgent) | Done | `email-categorizer.ts`, `email-poller.ts` | |
| Draft client query responses | Done | `email-draft-handler.ts` | Uses `processAivaMessage` with template fallback |
| Approval inbox with subject/body/recipient | Done | `/aiva/approvals`, `aiva-email-approval-api.ts` | |
| Approve / Reject / Edit then Approve | Done | `EmailApprovalInboxClient.tsx`, approval API | |
| Send on approve + Scout event | Done | `email-draft-handler.ts`, `scout-event-queue.ts` | Resend for outbound (not worker SMTP yet) |
| 4-hour timeout, no auto-send | Done | `approval-timeout-scheduler.ts`, `worker_email_approvals.timeout_at` | |
| Mandatory Scout enrollment at creation | Existing | `scout-fleet.ts` `registerAivaAgent` | On worker create |
| Base plan includes 2 employees | Done | `aiva-tier.ts` `slotLimitForTier('starter') => 2` | |
| 3rd employee billing modal | Partial | `AivaWorkersClient.tsx`, billing status API | Slot limit enforced; dedicated modal copy still TODO |
| End-to-end session test | Manual | QA checklist below | Requires live IMAP + Resend |

---

## Keys server wiring

| Component | Path |
| --- | --- |
| Scout provision API (spec-shaped) | `POST /api/v1/scout/workspaces/provision` |
| Stripe webhook | `POST /api/v1/webhooks/stripe` |
| Scout upstream | `SCOUT_PROVISION_URL` (Scout `/api/internal/provision-tenant`) |
| Core callback | `AIVA_CORE_WEBHOOK_URL` -> `POST /api/aiva/scout/provision` |

---

## Manual QA checklist

1. Stripe test checkout for Aiva Starter; confirm `aiva_subscriptions.scout_status` becomes `connected` or `pending`.
2. Create AI Employee, connect IMAP, add allowed sender, send test client query email.
3. Confirm draft appears in `/aiva/approvals`; approve and verify Resend send in logs.
4. Wait or force `timeout_at`; confirm status `timeout` and no send.
5. From Scout console, suspend worker by `instance_id` = worker UUID; confirm `suspended_by_scout` and queued triggers.
6. Resume worker; confirm poll catches up.

---

## Remaining follow-ups

- Worker SMTP send using mailbox credentials (spec says SMTP; MVP uses Resend).
- Dedicated billing modal when hiring employee #3 (Stripe seat product).
- Keys server full schema from `BUILD_PROMPT.md` (validation, JWT, portal UI).
- Simulated approval item in onboarding flow (`aiva-launch-readiness.md` Section 6).
- Unit tests for `email-categorizer`, approval timeout, scout retry backoff.
