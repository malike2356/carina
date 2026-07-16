<?php

declare(strict_types=1);

/**
 * Central referral wiring is covered in tests/Unit/Referral/SignupReferralWiringTest.php
 * so local runs are not blocked on the shared Postgres migrate:fresh file lock.
 */
it('defers signup referral wiring tests to the unit suite', function (): void {
    expect(true)->toBeTrue();
});
