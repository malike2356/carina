<?php

declare(strict_types=1);

use App\Models\Tenant\AuditLog;
use App\Services\Audit\AuditHashService;

it('computes deterministic hashes for the same audit payload', function (): void {
    $log = new AuditLog([
        'id' => 42,
        'tenant_id' => 'tenant-uuid',
        'event_type' => 'test',
        'model_type' => 'x',
        'model_id' => '1',
        'old_values' => null,
        'new_values' => ['k' => 'v'],
        'created_at' => now(),
    ]);

    $svc = new AuditHashService;
    $a = $svc->computeHash(null, $log);
    $b = $svc->computeHash(null, $log);

    expect($a)->toBe($b)->and(strlen($a))->toBe(64);
});

it('changes hash when previous hash changes', function (): void {
    $log = new AuditLog([
        'id' => 5,
        'tenant_id' => 'tenant-uuid',
        'event_type' => 'test',
        'model_type' => 'x',
        'model_id' => '1',
        'old_values' => null,
        'new_values' => [],
        'created_at' => now(),
    ]);

    $svc = new AuditHashService;
    expect($svc->computeHash('aaa', $log))->not->toBe($svc->computeHash('bbb', $log));
});
