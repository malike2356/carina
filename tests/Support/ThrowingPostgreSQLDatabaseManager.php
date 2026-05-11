<?php

declare(strict_types=1);

namespace Tests\Support;

use RuntimeException;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\TenantDatabaseManagers\PostgreSQLDatabaseManager;

/**
 * Used in tests to force tenant database creation to fail on PostgreSQL.
 */
final class ThrowingPostgreSQLDatabaseManager extends PostgreSQLDatabaseManager
{
    public function createDatabase(TenantWithDatabase $tenant): bool
    {
        throw new RuntimeException('Simulated database provisioning failure.');
    }
}
