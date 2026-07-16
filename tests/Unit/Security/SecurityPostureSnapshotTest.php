<?php

declare(strict_types=1);

use App\Services\Security\SecurityPostureSnapshot;

it('includes extended live posture signal labels', function () {
    $labels = collect(SecurityPostureSnapshot::build()['signal_rows'])->pluck('label')->all();

    expect($labels)->toContain('APP_URL host and scheme')
        ->and($labels)->toContain('Default cache store')
        ->and($labels)->toContain('Default queue connection')
        ->and($labels)->toContain('Session SameSite')
        ->and($labels)->toContain('Session HTTP-only cookie');
});
