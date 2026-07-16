<?php

declare(strict_types=1);

use App\Models\Central\PlatformRole;

it('seeds preset platform staff roles with expected permission counts', function () {
    expect(PlatformRole::query()->where('guard_name', 'platform')->where('name', 'saas_operator')->exists())->toBeTrue()
        ->and(PlatformRole::query()->where('guard_name', 'platform')->where('name', 'billing_operator')->exists())->toBeTrue();

    $saas = PlatformRole::query()->where('guard_name', 'platform')->where('name', 'saas_operator')->firstOrFail();
    expect($saas->permissions->pluck('name')->sort()->values()->all())->toBe([
        'manage-saas-tenants',
        'manage-subscription-plans',
        'view-saas-tenants',
        'view-subscription-plans',
    ]);

    $support = PlatformRole::query()->where('guard_name', 'platform')->where('name', 'support')->firstOrFail();
    expect($support->permissions->pluck('name')->sort()->values()->all())->toBe([
        'use-admin-search',
        'use-platform-carina',
        'view-backups',
        'view-feature-flags',
        'view-saas-tenants',
        'view-subscription-plans',
    ]);
});
