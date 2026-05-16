<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use App\Services\Deals\Contracts\ListingImportDriverInterface;
use App\Services\Deals\Drivers\ChainListingImportDriver;
use App\Services\Deals\ListingImportService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
    config([
        'listings.import_driver' => 'url',
        'listings.partner.enabled' => false,
        'listings.partner.base_url' => null,
        'listings.partner.token' => null,
        'listings.partner.auth_scheme' => 'bearer',
        'listings.partner.api_key_header' => 'X-Api-Key',
    ]);
    app()->forgetInstance(ListingImportDriverInterface::class);
    app()->forgetInstance(ListingImportService::class);
    app()->forgetInstance(ChainListingImportDriver::class);
});

it('import-listing endpoint returns json and validates url', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Import Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@import.test',
        'plan' => 'starter',
    ]);

    $tenant = Tenant::query()->with('domains')->findOrFail($tenant->getKey());
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/import-listing', [])
        ->assertUnprocessable();

    $this->postJson('http://'.$host.'/deals/import-listing', ['url' => 'not-a-url'])
        ->assertUnprocessable();
});

it('import-listing endpoint calls service and returns result', function (): void {
    Http::fake([
        'https://www.rightmove.co.uk/properties/111' => Http::response('<html><body>No data</body></html>', 200),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Import Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@import.test',
        'plan' => 'starter',
    ]);

    $tenant = Tenant::query()->with('domains')->findOrFail($tenant->getKey());
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/deals/import-listing', [
        'url' => 'https://www.rightmove.co.uk/properties/111',
    ])->assertJsonStructure(['success', 'platform', 'import_driver']);
});
