<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Pipeline\PipelineService;
use App\Services\Tenancy\TenantCreationService;
use App\Services\UI\TenantGlobalSearchService;

it('links pipeline deals to deal analyses and copies property id', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Interconnect '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@interconnect.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '88 Link Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    $analysis = DealAnalysis::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Linked BTL run',
        'metrics' => [],
        'status' => 'draft',
    ]);

    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->firstOrFail();

    $pipeSvc = app(PipelineService::class);
    $card = $pipeSvc->createDeal([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Board card for analysis',
        'deal_analysis_id' => $analysis->id,
    ], $user);

    expect($card->deal_analysis_id)->toBe($analysis->id)
        ->and((int) $card->property_id)->toBe($property->id);

    $analysis->refresh();
    expect($analysis->pipelineDeals)->toHaveCount(1);

    tenancy()->end();
});

it('resolves carina conversation context models', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Carina ctx '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-ctx.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Context Way',
        'city' => 'York',
        'postcode' => 'YO1 1AA',
        'property_type' => 'flat',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    $conv = CarinaConversation::query()->create([
        'tenant_id' => (string) tenant('id'),
        'user_id' => $user->id,
        'context_type' => 'property',
        'context_id' => $property->id,
        'title' => 'Test',
    ]);

    expect($conv->resolveContextModel()?->is($property))->toBeTrue();

    tenancy()->end();
});

it('includes compliance items in tenant global search', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Search mod '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@search-mod.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    ComplianceItem::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'UniqueComplianceGasTag '.uniqid(),
        'status' => 'valid',
    ]);

    $hits = app(TenantGlobalSearchService::class)->search('UniqueComplianceGasTag');
    $types = collect($hits)->pluck('type')->all();
    expect($types)->toContain('compliance');

    tenancy()->end();
});
