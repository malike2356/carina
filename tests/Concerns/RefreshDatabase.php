<?php

declare(strict_types=1);

namespace Tests\Concerns;

use App\Support\TestingCentralCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase as BaseRefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PDOException;
use Tests\Support\PostgresSharedTestDatabase;
use Throwable;

/**
 * Laravel's migrate:fresh only runs db:wipe on the default connection. Migrations that
 * target the `central` connection still apply DDL to the central database; if it is a
 * different physical database than the default, it is never dropped and schema can drift.
 * Wipe central before migrate:fresh when the two connections do not share the same DB.
 *
 * When default and central share one Postgres database, parallel migrate:fresh calls can
 * corrupt the catalog. We take a temp-dir file lock (see PostgresSharedTestDatabase) and
 * retry only on Postgres deadlock after purging connections so the next attempt uses fresh handles.
 */
trait RefreshDatabase
{
    use BaseRefreshDatabase {
        migrateDatabases as runLaravelMigrateDatabases;
        refreshTestDatabase as runLaravelRefreshTestDatabase;
        migrateFreshUsing as baseMigrateFreshUsing;
    }

    protected function migrateFreshUsing()
    {
        $args = $this->baseMigrateFreshUsing();

        if (app()->environment('testing')) {
            $template = PostgresSharedTestDatabase::templateAppDatabaseConnectionName();
            if (is_array(config("database.connections.{$template}"))) {
                $args['--database'] = $template;
            }
        }

        return $args;
    }

    protected function refreshTestDatabase(): void
    {
        $this->prepareTestingConnectionsForMigrate();

        if (RefreshDatabaseState::$migrated && ! $this->centralTestingSchemaIntact()) {
            RefreshDatabaseState::$migrated = false;
        }

        if (RefreshDatabaseState::$migrated && ! $this->defaultTestingSchemaIntact()) {
            RefreshDatabaseState::$migrated = false;
        }

        $this->runLaravelRefreshTestDatabase();

        $this->resetTestingDefaultConnectionToTemplate();
    }

    /**
     * stancl sets config('database.default') to the central connection name after tenancy ends.
     * Leave it there and sub-requests can resolve DB state inconsistently with the template connection.
     */
    private function resetTestingDefaultConnectionToTemplate(): void
    {
        if (! app()->environment('testing')) {
            return;
        }

        $name = (string) env('DB_CONNECTION', 'pgsql');
        if ($name === '' || ! is_array(config("database.connections.{$name}"))) {
            return;
        }

        config(['database.default' => $name]);
        $this->app['db']->setDefaultConnection($name);
    }

    /**
     * Before migrate:fresh or schema probes, ensure the central connection targets the shared
     * application catalog (not a tenant DB) and the default connection is the template app
     * connection so db:wipe and the migration repository hit the same Postgres database as
     * central DDL migrations.
     */
    private function prepareTestingConnectionsForMigrate(): void
    {
        if (! app()->environment('testing')) {
            return;
        }

        TestingCentralCatalog::realignCentralConnectionForTesting();
        $this->resetTestingDefaultConnectionToTemplate();
    }

    private function defaultTestingSchemaIntact(): bool
    {
        try {
            $conn = PostgresSharedTestDatabase::templateAppDatabaseConnectionName();

            return Schema::connection($conn)->hasTable('migrations')
                && Schema::connection($conn)->hasTable('users');
        } catch (Throwable) {
            return false;
        }
    }

    private function centralTestingSchemaIntact(): bool
    {
        try {
            return Schema::connection('central')->hasTable('tenants')
                && Schema::connection('central')->hasTable('domains')
                && Schema::connection('central')->hasTable('feature_flags')
                && Schema::connection('central')->hasTable('platform_users')
                && Schema::connection('central')->hasTable('subscription_plans');
        } catch (Throwable) {
            return false;
        }
    }

    protected function migrateDatabases(): void
    {
        PostgresSharedTestDatabase::withCrossProcessMigrateAdvisoryLock(function (): void {
            $this->prepareTestingConnectionsForMigrate();

            if (app()->environment('testing')) {
                PostgresSharedTestDatabase::ensurePublicSchemaExists('pgsql');
                if (PostgresSharedTestDatabase::defaultAndCentralSharePhysicalDatabase()) {
                    PostgresSharedTestDatabase::ensurePublicSchemaExists('central');
                }
            }

            if (! $this->shouldHardenPostgresMigrateFresh()) {
                $this->runLaravelMigrateDatabases();
                PostgresSharedTestDatabase::purgeApplicationDatabaseConnections();
                $this->prepareTestingConnectionsForMigrate();

                return;
            }

            // Do not DROP SCHEMA before the first migrate:fresh attempt. A proactive CASCADE plus
            // DB::purge() can leave the migrator mid-run (e.g. migrations table missing on insert).
            // Rebuild only inside the catch path when a retriable failure warrants a clean catalog.

            for ($attempt = 0; $attempt < 5; $attempt++) {
                try {
                    $this->runLaravelMigrateDatabases();
                    PostgresSharedTestDatabase::purgeApplicationDatabaseConnections();
                    $this->prepareTestingConnectionsForMigrate();

                    break;
                } catch (Throwable $e) {
                    PostgresSharedTestDatabase::rebuildPublicSchemaIfSharedPostgres();
                    $this->purgeSharedPhysicalDatabaseConnections();
                    $this->prepareTestingConnectionsForMigrate();

                    if (! $this->isRetriableMigrateFreshFailure($e) || $attempt >= 4) {
                        throw $e;
                    }

                    RefreshDatabaseState::$migrated = false;
                    usleep(200000 * ($attempt + 1));
                }
            }
        });
    }

    private function purgeSharedPhysicalDatabaseConnections(): void
    {
        $default = (string) config('database.default');

        if (! $this->centralSharesPhysicalDatabaseWithDefault()) {
            DB::purge($default);

            return;
        }

        PostgresSharedTestDatabase::purgeApplicationDatabaseConnections();
    }

    private function isRetriableMigrateFreshFailure(Throwable $e): bool
    {
        if ($this->isLikelyPostgresDeadlock($e)) {
            return true;
        }

        $message = strtolower($e->getMessage());

        if (str_contains($message, 'relation "migrations" does not exist')) {
            return true;
        }
        if (str_contains($message, 'table "migrations" does not exist')) {
            return true;
        }
        if (str_contains($message, 'no schema has been selected')) {
            return true;
        }
        if (str_contains($message, 'pg_type_typname_nsp_index')) {
            return true;
        }
        if (str_contains($message, 'pg_class_relname_nsp_index')) {
            return true;
        }
        if (str_contains($message, 'sqlstate[42p07]') && str_contains($message, 'already exists')) {
            return true;
        }

        $sqlState = ($e instanceof PDOException) ? ($e->errorInfo[0] ?? '') : '';

        if ($sqlState === '42P01') {
            return str_contains($message, 'migrations')
                || str_contains($message, 'tenants')
                || str_contains($message, 'domains');
        }

        return false;
    }

    private function shouldHardenPostgresMigrateFresh(): bool
    {
        if (! app()->environment('testing')) {
            return false;
        }

        if (! $this->centralSharesPhysicalDatabaseWithDefault()) {
            return false;
        }

        $templateName = PostgresSharedTestDatabase::templateAppDatabaseConnectionName();

        return config("database.connections.{$templateName}.driver") === 'pgsql';
    }

    protected function beforeRefreshingDatabase(): void
    {
        if (! $this->centralSharesPhysicalDatabaseWithDefault()) {
            for ($attempt = 0; $attempt < 3; $attempt++) {
                try {
                    Artisan::call('db:wipe', [
                        '--database' => 'central',
                        '--force' => true,
                    ]);

                    return;
                } catch (Throwable $e) {
                    if ($attempt < 2 && $this->isLikelyPostgresDeadlock($e)) {
                        usleep(200000);

                        continue;
                    }

                    return;
                }
            }
        }
    }

    protected function centralSharesPhysicalDatabaseWithDefault(): bool
    {
        return PostgresSharedTestDatabase::defaultAndCentralSharePhysicalDatabase();
    }

    private function isLikelyPostgresDeadlock(Throwable $e): bool
    {
        $sqlState = ($e instanceof PDOException) ? ($e->errorInfo[0] ?? '') : '';

        return $sqlState === '40P01'
            || str_contains(strtolower($e->getMessage()), 'deadlock detected');
    }
}
