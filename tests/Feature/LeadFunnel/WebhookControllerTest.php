<?php

declare(strict_types=1);

use App\Jobs\LeadFunnel\ProcessMetaWebhookJob;
use Illuminate\Support\Facades\Queue;

it('meta verify returns challenge with correct token', function (): void {
    config(['lead_funnel.meta.webhook_verify_token' => 'verify-token']);

    $response = $this->get('/api/webhooks/meta/verify?hub_mode=subscribe&hub_verify_token=verify-token&hub_challenge=12345');

    $response->assertOk()->assertSee('12345', false);
});

it('meta receive dispatches job when signature is valid', function (): void {
    Queue::fake();
    config(['lead_funnel.meta.app_secret' => 'secret']);
    $payload = json_encode(['entry' => []]);
    $signature = 'sha256='.hash_hmac('sha256', (string) $payload, 'secret');

    $response = $this->post('/api/webhooks/meta/receive', [], [
        'X-Hub-Signature-256' => $signature,
        'CONTENT_TYPE' => 'application/json',
    ]);

    $response->assertOk();
    Queue::assertPushed(ProcessMetaWebhookJob::class);
});

it('meta receive returns forbidden on invalid signature', function (): void {
    config(['lead_funnel.meta.app_secret' => 'secret']);

    $response = $this->postJson('/api/webhooks/meta/receive', ['entry' => []], [
        'X-Hub-Signature-256' => 'sha256=invalid',
    ]);

    $response->assertForbidden();
});
