<?php

declare(strict_types=1);

use App\Jobs\Billing\ProcessSubscriptionWebhookJob;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
});

function stripeWebhookSignatureHeader(string $payload, string $secret): string
{
    $timestamp = time();
    $signedPayload = $timestamp.'.'.$payload;
    $signature = hash_hmac('sha256', $signedPayload, $secret);

    return 't='.$timestamp.',v1='.$signature;
}

it('returns service unavailable when webhook signing secret is not configured', function () {
    config(['billing.stripe_webhook_secret' => '']);
    PlatformSetting::query()->where('key', 'stripe_webhook_secret')->delete();

    $this->post('/api/billing/webhook/stripe', [], ['Content-Type' => 'application/json'])
        ->assertStatus(503);
});

it('rejects webhooks with an invalid stripe signature', function () {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'stripe_webhook_secret'],
        [
            'group' => 'billing',
            'value' => 'whsec_test_'.str_repeat('a', 24),
            'type' => 'string',
            'label' => 'Stripe Webhook Secret',
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );

    $this->call(
        'POST',
        '/api/billing/webhook/stripe',
        [],
        [],
        [],
        ['CONTENT_TYPE' => 'application/json', 'HTTP_STRIPE_SIGNATURE' => 't='.time().',v1=invalid'],
        '{}'
    )->assertStatus(400);
});

it('accepts a valid stripe test signature and dispatches the webhook job', function () {
    Queue::fake();

    $secret = 'whsec_test_'.str_repeat('b', 24);
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'stripe_webhook_secret'],
        [
            'group' => 'billing',
            'value' => $secret,
            'type' => 'string',
            'label' => 'Stripe Webhook Secret',
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );

    $payload = json_encode([
        'id' => 'evt_test_webhook_1',
        'object' => 'event',
        'type' => 'ping',
        'data' => ['object' => []],
    ], JSON_THROW_ON_ERROR);

    $sig = stripeWebhookSignatureHeader($payload, $secret);

    $this->call(
        'POST',
        '/api/billing/webhook/stripe',
        [],
        [],
        [],
        ['CONTENT_TYPE' => 'application/json', 'HTTP_STRIPE_SIGNATURE' => $sig],
        $payload
    )->assertNoContent();

    Queue::assertPushed(ProcessSubscriptionWebhookJob::class);
});

it('returns not found when stripe billing api flag is disabled', function () {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    $this->post('/api/billing/webhook/stripe', [], ['Content-Type' => 'application/json'])
        ->assertNotFound();
});
