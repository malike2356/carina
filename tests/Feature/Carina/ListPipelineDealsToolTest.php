<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\Tools\ListPipelineDealsTool;
use App\Services\Tenancy\TenantCreationService;
use Carbon\Carbon;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

function makeStaleDealsTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Stale deals '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'stale-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $pipeline = Pipeline::query()->create([
        'name' => 'Sourcing',
        'type' => 'sourcing',
        'created_by' => $user->id,
    ]);

    $activeStage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Negotiating',
        'position' => 1,
        'is_won' => false,
        'is_lost' => false,
    ]);

    $wonStage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Completed',
        'position' => 2,
        'is_won' => true,
        'is_lost' => false,
    ]);

    return [$tenant, $user, $pipeline, $activeStage, $wonStage];
}

function makeDealWithUpdatedAt(int $pipelineId, int $stageId, int $userId, string $title, Carbon $updatedAt): PipelineDeal
{
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipelineId,
        'stage_id' => $stageId,
        'title' => $title,
        'created_by' => $userId,
    ]);

    $deal->forceFill([
        'updated_at' => $updatedAt,
        'entered_stage_at' => $updatedAt,
    ])->saveQuietly();

    return $deal;
}

it('returns a registered list_pipeline_deals tool authorised for tenant admins', function (): void {
    [$tenant, $user] = makeStaleDealsTenant();
    $user->syncRoles(['tenant_admin']);

    $tool = app(CarinaToolRegistry::class)->find('list_pipeline_deals');

    expect($tool)->toBeInstanceOf(ListPipelineDealsTool::class);
    expect($tool->authorize($user))->toBeTrue();

    tenancy()->end();
});

it('flags deals older than the stale threshold and returns stale_count', function (): void {
    [$tenant, $user, $pipeline, $activeStage] = makeStaleDealsTenant();

    $stale = makeDealWithUpdatedAt(
        $pipeline->id,
        $activeStage->id,
        $user->id,
        '15 Stale Avenue',
        now()->subDays(30),
    );

    $fresh = makeDealWithUpdatedAt(
        $pipeline->id,
        $activeStage->id,
        $user->id,
        '7 Fresh Street',
        now()->subDays(2),
    );

    $tool = app(ListPipelineDealsTool::class);
    $conv = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Stale test',
    ]);

    $result = $tool->execute(['stale_days_threshold' => 14], $user, $conv);

    expect($result->success)->toBeTrue();
    expect($result->data['total_scanned'])->toBe(2);
    expect($result->data['stale_count'])->toBe(1);

    $first = $result->data['deals'][0];
    expect($first['id'])->toBe($stale->id);
    expect($first['days_since_update'])->toBeGreaterThanOrEqual(14);
    expect($first['stage_state'])->toBe('active');

    tenancy()->end();
});

it('excludes closed deals by default and includes them when include_closed=true', function (): void {
    [$tenant, $user, $pipeline, $activeStage, $wonStage] = makeStaleDealsTenant();

    makeDealWithUpdatedAt($pipeline->id, $activeStage->id, $user->id, 'Active card', now()->subDays(20));
    makeDealWithUpdatedAt($pipeline->id, $wonStage->id, $user->id, 'Won card', now()->subDays(20));

    $tool = app(ListPipelineDealsTool::class);
    $conv = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Closed filter',
    ]);

    $default = $tool->execute([], $user, $conv);
    expect($default->data['total_scanned'])->toBe(1);
    expect($default->data['deals'][0]['stage_state'])->toBe('active');

    $withClosed = $tool->execute(['include_closed' => true], $user, $conv);
    expect($withClosed->data['total_scanned'])->toBe(2);

    $wonOnly = $tool->execute(['stage_state' => 'won'], $user, $conv);
    expect($wonOnly->data['total_scanned'])->toBe(1);
    expect($wonOnly->data['deals'][0]['stage_state'])->toBe('won');

    tenancy()->end();
});

it('flags deals with overdue expected_completion', function (): void {
    [$tenant, $user, $pipeline, $activeStage] = makeStaleDealsTenant();

    $deal = makeDealWithUpdatedAt($pipeline->id, $activeStage->id, $user->id, 'Overdue deal', now()->subDays(5));
    $deal->forceFill(['expected_completion' => now()->subDays(7)->toDateString()])->saveQuietly();

    $tool = app(ListPipelineDealsTool::class);
    $conv = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Overdue test',
    ]);

    $result = $tool->execute([], $user, $conv);

    expect($result->data['overdue_expected_count'])->toBe(1);
    expect($result->data['deals'][0]['expected_completion_overdue'])->toBeTrue();

    tenancy()->end();
});

it('respects the limit parameter and sorts staleness desc by default', function (): void {
    [$tenant, $user, $pipeline, $activeStage] = makeStaleDealsTenant();

    makeDealWithUpdatedAt($pipeline->id, $activeStage->id, $user->id, 'Older', now()->subDays(40));
    makeDealWithUpdatedAt($pipeline->id, $activeStage->id, $user->id, 'Mid', now()->subDays(20));
    makeDealWithUpdatedAt($pipeline->id, $activeStage->id, $user->id, 'Recent', now()->subDays(3));

    $tool = app(ListPipelineDealsTool::class);
    $conv = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Sort test',
    ]);

    $result = $tool->execute(['limit' => 2], $user, $conv);

    expect($result->data['total_scanned'])->toBe(3);
    expect($result->data['returned'])->toBe(2);
    expect($result->data['deals'][0]['title'])->toBe('Older');
    expect($result->data['deals'][1]['title'])->toBe('Mid');

    tenancy()->end();
});
