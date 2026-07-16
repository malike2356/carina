<?php

namespace Tests;

use App\Support\TestingCentralCatalog;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Tests\Support\PostgresSharedTestDatabase;
use Throwable;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if ($this->app->environment('testing')) {
            TestingCentralCatalog::realignCentralConnectionForTesting();

            try {
                DB::connection('central')->getPdo()->exec('SET search_path TO public');
                $template = PostgresSharedTestDatabase::templateAppDatabaseConnectionName();
                if (config("database.connections.{$template}.driver") === 'pgsql') {
                    DB::connection($template)->getPdo()->exec('SET search_path TO public');
                }
            } catch (Throwable) {
            }

            // Laravel's RefreshDatabase registers a beforeApplicationDestroyed callback that sets
            // RefreshDatabaseState::$migrated = false when a transacted connection is no longer in
            // a transaction. That runs before this callback array is cleared; register after
            // parent::setUp so we run after that rollback and keep migrated=true for the next test.
            $this->beforeApplicationDestroyed(function (): void {
                if ($this->app?->environment('testing')) {
                    RefreshDatabaseState::$migrated = true;
                }
            });
        }
    }

    /**
     * When an app connection and `central` share one physical database, only begin one transaction
     * on that connection. Must not use {@see config('database.default')} alone: stancl sets the
     * default connection name to `central` after tenancy ends, which would wrap `central` in a
     * transaction while HTTP sub-requests use a separate DB session and miss central tables.
     *
     * @return array<int, string>
     */
    protected function connectionsToTransact()
    {
        $metadataConn = TestingCentralCatalog::tenantMetadataConnectionInTests();
        if ($metadataConn !== null) {
            return [$metadataConn];
        }

        $central = config('database.connections.central');
        if (! is_array($central)) {
            $fallback = (string) config('database.default');

            return [$fallback, 'central'];
        }

        $tryNames = array_values(array_unique(array_filter([
            'pgsql',
            'mysql',
            'mariadb',
            'sqlite',
            (string) config('database.default'),
        ])));

        foreach ($tryNames as $name) {
            $conn = config("database.connections.{$name}");
            if (! is_array($conn)) {
                continue;
            }

            $samePhysical = ($conn['database'] ?? '') === ($central['database'] ?? '')
                && ($conn['host'] ?? '') === ($central['host'] ?? '')
                && (string) ($conn['port'] ?? '') === (string) ($central['port'] ?? '');

            if ($samePhysical) {
                return [$name];
            }
        }

        $default = (string) config('database.default');
        $defaultConn = config("database.connections.{$default}");
        if (! is_array($defaultConn)) {
            return ['pgsql', 'central'];
        }

        $samePhysical = ($defaultConn['database'] ?? '') === ($central['database'] ?? '')
            && ($defaultConn['host'] ?? '') === ($central['host'] ?? '')
            && (string) ($defaultConn['port'] ?? '') === (string) ($central['port'] ?? '');

        return $samePhysical ? [$default] : [$default, 'central'];
    }
}
