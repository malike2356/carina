<?php

declare(strict_types=1);

use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\User;
use App\Services\Pipeline\PipelineAnalyticsService;
use App\Services\Pipeline\PipelineService;
use App\Services\Pipeline\StageTransitionService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Validation\ValidationException;

it('covers pipeline kanban api services analytics and web board', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Pipeline Full '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pipeline-full.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stages = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->get();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $acting = test()->actingAs($user, 'web');

    $acting->getJson('http://'.$host.'/api/pipeline/stages?pipeline_id='.$pipeline->id)
        ->assertOk()
        ->assertJsonStructure(['data']);

    $c = $acting->postJson('http://'.$host.'/api/pipeline/deals', [
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stages->first()->id,
        'title' => 'Full test deal',
        'deal_value' => 175000,
    ]);
    $c->assertCreated();
    $dealId = $c->json('data.id');

    $stage2 = $stages->skip(1)->first();
    expect($stage2)->not->toBeNull();

    $acting->postJson('http://'.$host.'/api/pipeline/deals/'.$dealId.'/move', [
        'stage_id' => $stage2->id,
    ])->assertOk();

    $acting->getJson('http://'.$host.'/api/pipeline/analytics/velocity')->assertOk();
    $acting->getJson('http://'.$host.'/api/pipeline/analytics/conversion')->assertOk();
    $acting->getJson('http://'.$host.'/api/pipeline/analytics/stage-duration')->assertOk();
    $acting->getJson('http://'.$host.'/api/pipeline/analytics/forecast')->assertOk();

    $ids = $stages->pluck('id')->reverse()->values()->all();
    $acting->postJson('http://'.$host.'/api/pipeline/stages/reorder', [
        'pipeline_id' => $pipeline->id,
        'ids' => $ids,
    ])->assertOk()->assertJson(['ok' => true]);

    $acting->get('http://'.$host.'/pipelines')->assertOk();

    $acting->deleteJson('http://'.$host.'/api/pipeline/deals/'.$dealId)->assertNoContent();

    tenancy()->initialize($tenant);
    $pipeSvc = app(PipelineService::class);
    $deal = $pipeSvc->createDeal([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stages->first()->id,
        'title' => 'Svc deal',
    ], $user);
    expect($deal->fresh()->activities)->not->toBeEmpty();

    $badIds = $stages->take($stages->count() - 1)->pluck('id')->all();
    expect(fn () => $pipeSvc->reorderStages($pipeline->id, $badIds))
        ->toThrow(ValidationException::class);

    $other = Pipeline::query()->create([
        'name' => 'Other PL',
        'type' => 'sourcing',
        'is_default' => false,
        'created_by' => $user->id,
    ]);
    $foreignStage = PipelineStage::query()->create([
        'pipeline_id' => $other->id,
        'name' => 'Foreign',
        'position' => 0,
        'color' => '#111111',
        'is_won' => false,
        'is_lost' => false,
    ]);

    $homeStage = $stages->first();
    $cross = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $homeStage->id,
        'title' => 'Cross',
        'position' => 0,
        'created_by' => $user->id,
        'priority' => 'medium',
    ]);
    expect(fn () => app(StageTransitionService::class)->validateTransition($cross, $foreignStage))
        ->toThrow(ValidationException::class);

    $target = $stages->skip(1)->first();
    $target->update(['required_fields' => ['property_id']]);
    $bare = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $homeStage->id,
        'title' => 'Bare',
        'position' => 1,
        'created_by' => $user->id,
        'priority' => 'medium',
    ]);
    expect(fn () => app(StageTransitionService::class)->validateTransition($bare, $target, []))
        ->toThrow(ValidationException::class);
    app(StageTransitionService::class)->validateTransition($bare, $target, ['property_id' => 1]);

    $analytics = app(PipelineAnalyticsService::class);
    expect($analytics->calculateVelocity(4))->toHaveKey('moves_per_week');
    expect($analytics->calculateConversionRate())->toHaveKey('conversion_rate');

    tenancy()->end();
});
