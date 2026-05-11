<?php

declare(strict_types=1);

use App\Services\Deals\PropertyDataService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Http::preventStrayRequests();
});

it('fetches sold prices from PropertyData API', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/sold-prices*' => Http::response([
            'status' => 'success',
            'data' => [
                ['price' => 250000, 'date' => '2024-01-15', 'property_type' => 'S'],
            ],
        ], 200),
    ]);

    $service = new PropertyDataService('test-api-key');
    $result = $service->soldPrices('B1 1AA');

    expect($result['status'])->toBe('success')
        ->and($result['data'])->toHaveCount(1)
        ->and($result['data'][0]['price'])->toBe(250000);
});

it('fetches rental estimate from PropertyData API', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/rent_estimate*' => Http::response([
            'status' => 'success',
            'data' => ['lower' => 900, 'mid' => 1100, 'upper' => 1300],
        ], 200),
    ]);

    $service = new PropertyDataService('test-api-key');
    $result = $service->rentalEstimate('B1 1AA', 3);

    expect($result['status'])->toBe('success')
        ->and($result['data']['mid'])->toBe(1100);
});

it('caches responses for 24 hours', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/average_yields*' => Http::response([
            'status' => 'success',
            'data' => ['gross_yield' => 5.2],
        ], 200),
    ]);

    $service = new PropertyDataService('test-api-key');

    $first = $service->averageYields('SW1A 1AA');
    $second = $service->averageYields('SW1A 1AA');

    expect($first)->toBe($second);
    Http::assertSentCount(1);
});

it('returns error when api key is not configured', function (): void {
    $service = new PropertyDataService('');
    $result = $service->soldPrices('B1 1AA');

    expect($result['status'])->toBe('error')
        ->and($result['message'])->toContain('API key');
});

it('returns error response when api request fails', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/sold-prices*' => Http::response([], 500),
    ]);

    $service = new PropertyDataService('test-api-key');
    Cache::flush();
    $result = $service->soldPrices('XX1 1XX');

    expect($result['status'])->toBe('error');
});

it('fetches uprn details', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/uprn*' => Http::response([
            'status' => 'success',
            'uprn' => '100012345678',
        ], 200),
    ]);

    $service = new PropertyDataService('test-api-key');
    $result = $service->uprnDetails('100012345678');

    expect($result['status'])->toBe('success')
        ->and($result['uprn'])->toBe('100012345678');
});

it('fetches energy efficiency (EPC) data by postcode', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/energy-efficiency*' => Http::response([
            'status' => 'success',
            'postcode' => 'W149JH',
        ], 200),
    ]);

    $service = new PropertyDataService('test-api-key');
    $result = $service->energyEfficiency('W14 9JH');

    expect($result['status'])->toBe('success');
});

it('rejects empty uprn', function (): void {
    Http::preventStrayRequests();
    $service = new PropertyDataService('test-api-key');
    expect($service->uprnDetails('  ')['status'])->toBe('error');
});

it('fetch parallel merges cached and fresh responses', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/demographics*' => Http::response(['status' => 'success', 'data' => ['x' => 1]], 200),
        'https://api.propertydata.co.uk/population*' => Http::response(['status' => 'success', 'data' => ['y' => 2]], 200),
    ]);

    Cache::flush();
    $service = new PropertyDataService('test-api-key');
    $out = $service->fetchParallel([
        ['endpoint' => 'demographics', 'params' => ['postcode' => 'LS11AA'], 'result_key' => 'demographics'],
        ['endpoint' => 'population', 'params' => ['postcode' => 'LS11AA'], 'result_key' => 'population'],
    ]);

    expect($out['demographics']['status'])->toBe('success')
        ->and($out['population']['status'])->toBe('success');
    Http::assertSentCount(2);
});

it('call forwards to arbitrary endpoint', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/crime*' => Http::response(['status' => 'success', 'data' => []], 200),
    ]);

    $service = new PropertyDataService('test-api-key');
    $r = $service->call('crime', ['postcode' => 'LS11AA']);
    expect($r['status'])->toBe('success');
});
