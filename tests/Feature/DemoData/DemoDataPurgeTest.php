<?php

declare(strict_types=1);

use App\DemoData\Services\DemoDataService;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

it('purge removes all demo records and clears the batch id', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Demo Purge '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'purge-'.uniqid().'@import.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $service = app(DemoDataService::class);
    $service->import('property_sourcing');
    $service->purge();

    expect(Property::demoData()->count())->toBe(0)
        ->and($service->exists())->toBeFalse()
        ->and($service->activeBatchId())->toBeNull();

    tenancy()->end();
});

it('purge returns correct total row count', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Demo Count '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'count-'.uniqid().'@import.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $service = app(DemoDataService::class);
    $service->import('mixed_portfolio');
    $deleted = $service->purge();

    expect($deleted)->toBeGreaterThan(0);

    tenancy()->end();
});

it('purge does not delete real data', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Demo Real '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'real-'.uniqid().'@import.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $userId = (int) User::query()->orderBy('id')->value('id');

    Property::query()->create([
        'address_line1' => '99 Real Street',
        'city' => 'Portsmouth',
        'postcode' => 'PO1 1AA',
        'property_type' => 'terraced',
        'country' => 'GB',
        'status' => 'owned',
        'strategy' => 'buy_to_let',
        'is_demo_data' => false,
        'created_by' => $userId,
    ]);

    $service = app(DemoDataService::class);
    $service->import('btl_landlord');
    $service->purge();

    expect(Property::realData()->count())->toBe(1);

    tenancy()->end();
});
