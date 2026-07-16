<?php

declare(strict_types=1);

use App\Models\Central\Domain;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Artisan;

it('creates a primary domain from the tenant slug when domains are missing', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Slug Domain Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@slug-domain.test',
        'plan' => 'starter',
    ]);

    $slug = $tenant->slug;
    Domain::query()->where('tenant_id', $tenant->id)->delete();
    expect(Domain::query()->where('tenant_id', $tenant->id)->count())->toBe(0);

    Artisan::call('tenants:ensure-primary-domains');

    $row = Domain::query()->where('tenant_id', $tenant->id)->first();
    expect($row)->not->toBeNull()
        ->and($row->domain)->toBe($slug);
});

it('dry run does not insert domains', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Dry Run Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dry-run.test',
        'plan' => 'starter',
    ]);

    Domain::query()->where('tenant_id', $tenant->id)->delete();

    Artisan::call('tenants:ensure-primary-domains', ['--dry-run' => true]);

    expect(Domain::query()->where('tenant_id', $tenant->id)->count())->toBe(0);
});

it('renames a single mismatched domain to the slug when --fix-mismatch is set', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Mismatch Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mismatch.test',
        'plan' => 'starter',
    ]);

    $slug = $tenant->slug;
    Domain::query()->where('tenant_id', $tenant->id)->update(['domain' => 'legacy-wrong-host']);

    Artisan::call('tenants:ensure-primary-domains', ['--fix-mismatch' => true]);

    expect(Domain::query()->where('tenant_id', $tenant->id)->value('domain'))->toBe($slug);
});

it('diagnose output includes tenant slug', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Diagnose Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@diagnose.test',
        'plan' => 'starter',
    ]);

    Artisan::call('tenants:ensure-primary-domains', ['--diagnose' => true]);

    $out = Artisan::output();
    expect($out)->toContain($tenant->slug)
        ->and($out)->toContain('Raw SQL tenants:');
});
