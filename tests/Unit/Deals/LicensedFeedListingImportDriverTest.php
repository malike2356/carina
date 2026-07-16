<?php

declare(strict_types=1);

use App\Services\Deals\Drivers\LicensedFeedListingImportDriver;

it('documents that the licensed feed driver is not a single URL scraper', function (): void {
    $driver = new LicensedFeedListingImportDriver;
    $result = $driver->importFromUrl('https://example.test/listing');

    expect($driver->driverKey())->toBe('licensed_feed')
        ->and($result['success'])->toBeFalse()
        ->and($result['error'])->toContain('does not support single-URL import');
});
