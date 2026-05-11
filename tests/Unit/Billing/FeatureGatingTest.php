<?php

declare(strict_types=1);

use App\Services\Billing\Contracts\FeatureGatingServiceInterface;
use App\Services\Billing\FeatureGatingService;
use Symfony\Component\HttpKernel\Exception\HttpException;

it('resolves feature gating service from container', function () {
    expect(app(FeatureGatingServiceInterface::class))->toBeInstanceOf(FeatureGatingService::class);
});

it('returns conservative defaults when tenant is unknown', function () {
    $gate = app(FeatureGatingServiceInterface::class);
    $missingId = '00000000-0000-0000-0000-000000000000';

    expect($gate->hasFeature($missingId, 'deal_engine'))->toBeFalse();
    expect($gate->getPlanFeatures($missingId))->toBe([]);
});

it('abort when enforcing limits without entitlement', function () {
    $gate = app(FeatureGatingServiceInterface::class);
    $missingId = '00000000-0000-0000-0000-000000000000';

    expect(fn () => $gate->enforceLimits($missingId, 'deal_engine'))
        ->toThrow(HttpException::class);
});
