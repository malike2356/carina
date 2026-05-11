<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Deals\PropertyDataService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
    Http::preventStrayRequests();
    Cache::flush();
    config(['services.propertydata.key' => 'test-key']);
    $this->app->instance(PropertyDataService::class, new PropertyDataService('test-key'));
});

afterEach(function (): void {
    $this->app->forgetInstance(PropertyDataService::class);
});

it('property-data endpoint returns combined data as json', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/sold-prices*' => Http::response(['status' => 'success', 'data' => []], 200),
        'https://api.propertydata.co.uk/rent_estimate*' => Http::response(['status' => 'success', 'data' => ['mid' => 1200]], 200),
        'https://api.propertydata.co.uk/average_yields*' => Http::response(['status' => 'success', 'data' => []], 200),
        'https://api.propertydata.co.uk/valuations*' => Http::response(['status' => 'success', 'data' => []], 200),
    ]);

    $svc = app(TenantCreationService::class);
    $tenant = $svc->createTenant([
        'company_name' => 'PropData Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@propdata.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->getJson('http://'.$host.'/deals/property-data/B11AA?bedrooms=3')
        ->assertOk()
        ->assertJsonStructure(['postcode', 'sold_prices', 'rental_estimate', 'average_yields', 'valuation', 'calculator_prefill'])
        ->assertJsonPath('calculator_prefill.monthly_rent', 1200);
});
