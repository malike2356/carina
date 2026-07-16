<?php

declare(strict_types=1);

use App\Services\Integrations\Support\IntegrationRunRecorder;
use App\Services\Integrations\ZoomService;
use Illuminate\Support\Facades\Http;
use Tests\Support\QuietIntegrationRunRecorder;

beforeEach(function (): void {
    Http::preventStrayRequests();
    app()->instance(IntegrationRunRecorder::class, new QuietIntegrationRunRecorder);
});

it('returns error when zoom token is missing', function (): void {
    config(['services.zoom.access_token' => null]);

    $service = app(ZoomService::class);
    $result = $service->createMeeting(['topic' => 'Test']);

    expect($result['status'])->toBe('error');
});

it('creates a meeting when token is configured', function (): void {
    config(['services.zoom.access_token' => 'tok']);

    Http::fake([
        'https://api.zoom.us/v2/users/me/meetings' => Http::response([
            'id' => 999,
            'join_url' => 'https://zoom.test/j',
        ], 201),
    ]);

    $service = app(ZoomService::class);
    $result = $service->createMeeting(['topic' => 'Team sync', 'type' => 2]);

    expect($result['join_url'])->toBe('https://zoom.test/j');
});
