<?php

declare(strict_types=1);

use App\Services\Theme\ThemeCacheService;

it('caches and clears tenant theme css', function () {
    $svc = new ThemeCacheService;
    $svc->cacheVariables('tenant-a', ':root { --x: 1; }');

    expect($svc->getCached('tenant-a'))->toBe(':root { --x: 1; }');

    $svc->invalidateTenant('tenant-a');

    expect($svc->getCached('tenant-a'))->toBeNull();
});
