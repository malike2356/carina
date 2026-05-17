<?php

declare(strict_types=1);

use App\Services\Carina\PromptCacheService;
use Illuminate\Support\Facades\Cache;

it('getCached returns null on a cold cache', function (): void {
    Cache::flush();
    $service = app(PromptCacheService::class);
    $key = $service->getCacheKey('system', 'context');
    expect($service->getCached($key))->toBeNull();
});

it('setCached and getCached round-trip correctly', function (): void {
    $service = app(PromptCacheService::class);
    $key = $service->getCacheKey('my system prompt', 'abc123');
    $service->setCached($key, 'cached reply text', 60);
    expect($service->getCached($key))->toBe('cached reply text');
});

it('getCacheKey is deterministic for the same inputs', function (): void {
    $service = app(PromptCacheService::class);
    $a = $service->getCacheKey('prompt A', 'ctx1');
    $b = $service->getCacheKey('prompt A', 'ctx1');
    $c = $service->getCacheKey('prompt A', 'ctx2');
    expect($a)->toBe($b);
    expect($a)->not->toBe($c);
});

it('getCacheKey differs for different system prompts with same context', function (): void {
    $service = app(PromptCacheService::class);
    $a = $service->getCacheKey('prompt A', 'ctx');
    $b = $service->getCacheKey('prompt B', 'ctx');
    expect($a)->not->toBe($b);
});
