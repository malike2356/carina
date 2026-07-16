<?php

declare(strict_types=1);

use App\Jobs\Billing\ProcessSubscriptionWebhookJob;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;
use Illuminate\Support\Facades\Cache;

it('invokes subscription webhook handling only once per Stripe event id', function () {
    Cache::flush();

    $payload = [
        'id' => 'evt_idempotent_'.uniqid(),
        'type' => 'ping',
        'data' => ['object' => []],
    ];

    $mock = Mockery::mock(SubscriptionServiceInterface::class);
    $mock->shouldReceive('handleWebhook')->once()->with($payload);

    app()->instance(SubscriptionServiceInterface::class, $mock);

    $job = new ProcessSubscriptionWebhookJob($payload);
    $job->handle(app(SubscriptionServiceInterface::class));
    $job->handle(app(SubscriptionServiceInterface::class));
});
