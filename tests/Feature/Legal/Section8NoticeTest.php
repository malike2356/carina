<?php

declare(strict_types=1);

use App\Models\Tenant\LegalNotice;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Legal\LegalNoticeService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    config(['nexio.rra_2025_implementation_date' => '2025-10-01']);
});

it('section 8 draft auto-populates tenant name and arrears from live records', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'S8 Notice '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 's8-notice-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '1 Notice Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Jane Arrears',
        'legal_name' => 'Jane Arrears',
        'rent_amount' => 800,
        'start_date' => '2024-01-01',
    ]);

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 80000,
        'due_date' => now()->subMonth()->toDateString(),
        'status' => 'pending',
        'created_by' => $user->id,
    ]);
    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 80000,
        'due_date' => now()->subMonths(2)->toDateString(),
        'status' => 'late',
        'created_by' => $user->id,
    ]);

    $service = app(LegalNoticeService::class);
    $notice = $service->draftSection8($tenancy, ['ground_8', 'ground_10'], $user);

    expect($notice->notice_type)->toBe(LegalNotice::TYPE_SECTION_8)
        ->and($notice->content_snapshot['tenant_name'])->toBe('Jane Arrears')
        ->and((float) $notice->arrears_amount)->toBe(1600.0)
        ->and($notice->content_snapshot['grounds'])->toContain('ground_8');

    tenancy()->end();
});

it('Ground 8 arrears calculator returns correct 2-month threshold for joint tenancy', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'S8 Joint '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 's8-joint-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '2 Joint House',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancyA = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Joint Tenant A',
        'rent_amount' => 500,
        'occupants_count' => 2,
        'start_date' => '2024-06-01',
    ]);
    $tenancyB = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Joint Tenant B',
        'rent_amount' => 500,
        'occupants_count' => 2,
        'start_date' => '2024-06-01',
    ]);

    foreach ([$tenancyA, $tenancyB] as $tenancy) {
        TenancyRentPayment::query()->create([
            'tenancy_id' => $tenancy->id,
            'property_id' => $property->id,
            'amount_minor' => 50000,
            'due_date' => now()->subMonth()->toDateString(),
            'status' => 'pending',
            'created_by' => $user->id,
        ]);
    }

    $service = app(LegalNoticeService::class);
    $arrears = $service->calculateGround8Arrears($tenancyA);

    expect($arrears)->toBe(1000.0);

    $notice = $service->draftSection8($tenancyA, ['ground_8'], $user);
    expect((float) $notice->content_snapshot['two_month_threshold'])->toBe(2000.0)
        ->and((bool) $notice->content_snapshot['ground_8_met'])->toBeFalse();

    tenancy()->end();
});
