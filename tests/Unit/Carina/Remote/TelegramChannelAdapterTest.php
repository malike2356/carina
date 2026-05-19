<?php

declare(strict_types=1);

use App\Services\Carina\Remote\Channels\TelegramChannelAdapter;
use Illuminate\Http\Request;

beforeEach(function (): void {
    config([
        'services.telegram.bot_token' => null,
        'services.telegram.webhook_secret' => null,
    ]);
});

it('reports not configured when env not set', function (): void {
    $adapter = app(TelegramChannelAdapter::class);

    expect($adapter->isConfigured())->toBeFalse();
    expect($adapter->verify(Request::create('/test', 'POST')))->toBeFalse();
});

it('verifies secret token when configured', function (): void {
    config([
        'services.telegram.bot_token' => 'bot123',
        'services.telegram.webhook_secret' => 'my-secret',
    ]);

    $adapter = app(TelegramChannelAdapter::class);
    expect($adapter->isConfigured())->toBeTrue();

    $bad = Request::create('/test', 'POST');
    expect($adapter->verify($bad))->toBeFalse();

    $good = Request::create('/test', 'POST', [], [], [], [
        'HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN' => 'my-secret',
    ]);
    expect($adapter->verify($good))->toBeTrue();
});

it('parses text and sender id', function (): void {
    config(['services.telegram.bot_token' => 'bot123']);

    $adapter = app(TelegramChannelAdapter::class);
    $request = Request::create('/test', 'POST', [
        'message' => [
            'text' => 'Hello Carina',
            'from' => ['id' => 42],
            'chat' => ['id' => 99],
        ],
    ]);

    $payload = $adapter->parse($request);

    expect($payload->message)->toBe('Hello Carina')
        ->and($payload->externalId)->toBe('42')
        ->and($payload->replyTarget)->toBe('99');
});
