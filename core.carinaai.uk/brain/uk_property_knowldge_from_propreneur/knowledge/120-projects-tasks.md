# Project Management module

**Last updated:** 2026-05-20
**Module flag:** `project_management`
**Routes:** `/projects` in `routes/tenant-projects.php`  
**Canonical doc:** `brain/knowledge/72-project-management-module.md`

## Overview

Workspace project management for refurbishment, acquisition, development, and general business initiatives. Gated by `BillingModule::ProjectManagement` (`project_management` feature flag).

Distinct from **portfolio refurb projects** (`RefurbishmentProject` under `multi_property`) - see `brain/knowledge/118-property-assets-maintenance.md`. Also distinct from **deal tasks** which are scoped to pipeline deals.

## Data model (tenant DB)

| Table | Purpose |
|-------|---------|
| `projects` | Core record: `title`, `type` (refurb/acquisition/development/general), `status`, `start_date`, `target_completion_date`, `budget_minor`, `actual_cost_minor`, `archived_at`, optional `property_id`, `pipeline_deal_id` |
| `project_tasks` | Kanban tasks: `status` (todo/in_progress/blocked/done), `estimated_cost_minor`, `actual_cost_minor`, optional `milestone_id`, `assigned_to` |
| `project_milestones` | Timeline milestones: `name`, `due_at`, `completed_at`, `sort_order` |
| `project_comments` | Threaded comments on project, optional `task_id` for task-scoped threads |
| `project_documents` | Pivot to `documents` vault |

**Column naming conventions (do not rename):** `title` not `name`; `pipeline_deal_id` not `deal_id`; costs in pence (`_minor` suffix).

## Project types

`refurb`, `acquisition`, `development`, `general` - set on create/edit; filter on index.

## Project statuses

`planning` → `active` → `on_hold` → `completed` → `cancelled`

## Task kanban

Four columns on the project show view: **To Do** / **In Progress** / **Blocked** / **Done**. Tasks ordered by `sort_order`.

- Reorder: `POST /projects/{project}/tasks/reorder` with `task_ids[]`
- Blocked tasks surface in Carina's `list_projects` summary

## Budget rollup

- `projects.budget_minor` set at create/edit (pence)
- Each task may carry `actual_cost_minor`
- `ProjectService::refreshActualCost()` sums task costs into `projects.actual_cost_minor`
- Show page exposes budget vs actual and remaining balance

## Milestones

`ProjectMilestoneController` - all routes scoped under `/projects/{project}/milestones`:

- `POST` - create milestone
- `PUT /{milestone}` - update; pass `complete=1` to mark done
- `DELETE /{milestone}` - destroy

## Comments

`POST /projects/{project}/comments` with `body` and optional `task_id` (scopes comment to a specific task).

## Archive

`POST /projects/{project}/archive` - sets `archived_at`. Archived projects are excluded from the index list but accessible directly.

## Service layer

`App\Services\Projects\ProjectService` - create/update/archive projects, add/update/remove tasks and milestones, post comments, `refreshActualCost()`, `projectStats()`, `reorderTasks()`. Controllers are thin wrappers.

## Carina integration

- Tool: `list_projects` (`App\Services\Carina\Tools\ListProjectsTool`)
- Handler: `ProjectsToolHandler` in `CarinaModuleToolDispatcher`
- Gate: tenant must have `project_management` feature flag enabled
- Returns: project list with completion %, overdue/blocked task counts, budget summary (budget vs actual, remaining)

## Routes summary

```
GET    /projects                              index
GET    /projects/create                       create form
POST   /projects                              store
GET    /projects/{project}                    show (kanban, milestones, comments, budget)
GET    /projects/{project}/edit               edit form
PUT    /projects/{project}                    update
POST   /projects/{project}/archive            archive
POST   /projects/{project}/tasks              add task
PUT    /projects/{project}/tasks/{task}       update task
DELETE /projects/{project}/tasks/{task}       remove task
POST   /projects/{project}/tasks/reorder      reorder tasks
POST   /projects/{project}/milestones         add milestone
PUT    /projects/{project}/milestones/{ms}    update milestone
DELETE /projects/{project}/milestones/{ms}    remove milestone
POST   /projects/{project}/comments           post comment
POST   /projects/{project}/documents          attach vault document
DELETE /projects/{project}/documents/{doc}    detach document
```

## Dashboard

When `project_management` is active, `DashboardController` passes `projectsDashboardSummary` (workspace stats + four recent projects). Rendered via `tenant/dashboard/partials/projects_summary.blade.php`.

## Views

`resources/views/tenant/projects/` - `index`, `create`, `edit`, `show` (kanban board, milestone timeline, comment thread, budget panel).

## Tests

`tests/Feature/Projects/*` - CRUD/archive/soft-delete, tasks/subtasks/move, milestones, budget rollup, document attach/detach.

## Help centre

Section `project-management` in `HelpContentCatalogue` - articles under `resources/docs/help/project-management/`.

## Enable for workspace

Two layers (both required for full access):

1. **Plan entitlement** (drives Settings → Features “on your plan” and toggles):
   - Platform admin → **Subscription plans** → edit the tenant’s plan → tick **Project Management** under modules → save.
   - Or re-seed plans after updating `config/billing.php` module_sets: `php artisan db:seed --class=Database\\Seeders\\Central\\SubscriptionPlanSeeder` (production: run only when intentional; updates plan rows from config).

2. **Feature flag** (route middleware `feature:project_management`):
   - Platform admin → **Feature flags** → **Sync catalogue** (adds keys from `PlatformFeatureCatalogue`), ensure `project_management` is enabled globally or for the tenant override.

3. **User toggle**: tenant admin → **Settings → Features** → turn on Project Management (only possible when `on_plan` is true).

Feature flags alone do **not** remove “Not on your plan” in the Features hub; that badge uses the subscription plan module list only.
