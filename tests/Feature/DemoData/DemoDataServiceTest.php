<?php

declare(strict_types=1);

use App\DemoData\Services\DemoDataService;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

it('imports mixed portfolio and marks all records as demo data', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Demo Import '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'demo-'.uniqid().'@import.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $service = app(DemoDataService::class);

    $batchId = $service->import('mixed_portfolio');

    expect(Property::demoData()->count())->toBeGreaterThan(0)
        ->and(Property::realData()->count())->toBe(0)
        ->and($service->exists())->toBeTrue()
        ->and($service->activeBatchId())->toBe($batchId)
        ->and($batchId)->toMatch('/^[0-9a-f-]{36}$/');

    tenancy()->end();
});

it('throws when importing while demo data already exists', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Demo Dup '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dup-'.uniqid().'@import.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $service = app(DemoDataService::class);
    $service->import('btl_landlord');

    expect(fn () => $service->import('hmo_investor'))
        ->toThrow(RuntimeException::class, 'Demo data already exists. Call purge() first.');

    tenancy()->end();
});
