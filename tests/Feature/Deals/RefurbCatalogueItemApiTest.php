<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\RefurbCatalogueItem;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('cruds refurb catalogue items as tenant admin', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Catalogue CRUD '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurbcat.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $list = $this->getJson('http://'.$host.'/api/refurb-catalogue/items');
    $list->assertOk();
    expect($list->json('data'))->not->toBeEmpty();

    $create = $this->postJson('http://'.$host.'/api/refurb-catalogue/items', [
        'code' => 'custom_test_'.uniqid(),
        'label' => 'Custom test item',
        'category' => 'other',
        'default_unit_cost' => 123.45,
        'default_quantity' => 2,
        'unit' => 'job',
        'sort_order' => 999,
        'is_active' => true,
    ]);
    $create->assertCreated();
    $id = (int) $create->json('data.id');
    expect($id)->toBeGreaterThan(0);

    $patch = $this->patchJson('http://'.$host.'/api/refurb-catalogue/items/'.$id, [
        'default_unit_cost' => 200,
        'label' => 'Updated label',
        'is_active' => false,
    ]);
    $patch->assertOk();
    expect((float) $patch->json('data.default_unit_cost'))->toBe(200.0)
        ->and($patch->json('data.label'))->toBe('Updated label')
        ->and($patch->json('data.is_active'))->toBeFalse();

    $show = $this->getJson('http://'.$host.'/api/refurb-catalogue/items/'.$id);
    $show->assertOk();

    $this->deleteJson('http://'.$host.'/api/refurb-catalogue/items/'.$id)->assertOk();

    tenancy()->initialize($tenant);
    expect(RefurbCatalogueItem::query()->whereKey($id)->exists())->toBeFalse();
    tenancy()->end();
});

it('denies catalogue mutations without manage permission', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Catalogue viewer '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refview.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();

    $viewerRole = TenantRole::query()->where('name', 'viewer')->where('guard_name', 'web')->firstOrFail();
    $viewer = User::query()->create([
        'email' => 'viewer-'.uniqid().'@refview.test',
        'name' => 'Viewer',
        'password' => bcrypt('password'),
        'is_active' => true,
    ]);
    $viewer->syncRoles($viewerRole);
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    tenancy()->end();

    $this->actingAs($viewer, 'web');

    $this->getJson('http://'.$host.'/api/refurb-catalogue/items')->assertOk();

    $this->postJson('http://'.$host.'/api/refurb-catalogue/items', [
        'code' => 'should_fail',
        'label' => 'X',
        'category' => 'other',
        'default_unit_cost' => 1,
        'default_quantity' => 1,
        'unit' => 'each',
    ])->assertForbidden();
});

it('lists active items only for managers when active_only is set', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Catalogue filter '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurbfilter.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $codeOn = 'filter_on_'.uniqid();
    $codeOff = 'filter_off_'.uniqid();

    $this->postJson('http://'.$host.'/api/refurb-catalogue/items', [
        'code' => $codeOn,
        'label' => 'Active row',
        'category' => 'other',
        'default_unit_cost' => 10,
        'default_quantity' => 1,
        'unit' => 'each',
        'is_active' => true,
    ])->assertCreated();

    $this->postJson('http://'.$host.'/api/refurb-catalogue/items', [
        'code' => $codeOff,
        'label' => 'Inactive row',
        'category' => 'other',
        'default_unit_cost' => 20,
        'default_quantity' => 1,
        'unit' => 'each',
        'is_active' => false,
    ])->assertCreated();

    $filtered = $this->getJson('http://'.$host.'/api/refurb-catalogue/items?active_only=1');
    $filtered->assertOk();
    $codes = collect($filtered->json('data'))->pluck('code')->all();
    expect($codes)->toContain($codeOn)->not->toContain($codeOff);
});

it('hides inactive items from viewers on show', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Catalogue inactive '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refinactive.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $inactive = RefurbCatalogueItem::query()->create([
        'code' => 'inactive_show_'.uniqid(),
        'label' => 'Hidden from viewer',
        'category' => 'other',
        'default_unit_cost' => 1,
        'default_quantity' => 1,
        'unit' => 'each',
        'sort_order' => 0,
        'is_active' => false,
    ]);
    $inactiveId = (int) $inactive->id;

    $viewerRole = TenantRole::query()->where('name', 'viewer')->where('guard_name', 'web')->firstOrFail();
    $viewer = User::query()->create([
        'email' => 'viewer-'.uniqid().'@refinactive.test',
        'name' => 'Viewer',
        'password' => bcrypt('password'),
        'is_active' => true,
    ]);
    $viewer->syncRoles($viewerRole);
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $this->getJson('http://'.$host.'/api/refurb-catalogue/items/'.$inactiveId)->assertOk();

    $this->actingAs($viewer, 'web');
    $this->getJson('http://'.$host.'/api/refurb-catalogue/items/'.$inactiveId)->assertNotFound();
});
