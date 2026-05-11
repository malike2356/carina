<?php

declare(strict_types=1);

use App\Services\Central\PlatformSchedulerHeartbeat;
use Illuminate\Support\Facades\Cache;

it('records and reads last tick', function (): void {
    Cache::forget(PlatformSchedulerHeartbeat::CACHE_KEY);
    PlatformSchedulerHeartbeat::record();
    expect(PlatformSchedulerHeartbeat::lastTickAt())->not->toBeNull();
    expect(PlatformSchedulerHeartbeat::secondsSinceLastTick())->toBeLessThan(30);
    expect(PlatformSchedulerHeartbeat::status(180))->toBe('healthy');
});

it('reports stale when tick is old', function (): void {
    Cache::put(PlatformSchedulerHeartbeat::CACHE_KEY, now()->subMinutes(10)->toIso8601String(), 600);
    expect(PlatformSchedulerHeartbeat::status(180))->toBe('stale');
});

it('reports unknown when missing', function (): void {
    Cache::forget(PlatformSchedulerHeartbeat::CACHE_KEY);
    expect(PlatformSchedulerHeartbeat::status(180))->toBe('unknown');
});
