<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Property\DossierIntelligenceService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('finds tenancies with same university', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dossier '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dossier-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $propertyA = Property::query()->create([
        'address_line1' => '1 Uni Lane',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $propertyB = Property::query()->create([
        'address_line1' => '2 Uni Lane',
        'city' => 'Manchester',
        'postcode' => 'M1 2AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancyA = PropertyTenancy::query()->create([
        'property_id' => $propertyA->id,
        'tenant_name' => 'Student A',
        'university' => 'University of Manchester',
        'rent_amount' => 950,
        'start_date' => '2025-09-01',
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $propertyB->id,
        'tenant_name' => 'Student B',
        'university' => 'university of manchester',
        'rent_amount' => 900,
        'start_date' => '2025-09-01',
    ]);

    $signals = app(DossierIntelligenceService::class)->signalsForTenancy($tenancyA);

    expect($signals)->toHaveCount(1)
        ->and($signals[0]['field'])->toBe('university')
        ->and($signals[0]['matches'])->toHaveCount(1);

    tenancy()->end();
});

it('ignores ended tenancies', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dossier End '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dossier-end-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $propertyA = Property::query()->create([
        'address_line1' => '10 Employer St',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'house',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $propertyB = Property::query()->create([
        'address_line1' => '11 Employer St',
        'city' => 'Leeds',
        'postcode' => 'LS1 2AA',
        'property_type' => 'house',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancyA = PropertyTenancy::query()->create([
        'property_id' => $propertyA->id,
        'tenant_name' => 'Worker A',
        'employer' => 'Acme Corp',
        'rent_amount' => 800,
        'start_date' => '2025-01-01',
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $propertyB->id,
        'tenant_name' => 'Worker B',
        'employer' => 'Acme Corp',
        'rent_amount' => 750,
        'start_date' => '2024-01-01',
        'end_date' => '2024-12-31',
    ]);

    $signals = app(DossierIntelligenceService::class)->signalsForTenancy($tenancyA);

    expect($signals)->toBe([]);

    tenancy()->end();
});

it('returns empty when no matches', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dossier Empty '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dossier-empty-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '99 Solo St',
        'city' => 'York',
        'postcode' => 'YO1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Solo Tenant',
        'course' => 'Unique Programme 2025',
        'rent_amount' => 600,
        'start_date' => '2025-01-01',
    ]);

    $signals = app(DossierIntelligenceService::class)->signalsForTenancy($tenancy);

    expect($signals)->toBe([]);

    tenancy()->end();
});

it('surfaces workspace overlap groups', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dossier Group '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dossier-group-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $propertyA = Property::query()->create([
        'address_line1' => '5 Group Rd',
        'city' => 'Bristol',
        'postcode' => 'BS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'hmo',
        'created_by' => $user->id,
    ]);
    $propertyB = Property::query()->create([
        'address_line1' => '7 Group Rd',
        'city' => 'Bristol',
        'postcode' => 'BS1 2AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'hmo',
        'created_by' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $propertyA->id,
        'tenant_name' => 'Tenant 1',
        'occupation' => 'student',
        'rent_amount' => 500,
        'start_date' => '2025-01-01',
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $propertyB->id,
        'tenant_name' => 'Tenant 2',
        'occupation' => 'Student',
        'rent_amount' => 520,
        'start_date' => '2025-02-01',
    ]);

    $groups = app(DossierIntelligenceService::class)->workspaceOverlapGroups();

    $occupationGroups = array_filter($groups, fn ($g) => $g['field'] === 'occupation');
    expect($occupationGroups)->not->toBeEmpty();

    tenancy()->end();
});
