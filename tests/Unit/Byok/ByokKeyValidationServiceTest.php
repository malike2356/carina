<?php

declare(strict_types=1);

use App\Services\Byok\ByokKeyValidationService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

afterEach(function (): void {
    Http::allowStrayRequests();
});

it('returns invalid when OpenAI responds 401', function (): void {
    Http::fake([
        'api.openai.com/*' => Http::response(['error' => 'invalid'], 401),
    ]);

    $result = app(ByokKeyValidationService::class)->validateAiKey('openai', 'bad-key');

    expect($result->status)->toBe('invalid');
});

it('returns valid when OpenAI responds 200', function (): void {
    Http::fake([
        'api.openai.com/*' => Http::response(['data' => []], 200),
    ]);

    $result = app(ByokKeyValidationService::class)->validateAiKey('openai', 'good-key');

    expect($result->status)->toBe('valid');
});

it('returns valid when DeepSeek responds 200', function (): void {
    Http::fake([
        'api.deepseek.com/*' => Http::response(['data' => []], 200),
    ]);

    $result = app(ByokKeyValidationService::class)->validateAiKey('deepseek', 'good-key');

    expect($result->status)->toBe('valid');
});

it('returns valid when Gemini responds 200', function (): void {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response(['data' => []], 200),
    ]);

    $result = app(ByokKeyValidationService::class)->validateAiKey('gemini', 'good-key');

    expect($result->status)->toBe('valid');
});

it('returns unverified on connection failure', function (): void {
    Http::fake(function () {
        throw new ConnectionException('timeout');
    });

    $result = app(ByokKeyValidationService::class)->validateAiKey('openai', 'any-key');

    expect($result->status)->toBe('unverified');
});
