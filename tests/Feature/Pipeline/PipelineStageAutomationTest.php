<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\PipelineStageAutomation;
use App\Models\Tenant\User;
use App\Services\Pipeline\PipelineStageAutomationService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'pipeline')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('creates a compliance item when stage automation fires on enter', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Auto Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@auto.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $pipeline = Pipeline::query()->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->orderBy('position')->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $this->post('http://'.$host.'/pipelines/'.$pipeline->id.'/stages/'.$stage->id.'/automations', [
        'action_type' => 'create_compliance_item',
        'action_config' => ['title' => 'Conveyancer check'],
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    PipelineStageAutomation::query()->where('stage_id', $stage->id)->firstOrFail();
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Card',
        'deal_analysis_id' => null,
        'property_id' => null,
        'created_by' => $user->id,
        'position' => 0,
    ]);
    app(PipelineStageAutomationService::class)->fireOnEnter($deal, (int) $stage->id);
    expect(ComplianceItem::query()->where('title', 'Conveyancer check')->count())->toBe(0);

    $da = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Linked',
        'metrics' => [],
        'status' => 'draft',
    ]);
    $deal2 = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Card 2',
        'deal_analysis_id' => $da->id,
        'property_id' => null,
        'created_by' => $user->id,
        'position' => 1,
    ]);
    app(PipelineStageAutomationService::class)->fireOnEnter($deal2, (int) $stage->id);
    expect(ComplianceItem::query()->where('title', 'Conveyancer check')->count())->toBe(1);
    tenancy()->end();
});
