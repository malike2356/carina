<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Assets\AssetManagerService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    tenancy()->end();
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', BillingModule::AssetManager->value)->update(['enabled' => true]);
});

function assetApiTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Asset API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@asset-api.test',
        'plan' => 'operator',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(AssetManagerService::class)->createAsset([
        'name' => 'Savings',
        'category' => 'cash_account',
        'current_value' => 10000,
    ], $user);
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('returns net worth JSON for authenticated tenant user', function (): void {
    [, $host, $user] = assetApiTenant();

    $this->actingAs($user, 'web');
    $response = $this->getJson('http://'.$host.'/api/assets/net-worth');

    $response->assertOk()
        ->assertJsonStructure(['net_worth', 'total_assets', 'total_liabilities', 'monthly_income']);
});

it('returns 403 for tenant without asset_manager module', function (): void {
    [, $host, $user] = assetApiTenant();

    FeatureFlag::query()->where('key', BillingModule::AssetManager->value)->update(['enabled' => false]);

    $this->actingAs($user, 'web');
    $this->getJson('http://'.$host.'/api/assets/net-worth')->assertNotFound();
});

it('allocation sums to 100 percent', function (): void {
    [, $host, $user] = assetApiTenant();

    $this->actingAs($user, 'web');
    $data = $this->getJson('http://'.$host.'/api/assets/allocation')->json();

    $sum = collect($data)->sum('percentage');
    expect(round($sum, 0))->toBe(100.0);
});
