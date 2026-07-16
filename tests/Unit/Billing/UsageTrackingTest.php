<?php

declare(strict_types=1);

use App\Services\Billing\Contracts\UsageTrackingServiceInterface;
use App\Services\Billing\UsageTrackingService;

it('resolves usage tracking service from container', function () {
    expect(app(UsageTrackingServiceInterface::class))->toBeInstanceOf(UsageTrackingService::class);
});

it('returns zero usage when no subscription exists for tenant', function () {
    $usage = app(UsageTrackingServiceInterface::class);

    expect($usage->getUsage('tenant-1', 'api_calls'))->toMatchArray(['usage_count' => 0]);
    expect($usage->checkUsageLimits('tenant-1', 'api_calls'))->toBeTrue();
    $usage->recordUsage('tenant-1', 'api_calls', 1);
    expect(true)->toBeTrue();
});
