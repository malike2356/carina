<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'pipeline')->update(['enabled' => true, 'tenant_overrides' => null]);
});

it('includes kanban and list view toggle markers on pipeline show', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'PL View '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pl-view.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $pipeline = Pipeline::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $html = $this->get('http://'.$host.'/pipelines/'.$pipeline->id)->assertOk()->getContent();
    expect($html)->toContain("view='kanban'")
        ->and($html)->toContain("view==='list'");
});
