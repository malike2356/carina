# Platform tenant CRM (Accounts)

**Last updated:** 2026-06-15

## Overview

Platform **Accounts** at `/admin/accounts` (alias: `/admin/tenant-crm`) is the internal account operating layer for Propreneur SaaS ops. It is not a generic CRM and not the tenant-side property CRM.

Use it for:

- Lifecycle and health monitoring per workspace
- Follow-up tasks with owners and due dates
- Admin notes and outreach history
- Support ticket context on the account page
- Retention and expansion recommendations

Requires platform permission `view-platform-accounts` (read) or `manage-platform-accounts` (write tasks, notes, stage changes). Separate from `view-saas-tenants` / `manage-saas-tenants` (workspace provisioning).

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/accounts` | All accounts list with filters (canonical) |
| `/admin/accounts/queue` | Open follow-up task queue |
| `/admin/accounts/analytics` | Usage aggregates and recommendations |
| `/admin/accounts/{tenant}` | Single account detail, timeline, tasks |

Legacy alias: same paths under `/admin/tenant-crm` with route names `admin.tenant-crm.*`.

Related: `/admin/saas-tenancy` (provisioning and technical workspace edit).

## Lifecycle stages

Stored on `tenant_account_profiles.lifecycle_stage`:

- `lead`, `trial`, `onboarding`, `active`, `at_risk`, `renewal`, `churned`

Auto-sync runs from tenant state via `TenantAccountProfileService::syncLifecycleFromTenant()`. Manual override via account detail form writes stage history.

## Health and inferred status

`TenantHealthInferenceService` computes:

- `health_score` (0-100)
- `health_status`: healthy, watch, at_risk, critical
- `inferred_status`: dormant, onboarding_stalled, at_risk, expansion_candidate, healthy, power_user, etc.
- `risk_flags` JSON on the profile

Scheduled: `tenant-crm:compute-health` daily at 03:00.

## Activity and timeline

`tenant_activity_events` captures logins, deals, Carina usage, onboarding, exports, and more via `TenantActivityEventService`.

Timeline on the account page merges activity, notes, outreach, stage changes, and completed tasks (`TenantCrmTimelineService`).

## Follow-up tasks

Table: `tenant_follow_up_tasks`

- Manual tasks from the account page
- Inferred tasks from recommendations
- Automated tasks from `tenant-crm:generate-auto-tasks` (daily 08:00) with dedupe via `automation_key`

## Waitlist linkage

`tenants.waitlist_entry_id` links a provisioned workspace to a confirmed waitlist entry when owner email matches (`WaitlistTenantLinkService`, runs on tenant create).

## Platform Carina tools

| Tool | Purpose |
|------|---------|
| `platform_list_accounts_queue` | Filtered account list with health context |
| `platform_get_account_summary` | One account operational summary |
| `platform_get_account_timeline` | Recent timeline events |

## Ops digest email

Command: `tenant-crm:send-ops-digest`

Schedule: weekdays 07:45 (after health compute, before auto-tasks).

Recipients: active platform users with `view-platform-accounts` or `manage-platform-accounts`.

Opt-in sources (union):

1. Profile checkbox on `/admin/profile` (`tenant_crm_ops_digest_opt_in` on `platform_users`).
2. Env allowlist `TENANT_CRM_OPS_DIGEST_OPT_IN_USER_IDS` as JSON, e.g. `[1,4]`.

When neither source lists anyone, all eligible users receive the digest (legacy default).

Disable: `TENANT_CRM_OPS_DIGEST=false`.

Dry run: `php artisan tenant-crm:send-ops-digest --dry-run --user=1`

## Scheduled commands summary

| Command | Schedule |
|---------|----------|
| `tenant-crm:aggregate-usage` | Daily 02:30 |
| `tenant-crm:compute-health` | Daily 03:00 |
| `tenant-crm:send-ops-digest` | Weekdays 07:45 |
| `tenant-crm:generate-auto-tasks` | Daily 08:00 |

## Config

File: `config/tenant_crm.php`

- `auto_tasks.enabled` / `TENANT_CRM_AUTO_TASKS`
- `ops_digest.enabled` / `TENANT_CRM_OPS_DIGEST`
- `ops_digest.opt_in_user_ids` / `TENANT_CRM_OPS_DIGEST_OPT_IN_USER_IDS`

## Rollout checklist

1. Run central migrations (includes `tenant_crm` tables and `waitlist_entry_id`).
2. Ensure `saas_tenant_management` feature flag is on.
3. Grant `view-platform-accounts` / `manage-platform-accounts` to ops roles (support: view only; admin: both).
4. Confirm scheduler runs health, digest, and auto-task commands.
5. Smoke test `/admin/tenant-crm` and one account detail page.
