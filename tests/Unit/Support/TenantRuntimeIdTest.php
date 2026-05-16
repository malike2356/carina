<?php

declare(strict_types=1);

use App\Support\Tenancy\TenantRuntimeId;

it('fromStored accepts int tenant ids', function (): void {
    expect(TenantRuntimeId::fromStored(42))->toBe('42')
        ->and(TenantRuntimeId::fromStored('abc'))->toBe('abc')
        ->and(TenantRuntimeId::fromStored(null))->toBeNull()
        ->and(TenantRuntimeId::fromStored(''))->toBeNull();
});
