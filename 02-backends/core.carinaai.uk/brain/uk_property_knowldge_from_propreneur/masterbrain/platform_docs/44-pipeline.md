# Pipeline (Kanban Deal Board)

## Shipped implementation (2026-05-02)

- **Web UI:** `tenant.pipelines.*` on the tenant host. Blade board under `resources/views/tenant/pipeline/`. Cards are `PipelineDeal` rows (table `pipeline_deals`). Drag-and-drop PATCHes `tenant.pipelines.deals.move` with JSON `{ "stage_id": N }`.
- **JSON API:** `routes/tenant/pipeline_api.php` (required from `routes/tenant.php`). Prefix `/api/pipeline` (names `tenant.api.pipeline.*`). Gated by `subscription.feature:pipeline` and `feature:pipeline`. Controllers: `App\Http\Controllers\Api\Pipeline\PipelineStageController`, `PipelineDealController`, `PipelineAnalyticsController`.
- **Services:** `App\Services\Pipeline\PipelineService`, `PipelineAnalyticsService`, `StageTransitionService`. Events: `App\Events\Tenant\Pipeline\DealCreated`, `DealStageChanged`, `DealDeleted`.
- **Tenant tables:** `pipelines`, `pipeline_stages` (optional `tenant_id`, `required_fields` JSON, `is_default`), `pipeline_deals` (was `pipeline_items`; columns include `stage_id`, `deal_value`, `expected_completion`, `notes` JSONB, `entered_stage_at`, `description`), `pipeline_activities` (stage change audit).
- **Default stages (bootstrap):** Lead, Viewing, Offer, Under Offer, Exchanged, Completed (won), Lost. Migration `2026_05_02_450000_pipeline_kanban_deals_and_activities.php` renames items to deals and adds activities.
- **Tests:** `tests/Feature/Pipeline/PipelineControllerTest.php` (API, analytics, reorder, board, services, transitions).

## Overview
The Pipeline module provides a kanban-style board for tracking deals through stages. Each pipeline is a collection of stages (columns), and each stage contains deals (cards) that can be dragged between columns. This mirrors deal progression through acquisition stages.

**Web routes:** `tenant.pipelines.*`  
**Web controller:** `App\Http\Controllers\Tenant\PipelineController`  
**Models:** `Pipeline`, `PipelineStage`, `PipelineDeal`, `PipelineActivity` (`App\Models\Tenant`)

## Web routes (tenant host)

| Method | URI | Name |
|--------|-----|------|
| GET | `/pipelines` | `tenant.pipelines.index` |
| GET | `/pipelines/{pipeline}` | `tenant.pipelines.show` |
| POST | `/pipelines/{pipeline}/deals` | `tenant.pipelines.deals.store` |
| PATCH | `/pipelines/{pipeline}/deals/{deal}/move` | `tenant.pipelines.deals.move` |
| DELETE | `/pipelines/{pipeline}/deals/{deal}` | `tenant.pipelines.deals.destroy` |

## JSON API (`/api/pipeline`)

| Method | URI | Name |
|--------|-----|------|
| GET | `/api/pipeline/stages` | `tenant.api.pipeline.stages.index` |
| POST | `/api/pipeline/stages` | `tenant.api.pipeline.stages.store` |
| POST | `/api/pipeline/stages/reorder` | `tenant.api.pipeline.stages.reorder` |
| PUT | `/api/pipeline/stages/{stage}` | `tenant.api.pipeline.stages.update` |
| DELETE | `/api/pipeline/stages/{stage}` | `tenant.api.pipeline.stages.destroy` |
| GET | `/api/pipeline/deals` | `tenant.api.pipeline.deals.index` |
| POST | `/api/pipeline/deals` | `tenant.api.pipeline.deals.store` |
| GET | `/api/pipeline/deals/{deal}` | `tenant.api.pipeline.deals.show` |
| PUT | `/api/pipeline/deals/{deal}` | `tenant.api.pipeline.deals.update` |
| DELETE | `/api/pipeline/deals/{deal}` | `tenant.api.pipeline.deals.destroy` |
| POST | `/api/pipeline/deals/{deal}/move` | `tenant.api.pipeline.deals.move` |
| POST | `/api/pipeline/deals/bulk-move` | `tenant.api.pipeline.deals.bulk-move` |
| GET | `/api/pipeline/analytics/velocity` | `tenant.api.pipeline.analytics.velocity` |
| GET | `/api/pipeline/analytics/conversion` | `tenant.api.pipeline.analytics.conversion` |
| GET | `/api/pipeline/analytics/stage-duration` | `tenant.api.pipeline.analytics.stage-duration` |
| GET | `/api/pipeline/analytics/forecast` | `tenant.api.pipeline.analytics.forecast` |

## Models

### Pipeline

```php
class Pipeline extends Model
{
    public function stages()  // hasMany(PipelineStage::class)
    public function deals()   // hasManyThrough(PipelineDeal::class, PipelineStage::class)
}
```

### PipelineStage

```php
class PipelineStage extends Model
{
    // position = column order; required_fields JSON lists keys required before entering stage
    public function deals()   // hasMany(PipelineDeal::class, 'stage_id')
}
```

### PipelineDeal (table `pipeline_deals`)

Kanban card: `stage_id`, `title`, `description`, `deal_value`, `expected_completion`, `notes` (JSON), `entered_stage_at`, `property_id`, `contact_id`, `position`, `created_by`. Accessor `days_in_current_stage`. Activity log via `PipelineActivity`.

### PipelineActivity

Rows for `created` and `moved` actions with `from_stage` / `to_stage` labels and optional `metadata` JSON.

## Pipeline Board View (`_board.blade.php`)

This partial renders the kanban board. It's included by both `index.blade.php` and `show.blade.php`.

**Structure:**

**UI note (2026-05-01):** Production kanban should use **semantic** utilities (`bg-muted`, `border-border`, `text-muted-foreground`, etc.) from the token layer so dark mode stays readable (`brain/knowledge/12-ui-components.md`, `resources/views/components/portal/kanban-board.blade.php`). The snippet uses legacy `gray-*` classes as a structural sketch only.

```html
<div class="grid grid-cols-1 lg:grid-cols-N gap-4 overflow-x-auto pb-4">
    @foreach ($pipeline->stages->sortBy('position') as $stage)
        <div class="bg-gray-50 rounded-xl border border-gray-200 p-3 min-w-[240px]"
             data-stage-id="{{ $stage->id }}">
            
            <!-- Stage header: colored dot + name + item count -->
            <div class="flex items-center justify-between mb-3">
                <span class="w-2.5 h-2.5 rounded-full" style="background: {{ $stage->color }}"></span>
                <span class="text-sm font-semibold">{{ $stage->name }}</span>
                <span class="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    {{ $stage->items->count() }}
                </span>
            </div>
            
            <!-- Cards -->
            <div class="flex-1 space-y-2 min-h-[80px]">
                @forelse ($stage->items as $item)
                    <div class="bg-white rounded-lg border p-3 shadow-sm"
                         draggable="true" data-item-id="{{ $item->id }}">
                        <p class="text-sm font-medium">{{ $item->title }}</p>
                        @if ($item->value)
                            <p class="text-xs text-gray-500 mt-1">£{{ number_format($item->value) }}</p>
                        @endif
                        @if ($item->expected_close_date)
                            <p class="text-xs text-gray-400 mt-0.5">Close: {{ $item->expected_close_date->format('d M') }}</p>
                        @endif
                    </div>
                @empty
                    <div class="text-xs text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                        Drop items here
                    </div>
                @endforelse
            </div>
        </div>
    @endforeach
</div>
```

## Default Pipeline Stages (Deal Acquisition)

| Stage | Color | Description |
|-------|-------|-------------|
| Lead | `#6B7280` (gray) | Initial inquiry / lead |
| Viewing | `#3B82F6` (blue) | Property viewing scheduled/complete |
| Offer | `#F59E0B` (amber) | Offer made, awaiting response |
| Negotiation | `#8B5CF6` (purple) | Price/terms under negotiation |
| Due Diligence | `#EC4899` (pink) | Surveys, searches, legal checks |
| Exchange | `#10B981` (green) | Contracts exchanged |
| Completion | `#14B8A6` (teal) | Deal completed / keys handed over |

## Drag-and-Drop

The board implements drag-and-drop via:
1. HTML5 `draggable="true"` on cards
2. JavaScript drag/drop event handlers (in layout or dedicated JS)
3. PATCH request to `tenant.pipelines.deals.move` with JSON `{ "stage_id": N }` on drop

The move endpoint updates the deal's `stage_id` and refreshes `entered_stage_at`. Use `/api/pipeline/deals/{id}/move` from SPA clients.

## Related

- Deals: items can link to DealAnalysis for full financial details
- Contacts: items can link to a contact (e.g., vendor, agent)
- Properties: items can link to the property under consideration
- Dashboard: active pipeline item count displayed in Command Centre