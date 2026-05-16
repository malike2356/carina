<?php

declare(strict_types=1);

use App\Services\Audit\AuditRetentionService;

it('matches wildcard retention patterns', function (): void {
    $s = new AuditRetentionService;

    expect($s->policyMatchesEvent('auth.login.failure', 'auth.*'))->toBeTrue();
    expect($s->policyMatchesEvent('model.created', 'model.*'))->toBeTrue();
    expect($s->policyMatchesEvent('anything', '*'))->toBeTrue();
    expect($s->policyMatchesEvent('other', 'auth.*'))->toBeFalse();
});
