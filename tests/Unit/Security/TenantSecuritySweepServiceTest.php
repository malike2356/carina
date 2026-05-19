<?php

declare(strict_types=1);

use App\Services\Security\TenantSecuritySweepService;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns an empty sweep when there are no central tenants', function (): void {
    expect(app(TenantSecuritySweepService::class)->sweep())->toBe([]);
});
