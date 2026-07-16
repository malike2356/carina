<?php

declare(strict_types=1);

use App\Services\Carina\Remote\Channels\CarinaHubChannelAdapter;
use Illuminate\Http\Request;

beforeEach(function (): void {
    config(['services.carina_hub.webhook_secret' => null]);
});

it('reports not configured when env not set', function (): void {
    $adapter = app(CarinaHubChannelAdapter::class);

    expect($adapter->isConfigured())->toBeFalse()
        ->and($adapter->verify(Request::create('/test', 'POST', [], [], [], [], '{}')))->toBeFalse();
});

it('verifies HMAC signature when configured', function (): void {
    config(['services.carina_hub.webhook_secret' => 'hub-secret']);

    $adapter = app(CarinaHubChannelAdapter::class);
    expect($adapter->isConfigured())->toBeTrue();

    $body = '{"message":"hello","external_id":"u1"}';
    $signature = hash_hmac('sha256', $body, 'hub-secret');

    $bad = Request::create('/test', 'POST', [], [], [], [], $body);
    expect($adapter->verify($bad))->toBeFalse();

    $good = Request::create('/test', 'POST', [], [], [], [
        'HTTP_X_CARINA_HUB_SIGNATURE' => $signature,
    ], $body);
    expect($adapter->verify($good))->toBeTrue();
});

it('parses message external id and callback url', function (): void {
    config(['services.carina_hub.webhook_secret' => 'hub-secret']);

    $adapter = app(CarinaHubChannelAdapter::class);
    $body = json_encode([
        'message' => 'EPC expiry check',
        'external_id' => 'hub_user_abc123',
        'session_id' => 'hub_sess_xyz',
        'callback_url' => 'https://carinaai.uk/api/webhooks/propreneur-reply',
    ], JSON_THROW_ON_ERROR);

    $request = Request::create('/test', 'POST', [], [], [], [], $body);
    $payload = $adapter->parse($request);

    expect($payload->channel)->toBe('carina_hub')
        ->and($payload->message)->toBe('EPC expiry check')
        ->and($payload->externalId)->toBe('hub_user_abc123')
        ->and($payload->replyTarget)->toBe('https://carinaai.uk/api/webhooks/propreneur-reply');
});
