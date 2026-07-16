<?php

declare(strict_types=1);

use App\Services\Security\SastScanService;

it('runs scout sast scan command', function () {
    $this->mock(SastScanService::class, function ($mock): void {
        $mock->shouldReceive('scan')->once()->andReturn([]);
    });

    $this->artisan('scout:sast-scan')->assertSuccessful();
});
