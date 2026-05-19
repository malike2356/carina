<?php

declare(strict_types=1);

use App\Models\Central\SecurityFinding;
use App\Services\Security\AnomalyFindingBridgeService;
use Illuminate\Support\Facades\Http;

it('creates a security finding for brute force anomalies', function (): void {
    config(['services.abuseipdb.key' => '']);
    Http::fake();

    app(AnomalyFindingBridgeService::class)->bridge('brute_force_login', 'tenant-1', [
        'email' => 'test@example.com',
        'ip' => '10.0.0.1',
        'count' => 7,
        'window' => '10min',
    ]);

    $finding = SecurityFinding::query()
        ->where('title', 'Brute-force login detected')
        ->where('status', 'open')
        ->first();

    expect($finding)->not->toBeNull()
        ->and($finding?->mitre_technique)->toBe('T1110')
        ->and($finding?->severity)->toBe('high')
        ->and($finding?->source)->toBe('anomaly_detection');
});

it('upserts instead of duplicating open findings', function (): void {
    config(['services.abuseipdb.key' => '']);
    Http::fake();

    $bridge = app(AnomalyFindingBridgeService::class);
    $bridge->bridge('credential_stuffing', null, ['ip' => '10.0.0.2']);
    $bridge->bridge('credential_stuffing', null, ['ip' => '10.0.0.3']);

    $count = SecurityFinding::query()
        ->where('title', 'Credential stuffing attack detected')
        ->where('status', 'open')
        ->count();

    expect($count)->toBe(1);
});

it('does not throw for unmapped anomalies', function (): void {
    config(['services.abuseipdb.key' => '']);
    Http::fake();

    app(AnomalyFindingBridgeService::class)->bridge('unmapped_event', null, []);

    expect(true)->toBeTrue();
});
