<?php

declare(strict_types=1);

use App\Models\Central\Domain;
use App\Models\Central\Tenant;
use App\Support\TestingCentralCatalog;

it('falls back to central when tenancy central_connection is unset', function (): void {
    $original = config('tenancy.database.central_connection');
    config(['tenancy.database.central_connection' => null]);

    try {
        $meta = TestingCentralCatalog::tenantMetadataConnectionInTests();
        if ($meta !== null) {
            expect((new Tenant)->getConnectionName())->toBe($meta)
                ->and((new Domain)->getConnectionName())->toBe($meta);
        } else {
            expect((new Tenant)->getConnectionName())->toBe('central')
                ->and((new Domain)->getConnectionName())->toBe('central');
        }
    } finally {
        config(['tenancy.database.central_connection' => $original]);
    }
});
