<?php

declare(strict_types=1);

use App\Models\Tenant\AuditLog;
use App\Services\Audit\AuditHashService;
use App\Services\Audit\AuditService;

it('computes field diff for an audit log row', function (): void {
    $log = new AuditLog([
        'old_values' => ['status' => 'a', 'count' => 1],
        'new_values' => ['status' => 'b', 'count' => 1],
    ]);

    $svc = new AuditService(new AuditHashService);
    $diff = $svc->getChanges($log);

    expect($diff)->toHaveKey('status');
    expect($diff['status']['old'])->toBe('a');
    expect($diff['status']['new'])->toBe('b');
    expect($diff)->not->toHaveKey('count');
});
