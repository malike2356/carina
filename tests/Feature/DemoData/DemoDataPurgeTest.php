<?php

declare(strict_types=1);

use App\DemoData\Services\DemoDataService;
use App\DemoData\Support\PortfolioDemoFingerprints;
use App\Models\Tenant\BusinessHolding;
use App\Models\Tenant\CashAccount;
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

it('purge removes unflagged portfolio cash and business demo residue', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Demo Residue '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'residue-'.uniqid().'@import.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $userId = (int) User::query()->orderBy('id')->value('id');

    CashAccount::query()->create([
        'name' => PortfolioDemoFingerprints::cashAccountNames()[0],
        'account_type' => 'current_account',
        'bank_name' => 'Barclays',
        'currency' => 'GBP',
        'current_balance' => 47500,
        'available_balance' => 47500,
        'status' => 'active',
        'is_demo_data' => false,
        'created_by' => $userId,
    ]);

    BusinessHolding::query()->create([
        'name' => 'Xelox Properties Ltd',
        'registration_number' => PortfolioDemoFingerprints::businessRegistrationNumbers()[0],
        'business_type' => 'limited_company',
        'ownership_percentage' => 100,
        'valuation' => 1500000,
        'status' => 'active',
        'is_demo_data' => false,
        'created_by' => $userId,
    ]);

    $service = app(DemoDataService::class);
    expect($service->exists())->toBeTrue();

    $deleted = $service->purgePortfolioResidue();

    expect($deleted)->toBe(2)
        ->and(CashAccount::query()->count())->toBe(0)
        ->and(BusinessHolding::query()->count())->toBe(0)
        ->and($service->exists())->toBeFalse();

    tenancy()->end();
});
