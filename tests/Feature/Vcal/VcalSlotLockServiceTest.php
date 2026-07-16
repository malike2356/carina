<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Vcal\VcalSlotLockService;
use App\Services\Vcal\VcalSlotUnavailableException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

function createTenantVcalLockFixture(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Lock Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-lock.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $host = User::query()->firstOrFail();
    $eventType = VcalEventType::query()->create([
        'user_id' => $host->getKey(),
        'name' => 'Lockable call',
        'slug' => 'lockable-call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'investor_call',
        'is_active' => true,
    ]);

    return [$tenant, $host, $eventType];
}

it('prevents a second active lock for the same host slot', function (): void {
    [, $host, $eventType] = createTenantVcalLockFixture();
    $svc = app(VcalSlotLockService::class);

    $starts = CarbonImmutable::parse('2026-06-01 10:00:00', 'UTC');
    $ends = $starts->addMinutes(30);

    $token = $svc->acquireLock($host, $eventType, $starts, $ends);

    expect($token)->not->toBe('');
    expect(fn () => $svc->acquireLock($host, $eventType, $starts, $ends))
        ->toThrow(VcalSlotUnavailableException::class);

    tenancy()->end();
});

it('allows acquisition after an expired lock is pruned', function (): void {
    [, $host, $eventType] = createTenantVcalLockFixture();
    $svc = app(VcalSlotLockService::class);

    $starts = CarbonImmutable::parse('2026-06-01 11:00:00', 'UTC');
    $ends = $starts->addMinutes(30);
    $token = $svc->acquireLock($host, $eventType, $starts, $ends);

    DB::connection('tenant')
        ->table('vcal_slot_locks')
        ->where('lock_token', $token)
        ->update(['expires_at' => now()->subMinute()]);

    expect($svc->pruneExpired())->toBe(1);
    expect($svc->acquireLock($host, $eventType, $starts, $ends))->not->toBe('');

    tenancy()->end();
});
