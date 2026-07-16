<?php

declare(strict_types=1);

use App\Services\Reporting\DashboardWidgetService;

it('builds mentoring chart payload with normalized keys', function (): void {
    $payload = app(DashboardWidgetService::class)->mentoringChartPayload();

    expect($payload)->toHaveKeys([
        'courseCompleted',
        'courseInProgress',
        'courseNotStarted',
        'menteeNames',
        'menteeScores',
        'sessionsWeekLabels',
        'sessionsWeekCounts',
        'canvasPrefix',
    ])
        ->and($payload['sessionsWeekLabels'])->toBeArray()
        ->and($payload['sessionsWeekCounts'])->toHaveCount(count($payload['sessionsWeekLabels']));
});
