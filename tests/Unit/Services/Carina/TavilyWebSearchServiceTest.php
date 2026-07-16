<?php

declare(strict_types=1);

use App\Services\Carina\TavilyWebSearchService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Config::set('ai.tavily.api_key', 'tvly-test-key');
    Config::set('ai.tavily.base_url', 'https://api.tavily.com');
    Config::set('ai.tavily.trigger', 'keywords');
    Config::set('ai.tavily.keyword_triggers', ['latest', 'news']);
    Config::set('ai.tavily.max_results', 2);
    Config::set('ai.tavily.max_query_length', 400);
    Config::set('ai.tavily.max_context_chars', 5000);
    Config::set('ai.tavily.max_snippet_chars', 200);
    Config::set('ai.tavily.include_answer', true);
});

it('returns empty when tavily is disabled', function (): void {
    Config::set('ai.tavily.enabled', false);
    Http::fake();

    $svc = app(TavilyWebSearchService::class);
    expect($svc->augmentForUserMessage('latest stamp duty'))->toBe('');
    Http::assertNothingSent();
});

it('returns empty for casual message in keywords mode', function (): void {
    Config::set('ai.tavily.enabled', true);
    Http::fake();

    $svc = app(TavilyWebSearchService::class);
    expect($svc->augmentForUserMessage('Hello Carina'))->toBe('');
    Http::assertNothingSent();
});

it('calls Tavily when a keyword matches', function (): void {
    Config::set('ai.tavily.enabled', true);
    Http::fake([
        'https://api.tavily.com/search' => Http::response([
            'answer' => 'Short Tavily answer.',
            'results' => [
                [
                    'title' => 'Example',
                    'url' => 'https://example.test/page',
                    'content' => 'Snippet text here.',
                ],
            ],
        ], 200),
    ]);

    $svc = app(TavilyWebSearchService::class);
    $out = $svc->augmentForUserMessage('What is the latest stamp duty position?');

    expect($out)->toContain('Tavily')->toContain('https://example.test/page')->toContain('Short Tavily answer');

    Http::assertSent(function ($request): bool {
        $data = $request->data();

        return $request->url() === 'https://api.tavily.com/search'
            && ($data['api_key'] ?? null) === 'tvly-test-key'
            && str_contains((string) ($data['query'] ?? ''), 'latest stamp duty');
    });
});

it('searches on every message when trigger is every_message', function (): void {
    Config::set('ai.tavily.enabled', true);
    Config::set('ai.tavily.trigger', 'every_message');
    Http::fake([
        'https://api.tavily.com/search' => Http::response([
            'answer' => '',
            'results' => [
                ['title' => 'A', 'url' => 'https://a.test', 'content' => 'Body'],
            ],
        ], 200),
    ]);

    $svc = app(TavilyWebSearchService::class);
    expect($svc->augmentForUserMessage('Hi'))->not->toBe('');

    Http::assertSentCount(1);
});

it('augmentForQuery skips keyword gate', function (): void {
    Config::set('ai.tavily.enabled', true);
    Config::set('ai.tavily.trigger', 'keywords');
    Http::fake([
        'https://api.tavily.com/search' => Http::response([
            'answer' => '',
            'results' => [
                ['title' => 'B', 'url' => 'https://b.test', 'content' => 'X'],
            ],
        ], 200),
    ]);

    $svc = app(TavilyWebSearchService::class);
    expect($svc->augmentForQuery('BTL UK'))->toContain('https://b.test');

    Http::assertSentCount(1);
});

it('forces search without keyword match when requested', function (): void {
    Config::set('ai.tavily.enabled', true);
    Config::set('ai.tavily.trigger', 'keywords');
    Http::fake([
        'https://api.tavily.com/search' => Http::response([
            'answer' => '',
            'results' => [
                ['title' => 'Gov', 'url' => 'https://gov.test', 'content' => 'Rules'],
            ],
        ], 200),
    ]);

    $svc = app(TavilyWebSearchService::class);
    $out = $svc->augmentForUserMessage('Hello', true, 'UK buy to let stamp duty 2026', true);

    expect($out)->toContain('PropertyData')->toContain('https://gov.test');

    Http::assertSent(function ($request): bool {
        $d = $request->data();

        return str_contains((string) ($d['query'] ?? ''), 'UK buy to let');
    });
});
