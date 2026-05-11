<?php

use App\Models\Central\Subscription;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;
use App\Services\Billing\SubscriptionService;

it('resolves subscription service from container', function () {
    expect(app(SubscriptionServiceInterface::class))->toBeInstanceOf(SubscriptionService::class);
});

it('returns false for feature access stub', function () {
    $service = app(SubscriptionServiceInterface::class);

    expect($service->checkFeatureAccess('tenant-1', 'any'))->toBeFalse();
});

it('allows sync and webhook hooks as no-ops', function () {
    $service = app(SubscriptionServiceInterface::class);
    $model = new Subscription;

    $service->syncSubscriptionStatus($model);
    $service->handleWebhook([]);

    expect(true)->toBeTrue();
});
