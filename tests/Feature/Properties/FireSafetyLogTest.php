<?php

declare(strict_types=1);

use App\Models\Tenant\FireSafetyLog;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Properties\FireSafetyService;
use App\Services\Properties\HmoComplianceService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

function fireSafetyHmoProperty(User $user): Property
{
    return Property::query()->create([
        'address_line1' => '5 Fire Lane',
        'city' => 'Manchester',
        'postcode' => 'M2 2BB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
}

it('fire alarm test log creates record and sets correct next_due_at', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Fire Safety '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@fire-safety.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $property = fireSafetyHmoProperty($user);

    $performedAt = now()->subDays(1)->toDateString();
    $log = app(FireSafetyService::class)->logFireAlarmTest($property, [
        'performed_at' => $performedAt,
        'performed_by' => 'Site Manager',
        'result' => FireSafetyLog::RESULT_PASS,
    ], $user);

    expect($log->log_type)->toBe(FireSafetyLog::TYPE_FIRE_ALARM_TEST)
        ->and($log->next_due_at?->toDateString())->toBe(now()->subDays(1)->addDays(7)->toDateString());

    tenancy()->end();
});

it('overdue detection returns logs past next_due_at', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Fire Overdue '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@fire-overdue.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $property = fireSafetyHmoProperty($user);

    FireSafetyLog::query()->create([
        'property_id' => $property->id,
        'log_type' => FireSafetyLog::TYPE_FIRE_ALARM_TEST,
        'performed_at' => now()->subDays(14),
        'performed_by' => 'Tester',
        'result' => FireSafetyLog::RESULT_PASS,
        'next_due_at' => now()->subDays(2),
        'created_by' => $user->id,
    ]);

    $overdue = app(FireSafetyService::class)->getOverdueLogs($property);
    expect($overdue)->toHaveCount(1);

    $score = app(HmoComplianceService::class)->calculateScore($property->fresh(['complianceItems', 'tenancies']));
    expect($score->breakdown['fire_safety']['score'])->toBe(0)
        ->and($score->breakdown['fire_safety']['status'])->toBe('red');

    tenancy()->end();
});
