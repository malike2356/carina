# Project Management module (Prompt 103)

**Module flag:** `project_management`  
**Routes:** `routes/tenant-projects.php` (included from `routes/tenant.php`)  
**Service:** `App\Services\Projects\ProjectService`

## Overview

Multi-tenant boards for refurbishment, acquisition, development, and general initiatives. Optional links to `properties` and `pipeline_deals`. Distinct from portfolio `RefurbishmentProject` records and pipeline deal tasks.

## Project types & statuses

| Types | `refurb`, `acquisition`, `development`, `general` |
| Statuses | `planning`, `active`, `on_hold`, `completed`, `cancelled` |
| Priorities | `low`, `medium`, `high`, `critical` |

Legacy DB values `in_progress` / `complete` are migrated to `active` / `completed` on upgrade.

## Task board

Kanban columns: **todo**, **in_progress**, **blocked**, **done**, **cancelled**. Drag-and-drop between columns (`POST …/tasks/{task}/move`). Subtasks via `parent_task_id`. Assignees via `assigned_to_user_id` (syncs display name to `assigned_to`).

## Budget

- Project `budget_minor` + `budget_currency` (default GBP)
- Task `cost_minor` rolls into `projects.actual_cost_minor`
- Show page: budget vs actual vs remaining

## Milestones

Horizontal timeline on project show. `POST/PUT/DELETE` under `/projects/{project}/milestones`. Mark complete with `complete=1` on update.

## Documents

- Link existing vault files (`documents.attach` / `detach`)
- Upload on project page (`documents.upload`) - stores in vault and links pivot

## Carina

- Tool: `list_projects` (`ListProjectsTool` + `ProjectsToolHandler`)
- Baseline context: active project summary appended in `CarinaBaselineContextService::projectsAppendix()` when flag enabled

## Dashboard

`projectsDashboardSummary` on tenant dashboard when module active (`tenant/dashboard/partials/projects_summary.blade.php`).

## Tests

`tests/Feature/Projects/` - `ProjectCrudTest`, `ProjectTaskTest`, `ProjectMilestoneTest`, `ProjectBudgetTest`, `ProjectDocumentTest`.

## Enable

Platform admin → Feature flags → `project_management`, or `php artisan platform:sync-feature-flags`.
