<?php

declare(strict_types=1);

use App\Support\TestingCentralCatalog;

it('detects stancl tenant physical catalog names', function (): void {
    config(['tenancy.database.prefix' => 'propreneur_t_']);

    expect(TestingCentralCatalog::isTenantPhysicalCatalog('propreneur_t_abcd'))->toBeTrue()
        ->and(TestingCentralCatalog::isTenantPhysicalCatalog('propreneur_testing'))->toBeFalse();
});

it('resolves application catalog from phpunit testing env', function (): void {
    expect(TestingCentralCatalog::applicationCatalogName())->toBe('propreneur_testing');
});
