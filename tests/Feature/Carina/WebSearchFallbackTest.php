<?php

declare(strict_types=1);

use App\Services\Carina\TavilyWebSearchService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Config::set('ai.tavily.enabled', true);
    Config::set('ai.tavily.api_key', 'tvly-test-key');
    Config::set('ai.tavily.base_url', 'https://api.tavily.com');
    Config::set('ai.tavily.trigger', 'every_message');
    Config::set('ai.tavily.max_results', 3);
    Config::set('services.brave_search.api_key', 'brave-test-key');
});

afterEach(function (): void {
    Http::allowStrayRequests();
});

it('uses Brave when Tavily returns empty', function (): void {
    Http::preventStrayRequests();
    Http::fake([
        'https://api.tavily.com/search' => Http::response(['answer' => '', 'results' => []], 200),
        'https://api.search.brave.com/res/v1/web/search*' => Http::response([
            'web' => [
                'results' => [
                    [
                        'title' => 'Bank of England base rate',
                        'description' => 'Current policy rate summary.',
                        'url' => 'https://bank.test/rate',
                    ],
                ],
            ],
        ], 200),
    ]);

    $out = app(TavilyWebSearchService::class)->augmentForUserMessage('What is the current base rate?');

    expect($out)->toContain('Brave')->toContain('https://bank.test/rate');
    Http::assertSentCount(2);
});

it('uses Brave when Tavily throws an exception', function (): void {
    Http::preventStrayRequests();
    Http::fake([
        'https://api.tavily.com/search' => function (): never {
            throw new ConnectionException('Connection timed out');
        },
        'https://api.search.brave.com/res/v1/web/search*' => Http::response([
            'web' => [
                'results' => [
                    [
                        'title' => 'Fallback result',
                        'description' => 'From Brave after Tavily failure.',
                        'url' => 'https://brave.test/fallback',
                    ],
                ],
            ],
        ], 200),
    ]);

    $out = app(TavilyWebSearchService::class)->augmentForUserMessage('latest interest rate news');

    expect($out)->toContain('Brave')->toContain('https://brave.test/fallback');

    Http::assertSent(function ($request): bool {
        return str_contains($request->url(), 'api.search.brave.com');
    });
});

it('returns empty string when both Tavily and Brave fail', function (): void {
    Http::preventStrayRequests();
    Http::fake([
        'https://api.tavily.com/search' => Http::response([], 500),
        'https://api.search.brave.com/res/v1/web/search*' => Http::response([], 429),
    ]);

    $out = app(TavilyWebSearchService::class)->augmentForUserMessage('latest stamp duty');

    expect($out)->toBe('');
    Http::assertSentCount(2);
});

it('does not call Brave when Tavily succeeds', function (): void {
    Http::preventStrayRequests();
    Http::fake([
        'https://api.tavily.com/search' => Http::response([
            'answer' => 'Tavily summary.',
            'results' => [
                [
                    'title' => 'Gov UK',
                    'url' => 'https://gov.test/stamp-duty',
                    'content' => 'Stamp duty guidance.',
                ],
            ],
        ], 200),
        'https://api.search.brave.com/res/v1/web/search*' => Http::response([
            'web' => ['results' => [['title' => 'Should not run', 'description' => 'x', 'url' => 'https://no.test']]],
        ], 200),
    ]);

    $out = app(TavilyWebSearchService::class)->augmentForUserMessage('latest stamp duty rules');

    expect($out)->toContain('Tavily')->toContain('https://gov.test/stamp-duty')
        ->and($out)->not->toContain('Should not run');

    Http::assertSent(function ($request): bool {
        return $request->url() === 'https://api.tavily.com/search';
    });
    Http::assertSentCount(1);
});
