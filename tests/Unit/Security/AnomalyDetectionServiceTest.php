<?php

declare(strict_types=1);

use App\Jobs\Security\NotifySecurityAnomalyJob;
use App\Models\Central\SecurityEvent;
use App\Services\Security\AnomalyDetectionService;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Cache::flush();
    Bus::fake();
    config([
        'security.anomaly_detection.enabled' => true,
        'security.anomaly_detection.brute_force_threshold' => 5,
        'security.anomaly_detection.data_export_threshold' => 10,
        'security.anomaly_detection.mass_delete_threshold' => 10,
    ]);
});

function anomalyEventConnection(): string
{
    return (string) (new SecurityEvent)->getConnectionName();
}

it('recordFailedLogin below threshold does not trigger anomaly', function (): void {
    $service = app(AnomalyDetectionService::class);

    for ($i = 0; $i < 4; $i++) {
        $service->recordFailedLogin('probe@example.test', '203.0.113.10', 'tenant-a');
    }

    expect(SecurityEvent::query()->count())->toBe(0);
    Bus::assertNothingDispatched();
});

it('recordFailedLogin at threshold triggers brute_force_login event', function (): void {
    $service = app(AnomalyDetectionService::class);

    for ($i = 0; $i < 5; $i++) {
        $service->recordFailedLogin('brute@example.test', '203.0.113.11', 'tenant-a');
    }

    $this->assertDatabaseHas('security_events', [
        'event' => 'brute_force_login',
        'severity' => SecurityEvent::SEVERITY_HIGH,
        'tenant_id' => 'tenant-a',
    ], anomalyEventConnection());

    Bus::assertDispatched(NotifySecurityAnomalyJob::class, function (NotifySecurityAnomalyJob $job): bool {
        return $job->anomalyType === 'brute_force_login'
            && $job->severity === SecurityEvent::SEVERITY_HIGH;
    });
});

it('recordDataExport below threshold does not trigger event', function (): void {
    $service = app(AnomalyDetectionService::class);

    for ($i = 0; $i < 9; $i++) {
        $service->recordDataExport('user-1', 'tenant-a', 'contacts', 1);
    }

    expect(SecurityEvent::query()->count())->toBe(0);
    Bus::assertNothingDispatched();
});

it('recordDataExport at threshold triggers data_exfil_probe event', function (): void {
    $service = app(AnomalyDetectionService::class);

    for ($i = 0; $i < 9; $i++) {
        $service->recordDataExport('user-1', 'tenant-a', 'contacts', 1);
    }

    $service->recordDataExport('user-1', 'tenant-a', 'contacts', 1);

    $this->assertDatabaseHas('security_events', [
        'event' => 'data_exfil_probe',
        'severity' => SecurityEvent::SEVERITY_HIGH,
    ], anomalyEventConnection());

    Bus::assertDispatched(NotifySecurityAnomalyJob::class, fn (NotifySecurityAnomalyJob $job): bool => $job->anomalyType === 'data_exfil_probe');
});

it('deduplicates anomalies within fifteen minutes', function (): void {
    $service = app(AnomalyDetectionService::class);

    for ($i = 0; $i < 5; $i++) {
        $service->recordFailedLogin('dedupe@example.test', '203.0.113.12', 'tenant-a');
    }

    for ($i = 0; $i < 5; $i++) {
        $service->recordFailedLogin('dedupe@example.test', '203.0.113.12', 'tenant-a');
    }

    expect(SecurityEvent::query()->where('event', 'brute_force_login')->count())->toBe(1);
    Bus::assertDispatchedTimes(NotifySecurityAnomalyJob::class, 1);
});

it('recordMassDelete at threshold triggers mass_delete event', function (): void {
    $service = app(AnomalyDetectionService::class);

    for ($i = 0; $i < 10; $i++) {
        $service->recordMassDelete('user-9', 'tenant-a', 'contacts');
    }

    $this->assertDatabaseHas('security_events', [
        'event' => 'mass_delete',
        'severity' => SecurityEvent::SEVERITY_HIGH,
    ], anomalyEventConnection());

    Bus::assertDispatched(NotifySecurityAnomalyJob::class, fn (NotifySecurityAnomalyJob $job): bool => $job->anomalyType === 'mass_delete');
});
