<?php

declare(strict_types=1);

use App\Models\Tenant\LegalNotice;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Legal\LegalNoticeService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Validation\ValidationException;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    config(['nexio.rra_2025_implementation_date' => '2025-10-01']);
});

it('rejects second Section 13 notice within 12 months', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'S13 Limit '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 's13-limit-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '3 Rent Rise Road',
        'city' => 'Leeds',
        'postcode' => 'LS3 3CC',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Periodic Tenant',
        'rent_amount' => 1000,
        'start_date' => '2024-01-01',
        'tenancy_type' => 'periodic',
    ]);

    $service = app(LegalNoticeService::class);
    $first = $service->draftSection13($tenancy, 1050.00, $user);
    $service->issue($first);

    expect(fn () => $service->draftSection13($tenancy, 1100.00, $user))
        ->toThrow(ValidationException::class, 'one Section 13 rent increase per 12-month period');

    tenancy()->end();
});

it('allows Section 13 when prior notice was issued over 12 months ago', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'S13 OK '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 's13-ok-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '4 Rent OK Road',
        'city' => 'Leeds',
        'postcode' => 'LS4 4DD',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Long Tenant',
        'rent_amount' => 900,
        'start_date' => '2023-01-01',
    ]);

    LegalNotice::query()->create([
        'property_id' => $property->id,
        'tenancy_id' => $tenancy->id,
        'notice_type' => LegalNotice::TYPE_SECTION_13,
        'status' => LegalNotice::STATUS_ISSUED,
        'issued_at' => now()->subMonths(13),
        'content_snapshot' => [],
        'created_by' => $user->id,
    ]);

    $notice = app(LegalNoticeService::class)->draftSection13($tenancy, 950.00, $user);

    expect($notice->notice_type)->toBe(LegalNotice::TYPE_SECTION_13);

    tenancy()->end();
});
