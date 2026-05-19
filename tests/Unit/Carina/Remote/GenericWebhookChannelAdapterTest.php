<?php

declare(strict_types=1);

use App\Services\Carina\Remote\CarinaRemoteResult;
use App\Services\Carina\Remote\Channels\GenericWebhookChannelAdapter;
use App\Services\Carina\Remote\RemoteChannelPayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    config(['services.carina_remote.webhook_secret' => 'test-secret']);
});

it('rejects bad hmac', function (): void {
    $adapter = app(GenericWebhookChannelAdapter::class);
    $request = Request::create('/hook', 'POST', [], [], [], [], '{"message":"hi"}');
    $request->headers->set('X-Webhook-Signature', 'sha256=bad');

    expect($adapter->verify($request))->toBeFalse();
});

it('accepts valid hmac and parses body', function (): void {
    $adapter = app(GenericWebhookChannelAdapter::class);
    $body = json_encode([
        'sender_id' => 'user-1',
        'message' => 'Ping',
        'reply_url' => 'https://example.com/callback',
    ], JSON_THROW_ON_ERROR);

    $sig = 'sha256='.hash_hmac('sha256', $body, 'test-secret');
    $request = Request::create('/hook', 'POST', [], [], [], [
        'HTTP_X_WEBHOOK_SIGNATURE' => $sig,
        'CONTENT_TYPE' => 'application/json',
    ], $body);

    expect($adapter->verify($request))->toBeTrue();

    $payload = $adapter->parse($request);
    expect($payload->externalId)->toBe('user-1')
        ->and($payload->message)->toBe('Ping')
        ->and($payload->replyTarget)->toBe('https://example.com/callback');
});

it('reply posts to reply url with hmac header', function (): void {
    Http::fake();

    $adapter = app(GenericWebhookChannelAdapter::class);
    $payload = new RemoteChannelPayload(
        channel: 'webhook',
        externalId: 'user-1',
        message: 'Hi',
        replyTarget: 'https://example.com/callback',
    );
    $result = new CarinaRemoteResult(true, 'Done', 'sess', 1, false);

    $adapter->reply($payload, $result);

    Http::assertSent(function ($request) {
        return $request->url() === 'https://example.com/callback'
            && str_starts_with((string) $request->header('X-Webhook-Signature')[0], 'sha256=');
    });
});
