<?php

declare(strict_types=1);

use App\Models\Central\CanaryToken;
use App\Models\Central\SecurityFinding;
use App\Services\Security\AnomalyFindingBridgeService;
use App\Services\Security\CanaryTokenService;

it('seeds three tokens per tenant', function (): void {
    $tenant = createCentralTenant();
    $service = new CanaryTokenService(app(AnomalyFindingBridgeService::class));

    $service->seedForTenant((string) $tenant->getKey(), 'Test Workspace');

    expect(CanaryToken::query()->where('tenant_id', $tenant->getKey())->count())->toBe(3);
});

it('is idempotent when seeding', function (): void {
    $tenant = createCentralTenant();
    $service = new CanaryTokenService(app(AnomalyFindingBridgeService::class));

    $service->seedForTenant((string) $tenant->getKey(), 'Idempotent Workspace');
    $service->seedForTenant((string) $tenant->getKey(), 'Idempotent Workspace');

    expect(CanaryToken::query()->where('tenant_id', $tenant->getKey())->count())->toBe(3);
});

it('records access and triggers the anomaly bridge', function (): void {
    config(['services.abuseipdb.key' => '']);
    $tenant = createCentralTenant();

    $token = CanaryToken::query()->create([
        'tenant_id' => $tenant->getKey(),
        'token_type' => 'contact',
        'token_key' => 'canary_test_access_key',
        'label' => '[Canary] Test',
    ]);

    $service = new CanaryTokenService(app(AnomalyFindingBridgeService::class));
    $service->recordAccess('canary_test_access_key', 'test actor');

    $token->refresh();

    expect($token->last_accessed_at)->not->toBeNull()
        ->and($token->access_count)->toBe(1);

    $finding = SecurityFinding::query()
        ->where('title', 'Canary token accessed')
        ->where('status', 'open')
        ->first();

    expect($finding)->not->toBeNull()
        ->and($finding?->mitre_technique)->toBe('T1083')
        ->and($finding?->severity)->toBe('critical')
        ->and($finding?->source)->toBe('anomaly_detection');
});
