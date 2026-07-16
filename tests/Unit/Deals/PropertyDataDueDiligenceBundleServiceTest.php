<?php

declare(strict_types=1);

use App\Services\Deals\PropertyDataDueDiligenceBundleService;
use App\Services\Deals\PropertyDataService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Http::preventStrayRequests();
    Cache::flush();
});

it('builds a due diligence bundle with core sections', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/*' => Http::response(['status' => 'success', 'data' => ['ok' => true]], 200),
    ]);

    $bundle = new PropertyDataDueDiligenceBundleService(new PropertyDataService('test-key'));
    $out = $bundle->build('LS1 1AA', 3, 'terraced', null, null, 150000);

    expect($out['status'])->toBe('success')
        ->and($out['postcode'])->toBe('LS11AA')
        ->and($out['sections'])->toBeArray()
        ->and($out['sections']['demographics']['status'] ?? null)->toBe('success')
        ->and($out['sections']['rent_estimate']['status'] ?? null)->toBe('success')
        ->and($out['sections']['stamp_duty_calculator']['status'] ?? null)->toBe('success');
});
