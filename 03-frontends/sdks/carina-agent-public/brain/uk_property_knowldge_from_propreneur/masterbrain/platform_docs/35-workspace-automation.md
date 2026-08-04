# Workspace automation (tenant)

**Last updated:** 2026-05-14 (triggers catalog, comms enrollment action, stale deal schedule)

**Purpose:** Property-native automation rules stored per tenant: when a pipeline trigger fires (or a schedule finds stale deals), run an ordered list of actions (pipeline note, compliance row, webhook, Carina brief, journal draft, comms enrollment).

## Schema

- `workspace_automation_rules` (name, `trigger_key`, optional `conditions` JSON, `actions` JSON, `is_active`, `sort_order`, timestamps).
- `workspace_automation_runs` (`rule_id`, status, context snapshot, result summary, timestamps).

Migration: `database/migrations/tenant/2026_05_02_120000_create_workspace_automation_tables.php`.

## Triggers (catalog)

Defined in `App\Support\Automation\WorkspaceAutomationTriggers` and labels in `WorkspaceAutomationTriggerCatalog`:

| Key | Meaning |
| --- | --- |
| `pipeline.deal_created` | New pipeline card |
| `pipeline.deal_stage_changed` | Card moved stage |
| `scheduled.pipeline_deal_stale` | Card inactive in a non-terminal stage too long (batch job) |

Stale horizon: `config('workspace_automation.stale_stage_days', 14)` (used by the evaluate command).

## Actions (runner)

`App\Services\Automation\WorkspaceAutomationActionRunner` supports `type` values:

| `type` | Role |
| --- | --- |
| `pipeline_activity` | Append pipeline activity / note on `pipeline_deal_id` from context |
| `compliance_item` | Create or update a compliance item from template |
| `integration_webhook` | Dispatch via `WebhookDispatchService` |
| `carina_automation_brief` | Ask `CarinaService` for a short internal brief (no user chat) |
| `journal_draft` | Create accounting journal draft via `JournalPostingService` (actor needs `manage-accounting` where enforced) |
| `communication_enroll` | Enrol deal contact into a sequence via `CommunicationEnrollmentService` (see `31-comms-and-engagement-engine.md`) |

Orchestration: `WorkspaceAutomationOrchestrator`, conditions: `WorkspaceAutomationConditionEvaluator`.

## Tenant UI

**Gates:** `tenant.workspace_admin`, `feature:tenant_workspace_admin_api`.

**Prefix:** `/settings/automation` (`tenant.settings.automation.*`): list rules, paginated runs, CRUD rules, toggle active. Controller: `Tenant\WorkspaceAutomationController`.

## Artisan

| Command | Role |
| --- | --- |
| `php artisan workspace:automation-evaluate-stale-deals` | Cross-tenant scan; enqueues stale trigger for qualifying `pipeline_deals` |
| `php artisan workspace:automation-seed-builtin` | Runs `WorkspaceAutomationBuiltinSeeder` and `CommunicationBuiltinSeeder` on each tenant DB |

## Tests

- `tests/Feature/Automation/WorkspaceAutomationTest.php`
- `tests/Unit/Automation/WorkspaceAutomationConditionEvaluatorTest.php`

## Related knowledge

- `31-comms-and-engagement-engine.md` (`communication_enroll` action and enrollments).
- `22-tenant-route-map.md` (settings route group).
