<?php

declare(strict_types=1);

use App\Services\UserManagement\PermissionCacheInvalidator;
use Spatie\Permission\PermissionRegistrar;

afterEach(function (): void {
    Mockery::close();
});

it('delegates to permission registrar to forget cached permissions', function () {
    $registrar = Mockery::mock(PermissionRegistrar::class);
    $registrar->shouldReceive('forgetCachedPermissions')->once();

    $invalidator = new PermissionCacheInvalidator($registrar);
    $invalidator->invalidate();
});
