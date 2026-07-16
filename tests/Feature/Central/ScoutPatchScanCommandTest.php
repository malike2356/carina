<?php

declare(strict_types=1);

use App\Services\Security\PatchScanService;

it('runs scout patch scan command', function () {
    $this->mock(PatchScanService::class, function ($mock): void {
        $mock->shouldReceive('scan')->once()->andReturn([]);
    });

    $this->artisan('scout:patch-scan')->assertSuccessful();
});
