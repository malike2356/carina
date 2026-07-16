<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Deals\AirDnaService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('returns AirDNA snapshot JSON for SA deals when service is mocked', function (): void {
    $mock = Mockery::mock(AirDnaService::class);
    $mock->shouldReceive('isConfigured')->andReturn(true);
    $mock->shouldReceive('marketData')->once()->andReturn([
        'location' => 'B1 1AA',
        'occupancy_rate' => 0.72,
        'avg_daily_rate' => 120,
        'fetched_at' => now()->toIso8601String(),
        'raw' => [],
    ]);
    $this->app->instance(AirDnaService::class, $mock);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Air Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@air.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $prop = Property::query()->create([
        'address_line1' => '1 Test St',
        'city' => 'Birmingham',
        'postcode' => 'B1 1AA',
        'property_type' => 'flat',
        'created_by' => $user->id,
    ]);
    $deal = DealAnalysis::query()->create([
        'property_id' => $prop->id,
        'created_by' => $user->id,
        'strategy' => 'sa',
        'title' => 'SA deal',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->getJson('http://'.$host.'/deals/'.$deal->id.'/airdna-data')
        ->assertOk()
        ->assertJsonPath('data.occupancy_rate', 0.72);

    tenancy()->initialize($tenant);
    expect(DealAnalysis::query()->find($deal->id)?->airdna_snapshot)->not->toBeNull();
    tenancy()->end();
});

it('returns 422 for BTL deals', function (): void {
    $mock = Mockery::mock(AirDnaService::class);
    $this->app->instance(AirDnaService::class, $mock);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Air BTL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@air-btl.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'BTL',
        'metrics' => ['postcode' => 'B1 1AA'],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->getJson('http://'.$host.'/deals/'.$deal->id.'/airdna-data')->assertStatus(422);
});
