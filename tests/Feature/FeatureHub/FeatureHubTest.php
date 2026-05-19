<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Onboarding\UserFeatureProfileService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Navigation\TenantNavModuleAccess;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    FeatureFlag::syncFromCatalogue();
});

it('feature hub page loads for authenticated tenant user', function (): void {
    $host = actingAsTenant();

    $this->get('http://'.$host.'/settings/features')
        ->assertOk()
        ->assertSee('Your workspace features', false);
});

it('activating a module via POST makes it visible in nav', function (): void {
    FeatureFlag::query()->where('key', 'asset_manager')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FH '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fh-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(UserFeatureProfileService::class)->setPersona($user, 'property_investor');
    tenancy()->end();

    $response = $this->actingAs($user, 'web')
        ->post('http://'.$host.'/settings/features/'.BillingModule::AssetManager->value.'/activate');
    $response->assertRedirect()->assertSessionHas('success');

    tenancy()->initialize($tenant);
    $user = User::query()->whereKey($user->getKey())->firstOrFail();
    $profiles = app(UserFeatureProfileService::class);
    expect($user->feature_preferences['active_modules'] ?? [])->toContain(BillingModule::AssetManager->value);
    expect($profiles->isActive($user, BillingModule::AssetManager))->toBeTrue();

    $central = \App\Models\Central\Tenant::query()->find($tenant->getKey());
    $map = app(TenantNavModuleAccess::class)->mapForUser($user, $central);
    expect($map[BillingModule::AssetManager->value])->toBeTrue();
    tenancy()->end();
});

it('deactivating a module via POST removes it from nav', function (): void {
    FeatureFlag::query()->where('key', 'asset_manager')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FH2 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fh2-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(UserFeatureProfileService::class)->setPersona($user, 'portfolio_manager');
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/settings/features/'.BillingModule::AssetManager->value.'/deactivate')
        ->assertRedirect()
        ->assertSessionHas('success');

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $profiles = app(UserFeatureProfileService::class);
    expect($profiles->isActive($user, BillingModule::AssetManager))->toBeFalse();

    $central = \App\Models\Central\Tenant::query()->find($tenant->getKey());
    $map = app(TenantNavModuleAccess::class)->mapForUser($user, $central);
    expect($map[BillingModule::AssetManager->value])->toBeFalse();
    tenancy()->end();
});

it('changing persona via POST reconfigures active modules to new defaults', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FH3 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fh3-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(UserFeatureProfileService::class)->setPersona($user, 'property_investor');
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/settings/features/persona', ['persona' => 'mentor_educator'])
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $user->refresh();
    expect($user->feature_preferences['persona'])->toBe('mentor_educator');
    expect($user->feature_preferences['active_modules'])->toContain(BillingModule::MentoringOs->value);
    tenancy()->end();
});

it('mapForUser returns false for dormant module even if plan allows it', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FH4 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fh4-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    FeatureFlag::query()->where('key', 'asset_manager')->update(['enabled' => true]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    app(UserFeatureProfileService::class)->setPersona($user, 'property_investor');
    tenancy()->end();

    tenancy()->initialize($tenant);
    $map = app(TenantNavModuleAccess::class)->mapForUser($user, $tenant);
    expect($map[BillingModule::AssetManager->value])->toBeFalse();
    tenancy()->end();
});

it('mapForUser returns true for all modules when feature_preferences is null', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FH5 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fh5-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->feature_preferences = null;
    $user->save();
    tenancy()->end();

    tenancy()->initialize($tenant);
    $map = app(TenantNavModuleAccess::class)->mapForUser($user, $tenant);
    expect($map[BillingModule::DealEngine->value])->toBeTrue();
    tenancy()->end();
});

it('dashboard hero renders net worth block for portfolio_manager persona', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FH6 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fh6-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(UserFeatureProfileService::class)->setPersona($user, 'portfolio_manager');
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/')
        ->assertOk()
        ->assertSee('Net worth', false);
});

it('dashboard hero renders cashflow block for property_investor persona', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FH7 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'fh7-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(UserFeatureProfileService::class)->setPersona($user, 'property_investor');
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/')
        ->assertOk()
        ->assertSee('Portfolio value', false);
});
