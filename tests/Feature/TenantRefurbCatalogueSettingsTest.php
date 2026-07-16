<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    FeatureFlag::query()->where('key', 'refurb_v1_catalogue_import')->update([
        'enabled' => false,
        'tenant_overrides' => null,
    ]);
});

it('renders refurb catalogue settings for workspace admin', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Refurb UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurb-ui.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/settings/refurb-catalogue')
        ->assertOk()
        ->assertSee('Refurb catalogue')
        ->assertSee('Catalogue items')
        ->assertDontSee('Import legacy catalogue');
});

it('shows legacy import control when platform flag is on', function (): void {
    FeatureFlag::query()->where('key', 'refurb_v1_catalogue_import')->update(['enabled' => true]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Refurb UI import '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurb-ui-import.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/settings/refurb-catalogue')
        ->assertOk()
        ->assertSee('Import legacy catalogue');
});
