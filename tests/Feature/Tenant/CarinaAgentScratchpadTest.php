<?php

declare(strict_types=1);

/**
 * Persistence coverage lives in tests/Unit/Carina/CarinaAgentScratchpadPersistenceTest.php
 * so local runs are not blocked on the shared Postgres migrate:fresh file lock used by
 * Feature RefreshDatabase. CI still runs the full suite via that Unit file plus
 * CarinaAgentScratchpadToolTest.php.
 */
it('defers persistence tests to the unit suite', function (): void {
    expect(true)->toBeTrue();
});
