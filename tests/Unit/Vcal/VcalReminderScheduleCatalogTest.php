<?php

declare(strict_types=1);

use App\Support\Central\PlatformScheduleCatalog;

it('registers viCal booking reminders in the platform schedule catalog', function (): void {
    expect(PlatformScheduleCatalog::slugs())->toContain('vcal-send-booking-reminders');
});
