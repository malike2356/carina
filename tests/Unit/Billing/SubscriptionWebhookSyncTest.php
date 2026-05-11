<?php

declare(strict_types=1);

use App\Services\Billing\Contracts\StripeServiceInterface;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;

afterEach(function () {
    Mockery::close();
});

it('pulls subscription from Stripe when invoice payment_action_required is received', function () {
    $called = false;

    $stripe = Mockery::mock(StripeServiceInterface::class);
    $stripe->shouldReceive('retrieveSubscription')
        ->once()
        ->with('sub_from_invoice')
        ->andReturnUsing(function () use (&$called) {
            $called = true;

            return null;
        });

    app()->forgetInstance(StripeServiceInterface::class);
    app()->forgetInstance(SubscriptionServiceInterface::class);
    app()->instance(StripeServiceInterface::class, $stripe);

    app(SubscriptionServiceInterface::class)->handleWebhook([
        'type' => 'invoice.payment_action_required',
        'data' => [
            'object' => [
                'id' => 'in_123',
                'subscription' => 'sub_from_invoice',
            ],
        ],
    ]);

    expect($called)->toBeTrue();
});

it('ignores invoice payment_action_required when subscription id is missing', function () {
    $stripe = Mockery::mock(StripeServiceInterface::class);
    $stripe->shouldReceive('retrieveSubscription')->never();

    app()->forgetInstance(StripeServiceInterface::class);
    app()->forgetInstance(SubscriptionServiceInterface::class);
    app()->instance(StripeServiceInterface::class, $stripe);

    app(SubscriptionServiceInterface::class)->handleWebhook([
        'type' => 'invoice.payment_action_required',
        'data' => [
            'object' => [
                'id' => 'in_456',
            ],
        ],
    ]);

    expect(true)->toBeTrue();
});
