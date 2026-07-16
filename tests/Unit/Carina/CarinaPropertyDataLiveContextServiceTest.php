<?php

declare(strict_types=1);

use App\Services\Carina\CarinaPropertyDataLiveContextService;
use App\Services\Deals\PropertyDataService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Http::preventStrayRequests();
    Config::set('ai.carina_propertydata.enabled', true);
    Config::set('ai.carina_propertydata.timeout_seconds', 8);
    Config::set('ai.carina_propertydata.max_postcodes', 2);
});

it('suggests tavily when propertydata lite bundle has no successful sections', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/*' => Http::response(['status' => 'error', 'message' => 'unavailable'], 200),
    ]);
    Cache::flush();

    $svc = new CarinaPropertyDataLiveContextService(new PropertyDataService('api-key'));
    $out = $svc->augmentChatTurn(null, 'What are typical yields in M1 1AE for buy to let underwriting?');

    expect($out['block'])->toBe('')
        ->and($out['suggest_tavily'])->toBeTrue()
        ->and($out['tavily_query_hint'])->toContain('M1');
});

it('returns live propertydata block when at least one section succeeds', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/yields*' => Http::response(['status' => 'success', 'data' => ['long_let' => ['gross_yield' => '5.1%']]], 200),
        'https://api.propertydata.co.uk/sold-prices*' => Http::response(['status' => 'error', 'message' => 'x'], 200),
        'https://api.propertydata.co.uk/rents*' => Http::response(['status' => 'error', 'message' => 'y'], 200),
        'https://api.propertydata.co.uk/valuation-sale*' => Http::response(['status' => 'error', 'message' => 'z'], 200),
    ]);
    Cache::flush();

    $svc = new CarinaPropertyDataLiveContextService(new PropertyDataService('api-key'));
    $out = $svc->augmentChatTurn(null, 'Compare yields around NE1 4LP for investors.');

    expect($out['block'])->toContain('PropertyData')->toContain('average_yields')
        ->and($out['suggest_tavily'])->toBeFalse();
});

it('returns nothing when carina propertydata is disabled', function (): void {
    Config::set('ai.carina_propertydata.enabled', false);
    Http::fake();

    $svc = new CarinaPropertyDataLiveContextService(new PropertyDataService('api-key'));
    $out = $svc->augmentChatTurn(null, 'Yields in SW1A 1AA for BTL?');

    expect($out['block'])->toBe('')
        ->and($out['suggest_tavily'])->toBeFalse();
    Http::assertNothingSent();
});
