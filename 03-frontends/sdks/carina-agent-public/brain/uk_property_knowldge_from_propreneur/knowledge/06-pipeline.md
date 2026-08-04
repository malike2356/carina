# Pipeline (Kanban Deal Board)

**Last updated:** 2026-05-15

## Overview
Kanban-style boards for tracking property deals through stages. Each pipeline has stages (columns), each stage contains deals (cards) that can be moved between columns.

**Feature flag:** `pipeline` (BillingModule::Pipeline)  
**Routes:** `tenant.pipelines.*` (Blade), `tenant.api.pipeline.*` (JSON API)  
**Controllers:** `PipelineController`, `Api\Pipeline\PipelineDealController`, `Api\Pipeline\PipelineStageController`, `Api\Pipeline\PipelineAnalyticsController`  
**Services:** `PipelineService`, `StageTransitionService`, `PipelineAnalyticsService`, `PortfolioPromotionService`

## Models

| Model | Table | Purpose |
|-------|-------|---------|
| `Pipeline` | `pipelines` | Board definition (name, type: sourcing/acquisition/management, is_default) |
| `PipelineStage` | `pipeline_stages` | Column on a board (name, position, colour) |
| `PipelineDeal` | `pipeline_deals` | Card on the board (title, value, stage_id, pipeline_id, deal_analysis_id, contact_id) |

## Blade Routes

| Method | URI | Action |
|--------|-----|--------|
| GET | `/pipelines` | Pipeline list |
| GET | `/pipelines/{pipeline}` | Board view with stages and cards |
| POST | `/pipelines/{pipeline}/deals` | Create card |
| DELETE | `/pipelines/{pipeline}/deals/{deal}` | Delete card |
| PATCH | `/pipelines/{pipeline}/deals/{deal}/move` | Move card between stages |

## JSON API (prefix `/api`)

| Method | URI | Purpose |
|--------|-----|---------|
| GET | `/api/pipelines` | List pipelines |
| POST | `/api/pipelines` | Create pipeline |
| GET | `/api/pipelines/{id}` | Pipeline with stages/deals |
| PUT | `/api/pipelines/{id}` | Update pipeline |
| DELETE | `/api/pipelines/{id}` | Delete pipeline |
| GET | `/api/pipelines/{id}/analytics` | Analytics for pipeline |
| GET | `/api/pipeline-stages` | List stages |
| POST | `/api/pipeline-stages` | Create stage |
| PUT | `/api/pipeline-stages/{id}` | Update stage |
| DELETE | `/api/pipeline-stages/{id}` | Delete stage |
| GET | `/api/pipeline-deals` | List pipeline deals |
| POST | `/api/pipeline-deals` | Create pipeline deal |
| GET | `/api/pipeline-deals/{id}` | Show deal |
| PUT | `/api/pipeline-deals/{id}` | Update deal |
| DELETE | `/api/pipeline-deals/{id}` | Delete deal |
| PATCH | `/api/pipeline-deals/{id}/move` | Move deal between stages |

## Services

**`PipelineService`:** CRUD pipelines and deals, scoped to tenant.

**`StageTransitionService`:** Validates stage transitions, fires `DealStageChanged` event.

**`PipelineAnalyticsService`:** Deal counts by stage, value by stage, average time in stage, conversion rates.

**`PortfolioPromotionService`:** Cross-portfolio promotion of deals across pipelines.

## Events

| Event | Trigger | Listener |
|-------|---------|----------|
| `DealCreated` | Pipeline deal created | `DispatchPipelineWorkspaceAutomations`, `DispatchCommunicationSequenceTriggers` |
| `DealDeleted` | Pipeline deal deleted | - |
| `DealStageChanged` | Deal moved between stages | `DispatchPipelineWorkspaceAutomations`, `DispatchCommunicationSequenceTriggers` |

## Workspace Automation

Pipeline deal events trigger `WorkspaceAutomationRule` evaluations. See `App\Support\Automation\WorkspaceAutomationTriggers`:
- `pipeline.deal_created`
- `pipeline.deal_stage_changed`
- `scheduled.pipeline_deal_stale` (scheduled task)

## Related

- Deals: pipeline deals link to `DealAnalysis`
- CRM: pipeline deals link to `Contact`
- Automation: workspace automation rules fire on pipeline events
- Communications Hub: sequences enrol on stage changes
