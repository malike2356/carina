<?php

declare(strict_types=1);

use App\Services\Carina\Remote\CarinaRemoteResult;
use App\Services\Carina\Remote\Channels\WhatsAppWebChannelAdapter;
use App\Services\Carina\Remote\RemoteChannelPayload;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

beforeEach(function (): void {
    config([
        'services.whatsapp_bridge.url' => null,
        'services.whatsapp_bridge.api_key' => null,
        'services.whatsapp_bridge.webhook_secret' => null,
    ]);
});

it('isConfigured returns false when WHATSAPP_BRIDGE_URL is not set', function (): void {
    expect(app(WhatsAppWebChannelAdapter::class)->isConfigured())->toBeFalse();
});

it('verify returns false when unconfigured', function (): void {
    $request = Request::create('/api/remote/inbound/whatsapp-web', 'POST');

    expect(app(WhatsAppWebChannelAdapter::class)->verify($request))->toBeFalse();
});

it('verify passes when X-Bridge-Secret matches config', function (): void {
    config([
        'services.whatsapp_bridge.url' => 'http://127.0.0.1:3001',
        'services.whatsapp_bridge.webhook_secret' => 'secret-abc',
    ]);

    $request = Request::create('/api/remote/inbound/whatsapp-web', 'POST');
    $request->headers->set('X-Bridge-Secret', 'secret-abc');

    expect(app(WhatsAppWebChannelAdapter::class)->verify($request))->toBeTrue();
});

it('verify fails on wrong secret', function (): void {
    config([
        'services.whatsapp_bridge.url' => 'http://127.0.0.1:3001',
        'services.whatsapp_bridge.webhook_secret' => 'secret-abc',
    ]);

    $request = Request::create('/api/remote/inbound/whatsapp-web', 'POST');
    $request->headers->set('X-Bridge-Secret', 'wrong');

    expect(app(WhatsAppWebChannelAdapter::class)->verify($request))->toBeFalse();
});

it('parse extracts from message and session_id', function (): void {
    $request = Request::create('/api/remote/inbound/whatsapp-web', 'POST', [], [], [], [], json_encode([
        'from' => '447700900123',
        'message' => 'Hello Carina',
        'session_id' => 'xelox',
    ]));
    $request->headers->set('Content-Type', 'application/json');

    $payload = app(WhatsAppWebChannelAdapter::class)->parse($request);

    expect($payload->channel)->toBe('whatsapp-web')
        ->and($payload->externalId)->toBe('447700900123')
        ->and($payload->message)->toBe('Hello Carina')
        ->and($payload->replyTarget)->toBe('xelox');
});

it('parse handles missing fields without throwing', function (): void {
    $request = Request::create('/api/remote/inbound/whatsapp-web', 'POST', [], [], [], [], '{}');
    $request->headers->set('Content-Type', 'application/json');

    $payload = app(WhatsAppWebChannelAdapter::class)->parse($request);

    expect($payload->externalId)->toBe('')
        ->and($payload->message)->toBe('')
        ->and($payload->replyTarget)->toBe('');
});

it('reply POSTs to bridge with X-Bridge-Key header', function (): void {
    config([
        'services.whatsapp_bridge.url' => 'http://127.0.0.1:3001',
        'services.whatsapp_bridge.api_key' => 'bridge-key',
    ]);

    Http::fake([
        '127.0.0.1:3001/sessions/xelox/send' => Http::response(['ok' => true]),
    ]);

    $adapter = app(WhatsAppWebChannelAdapter::class);
    $payload = new RemoteChannelPayload(
        channel: 'whatsapp-web',
        externalId: '447700900123',
        message: 'Hi',
        replyTarget: 'xelox',
    );
    $result = new CarinaRemoteResult(
        ok: true,
        reply: 'Here is your answer',
        sessionId: 'sess',
        stepsUsed: 1,
        requiresConfirmation: false,
    );

    $adapter->reply($payload, $result);

    Http::assertSent(function ($request): bool {
        return $request->url() === 'http://127.0.0.1:3001/sessions/xelox/send'
            && $request->hasHeader('X-Bridge-Key', 'bridge-key')
            && $request['to'] === '447700900123'
            && $request['text'] === 'Here is your answer';
    });
});

it('reply does not throw when bridge is unreachable', function (): void {
    config([
        'services.whatsapp_bridge.url' => 'http://127.0.0.1:3001',
        'services.whatsapp_bridge.api_key' => 'bridge-key',
    ]);

    Http::fake(fn () => throw new ConnectionException('Connection refused'));
    Log::spy();

    $adapter = app(WhatsAppWebChannelAdapter::class);
    $payload = new RemoteChannelPayload('whatsapp-web', '1', 'Hi', 'xelox');
    $result = new CarinaRemoteResult(true, 'OK', '', 0, false);

    $adapter->reply($payload, $result);

    Log::shouldHaveReceived('warning')->once();
});
