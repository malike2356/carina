<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Properties\DepositProtectionService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    Carbon::setTestNow('2026-06-15 12:00:00');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

it('returns warning when deposit received 25 days ago without protection', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Deposit Warn '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dep-warn-'.uniqid().'@test',
        'plan' => 'professional',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '1 Deposit Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Alex Tenant',
        'deposit' => 500,
        'deposit_received_at' => now()->subDays(25)->toDateString(),
        'rent_amount' => 600,
        'start_date' => now()->subMonth()->toDateString(),
    ]);

    $check = app(DepositProtectionService::class)->checkProtectionDeadline($tenancy->fresh());
    tenancy()->end();

    expect($check['protection']['status'])->toBe('warning')
        ->and($check['protection']['days_remaining'])->toBe(5);
});

it('returns breach when deposit received 31 days ago without protection', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Deposit Breach '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dep-breach-'.uniqid().'@test',
        'plan' => 'professional',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '2 Deposit Lane',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Sam Tenant',
        'deposit' => 400,
        'deposit_received_at' => now()->subDays(31)->toDateString(),
        'rent_amount' => 550,
        'start_date' => now()->subMonths(2)->toDateString(),
    ]);

    $check = app(DepositProtectionService::class)->checkProtectionDeadline($tenancy->fresh());
    tenancy()->end();

    expect($check['protection']['status'])->toBe('breach')
        ->and($check['overall_status'])->toBe('breach');
});
