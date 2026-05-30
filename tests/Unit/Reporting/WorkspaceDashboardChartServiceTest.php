<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Services\Reporting\WorkspaceDashboardChartService;

it('returns visible chart bundle when deal engine module is enabled', function (): void {
    $payload = app(WorkspaceDashboardChartService::class)->build(
        [BillingModule::DealEngine->value => true],
        ['equity' => 0, 'total_debt' => 0],
    );

    expect($payload['visible'])->toBeTrue()
        ->and($payload['dealsByStrategy'])->toBeArray()
        ->and($payload['dealActivity'])->toBeArray();
});

it('returns not visible when no chart modules apply', function (): void {
    $payload = app(WorkspaceDashboardChartService::class)->build([], []);

    expect($payload['visible'])->toBeFalse();
});
