<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    tenancy()->end();
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', BillingModule::MultiProperty->value)->update(['enabled' => true]);
});

it('loads asset manager dashboard without error', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Asset Dash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dash-'.uniqid().'@asset-manager.test',
        'plan' => 'operator',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/asset-manager')
        ->assertOk()
        ->assertSee('Net Worth', false);
});
