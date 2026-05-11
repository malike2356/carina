<?php

declare(strict_types=1);

use App\Services\Integrations\PropertyDataService;
use App\Services\Integrations\Support\IntegrationRunRecorder;
use App\Support\Integrations\PropertyDataCredentialResolver;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Support\QuietIntegrationRunRecorder;

beforeEach(function (): void {
    Http::preventStrayRequests();
    Cache::flush();
    config(['services.propertydata.key' => 'k']);
    app()->instance(IntegrationRunRecorder::class, new QuietIntegrationRunRecorder);
});

it('delegates getMarketData to the deals client', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/prices*' => Http::response([
            'status' => 'success',
            'average' => 350000,
        ], 200),
    ]);

    $service = new PropertyDataService(
        app(IntegrationRunRecorder::class),
        app(PropertyDataCredentialResolver::class),
    );

    $result = $service->getMarketData('M1 1AE');

    expect($result['status'])->toBe('success')
        ->and($result['average'])->toBe(350000);
});
