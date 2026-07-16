<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Properties\RightToRentService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    Carbon::setTestNow('2026-06-15 12:00:00');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

it('sets r2r_recheck_due_at from document expiry on recordR2rCheck', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'R2R Recheck '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'r2r-'.uniqid().'@test',
        'plan' => 'professional',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '3 RTR Road',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'International Tenant',
        'rent_amount' => 500,
        'start_date' => now()->toDateString(),
    ]);

    $updated = app(RightToRentService::class)->recordR2rCheck($tenancy, [
        'right_to_rent_check_date' => '2026-01-01',
        'r2r_check_type' => 'full_share_code',
        'r2r_document_expiry' => '2026-05-01',
        'right_to_rent_status' => 'time_limited',
    ]);

    expect($updated->r2r_recheck_due_at?->toDateString())->toBe('2026-05-01')
        ->and($updated->r2r_status)->toBe('expired');
    tenancy()->end();
});

it('returns overdue re-checks from getReChecksOverdue', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'R2R Overdue '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'r2r-over-'.uniqid().'@test',
        'plan' => 'professional',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '4 RTR Road',
        'city' => 'Bristol',
        'postcode' => 'BS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Overdue Tenant',
        'rent_amount' => 600,
        'start_date' => now()->subMonth()->toDateString(),
        'right_to_rent_check_date' => now()->subYear()->toDateString(),
        'r2r_recheck_due_at' => now()->subDays(5)->toDateString(),
        'r2r_status' => 'expired',
    ]);

    $overdue = app(RightToRentService::class)->getReChecksOverdue($property->fresh());
    tenancy()->end();

    expect($overdue)->toHaveCount(1)
        ->and($overdue->first()->tenant_name)->toBe('Overdue Tenant');
});
