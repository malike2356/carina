<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\RefurbCatalogueItem;
use App\Models\Tenant\User;
use App\Services\Refurb\RefurbV1CatalogueImportService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('returns 404 when refurb v1 catalogue import feature is disabled', function (): void {
    FeatureFlag::query()->where('key', 'refurb_v1_catalogue_import')->update(['enabled' => false]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Refurb import off '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurb-import.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->postJson('http://'.$host.'/api/refurb-catalogue/items/import-v1', [])
        ->assertNotFound();
});

it('imports and updates catalogue rows when feature is enabled', function (): void {
    FeatureFlag::query()->where('key', 'refurb_v1_catalogue_import')->update(['enabled' => true]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Refurb import on '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurb-import.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    RefurbCatalogueItem::query()->where('code', 'struct_rws')->update(['default_unit_cost' => 1]);
    tenancy()->end();

    $this->actingAs($admin, 'web');
    $res = $this->postJson('http://'.$host.'/api/refurb-catalogue/items/import-v1', []);
    $res->assertOk()
        ->assertJsonFragment(['message' => 'Catalogue import completed.']);
    expect($res->json('data.created'))->toBeInt()->toBeGreaterThanOrEqual(0)
        ->and($res->json('data.updated'))->toBeInt()->toBeGreaterThan(0);

    tenancy()->initialize($tenant);
    $after = RefurbCatalogueItem::query()->where('code', 'struct_rws')->value('default_unit_cost');
    expect((float) (string) $after)->toBe(800.0)
        ->and(RefurbCatalogueItem::query()->count())->toBeGreaterThan(10);
    tenancy()->end();
});

it('rejects invalid rows in a catalogue override file', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Refurb invalid '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurb-invalid.test',
        'plan' => 'starter',
    ]);

    $path = sys_get_temp_dir().'/refurb-invalid-'.uniqid().'.json';
    file_put_contents($path, json_encode([
        'items' => [
            [
                'code' => 'bad code',
                'label' => 'X',
                'category' => 'other',
                'default_unit_cost' => 1,
                'unit' => 'job',
            ],
        ],
    ]));

    tenancy()->initialize($tenant);

    expect(fn () => (new RefurbV1CatalogueImportService($path))->importFromResolvedPath())
        ->toThrow(ValidationException::class);

    @unlink($path);
    tenancy()->end();
});
