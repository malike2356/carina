<?php

declare(strict_types=1);

use App\Exceptions\Carina\RateLimitExceededException;
use App\Models\Carina\CarinaRateLimit;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Carina\RateLimitService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Redis;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

afterEach(function (): void {
    Config::set('carina.rate_limits', [
        'tenant_hourly' => 500,
        'tenant_daily' => 5000,
        'user_hourly' => 100,
        'user_daily' => 1000,
    ]);
});

it('test_check_limit_passes_when_under_tenant_limit', function (): void {
    Config::set('carina.rate_limits', [
        'tenant_hourly' => 100,
        'tenant_daily' => 1000,
        'user_hourly' => 50,
        'user_daily' => 500,
    ]);

    $svc = app(RateLimitService::class);

    expect(fn () => $svc->checkLimit('tenant-rl-'.uniqid(), 999001))->not->toThrow(Throwable::class);
});

it('test_check_limit_passes_when_under_user_limit', function (): void {
    Config::set('carina.rate_limits', [
        'tenant_hourly' => 10_000,
        'tenant_daily' => 10_000,
        'user_hourly' => 100,
        'user_daily' => 1000,
    ]);

    $tenantId = 'tenant-rl-user-ok-'.uniqid();
    $userId = 77001;

    $svc = app(RateLimitService::class);
    $svc->incrementUsage($tenantId, $userId);

    expect(fn () => $svc->checkLimit($tenantId, $userId))->not->toThrow(Throwable::class);
});

it('test_throws_rate_limit_exceeded_when_tenant_over_limit', function (): void {
    Config::set('carina.rate_limits', [
        'tenant_hourly' => 2,
        'tenant_daily' => 1000,
        'user_hourly' => 50,
        'user_daily' => 500,
    ]);

    $tenantId = 'tenant-rl-hourly-'.uniqid();
    $userId = 88001;

    $svc = app(RateLimitService::class);

    $svc->incrementUsage($tenantId, $userId);
    $svc->incrementUsage($tenantId, $userId);

    expect(fn () => $svc->checkLimit($tenantId, $userId))
        ->toThrow(RateLimitExceededException::class);
});

it('test_throws_rate_limit_exceeded_when_user_over_limit', function (): void {
    Config::set('carina.rate_limits', [
        'tenant_hourly' => 500,
        'tenant_daily' => 5000,
        'user_hourly' => 500,
        'user_daily' => 1,
    ]);

    $tenantId = 'tenant-rl-daily-'.uniqid();
    $userId = 88002;

    $svc = app(RateLimitService::class);
    $svc->incrementUsage($tenantId, $userId);

    expect(fn () => $svc->checkLimit($tenantId, $userId))
        ->toThrow(RateLimitExceededException::class);
});

it('test_increment_usage_atomically_increments_redis', function (): void {
    Config::set('carina.rate_limits', [
        'tenant_hourly' => 500,
        'tenant_daily' => 5000,
        'user_hourly' => 500,
        'user_daily' => 5000,
    ]);

    $tenantId = 'tenant-rl-incr-'.uniqid();
    $userId = 88003;

    $svc = app(RateLimitService::class);

    $svc->incrementUsage($tenantId, $userId);

    $hourKey = 'carina:rate:tenant:'.$tenantId.':hourly:'.now()->format('YmdH');

    expect((int) Redis::get($hourKey))->toBe(1);
});

it('test_reset_if_needed_resets_expired_counters_and_persists', function (): void {
    $tenantSvc = app(TenantCreationService::class);
    $tenant = $tenantSvc->createTenant([
        'company_name' => 'RL Reset '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rl-reset.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();

    $row = CarinaRateLimit::query()->create([
        'tenant_id' => $tenant->getTenantKey(),
        'user_id' => $user->id,
        'period' => 'daily',
        'limit' => 10,
        'current_usage' => 9,
        'expires_at' => now()->subHour(),
    ]);

    app(RateLimitService::class)->resetIfNeeded($tenant->getTenantKey());

    $row->refresh();

    expect($row->current_usage)->toBe(0);

    tenancy()->end();
});
