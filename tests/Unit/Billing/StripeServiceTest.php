<?php

declare(strict_types=1);

use App\Services\Billing\Contracts\StripeServiceInterface;
use App\Services\Billing\StripeService;

it('resolves stripe service from container', function () {
    expect(app(StripeServiceInterface::class))->toBeInstanceOf(StripeService::class);
});

it('returns null from API helpers when Stripe secret is not configured', function () {
    config([
        'billing.stripe_secret' => '',
        'billing.stripe_webhook_secret' => '',
        'billing.stripe_publishable_key' => '',
    ]);
    app()->forgetInstance(StripeServiceInterface::class);
    app()->forgetInstance(StripeService::class);

    $stripe = app(StripeServiceInterface::class);

    expect($stripe->client())->toBeNull();
    expect($stripe->createCustomer('t1', []))->toBeNull();
    expect($stripe->retrieveInvoice('in_1'))->toBeNull();
});
