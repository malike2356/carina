<?php

declare(strict_types=1);

use App\Models\Central\SubscriptionPlan;
use App\Services\Admin\RevenueAnalyticsService;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('normalises annual plan price to monthly for mrr', function (): void {
    $plan = new SubscriptionPlan([
        'price' => 1200,
        'interval' => 'year',
    ]);

    $service = app(RevenueAnalyticsService::class);
    $reflection = new ReflectionClass($service);
    $method = $reflection->getMethod('monthlyPriceForPlan');
    $method->setAccessible(true);

    expect($method->invoke($service, $plan))->toBe(100.0);
});

it('formats money with currency prefix', function (): void {
    $service = app(RevenueAnalyticsService::class);
    expect($service->formatMoney(1234.5, 'GBP'))->toBe('GBP 1,234.50');
});
