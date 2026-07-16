<?php

declare(strict_types=1);

use App\Services\Integrations\GoogleCalendarService;
use App\Services\Integrations\Support\IntegrationRunRecorder;
use Illuminate\Support\Facades\Http;
use Tests\Support\QuietIntegrationRunRecorder;

beforeEach(function (): void {
    Http::preventStrayRequests();
    app()->instance(IntegrationRunRecorder::class, new QuietIntegrationRunRecorder);
});

it('returns error when google calendar token is missing', function (): void {
    config(['services.google_calendar.access_token' => null]);

    $service = app(GoogleCalendarService::class);
    $result = $service->createEvent('', ['summary' => 'Hello']);

    expect($result['status'])->toBe('error');
});

it('creates an event when token is configured', function (): void {
    config(['services.google_calendar.access_token' => 'gcal-token']);

    Http::fake([
        'https://www.googleapis.com/calendar/v3/calendars/primary/events' => Http::response([
            'id' => 'evt1',
            'htmlLink' => 'https://calendar.test/e',
        ], 200),
    ]);

    $service = app(GoogleCalendarService::class);
    $result = $service->createEvent('', ['summary' => 'Hello']);

    expect($result['id'])->toBe('evt1');
});
