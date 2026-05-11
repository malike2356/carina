<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Support\TestingCentralCatalog;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/**
 * When the default and central connections point at one PostgreSQL database, db:wipe
 * alone can leave catalog noise (duplicate typname errors). Rebuild public once before migrate.
 */
final class PostgresSharedTestDatabase
{
    private static int $migrateAdvisoryLockDepth = 0;

    /**
     * migrate:fresh / db:wipe assume {@code public} exists. A failed DROP SCHEMA CASCADE or concurrent
     * rebuild can leave {@code propreneur_testing} without {@code public}, breaking all subsequent wipes.
     */
    public static function ensurePublicSchemaExists(?string $connectionName = null): void
    {
        if (! app()->environment('testing')) {
            return;
        }

        $name = $connectionName ?? (string) config('database.default');

        if (config("database.connections.{$name}.driver") !== 'pgsql') {
            return;
        }

        try {
            $pdo = DB::connection($name)->getPdo();
            $pdo->exec('CREATE SCHEMA IF NOT EXISTS public');
            $pdo->exec('GRANT ALL ON SCHEMA public TO PUBLIC');
            $pdo->exec('SET search_path TO public');
        } catch (Throwable) {
            //
        }
    }

    /**
     * The application DB used for tenant template + central metadata in tests (not stancl's
     * runtime {@see config('database.default')} which may become {@code central}).
     */
    public static function templateAppDatabaseConnectionName(): string
    {
        $preferred = (string) env('DB_CONNECTION', 'pgsql');
        if ($preferred !== '' && is_array(config("database.connections.{$preferred}"))) {
            return $preferred;
        }

        return is_array(config('database.connections.pgsql')) ? 'pgsql' : (string) config('database.default');
    }

    public static function defaultAndCentralSharePhysicalDatabase(): bool
    {
        $templateName = self::templateAppDatabaseConnectionName();
        $template = config('database.connections.'.$templateName);
        $central = config('database.connections.central');
        if (! is_array($template) || ! is_array($central)) {
            return false;
        }

        if (($template['driver'] ?? '') !== 'pgsql') {
            return false;
        }

        // Do not compare against config('database.connections.central.database'): stancl repoints it
        // at tenant catalogs during migrate/create, which would falsely mark the pool as "not shared"
        // and force Domain onto the central slot while it still points at a tenant DB (no domains table).
        $intendedCentralCatalog = self::intendedCentralApplicationCatalogName();
        if ($intendedCentralCatalog === null) {
            return false;
        }

        $templateDb = (string) ($template['database'] ?? '');
        if ($templateDb === '' || $templateDb !== $intendedCentralCatalog) {
            return false;
        }

        return ($template['host'] ?? '') === ($central['host'] ?? '')
            && (string) ($template['port'] ?? '') === (string) ($central['port'] ?? '');
    }

    /**
     * Application catalog for central metadata (tenants, domains), stable while stancl mutates
     * {@see config('database.connections.central.database')} at runtime in tests.
     */
    private static function intendedCentralApplicationCatalogName(): ?string
    {
        $frozen = config('testing.central_application_catalog');
        if (is_string($frozen) && $frozen !== '' && ! TestingCentralCatalog::isTenantPhysicalCatalog($frozen)) {
            return $frozen;
        }

        $resolved = TestingCentralCatalog::applicationCatalogName();
        if ($resolved === null || TestingCentralCatalog::isTenantPhysicalCatalog($resolved)) {
            return null;
        }

        return $resolved;
    }

    /**
     * Serialize migrate:fresh when default and central share one PostgreSQL catalog. A file lock
     * coordinates concurrent PHPUnit or artisan processes without leaving Postgres advisory locks
     * on abandoned sessions if PHP exits mid-migrate.
     */
    public static function withCrossProcessMigrateAdvisoryLock(callable $cb): void
    {
        if (! app()->environment('testing') || ! self::defaultAndCentralSharePhysicalDatabase()) {
            $cb();

            return;
        }

        if (self::$migrateAdvisoryLockDepth > 0) {
            $cb();

            return;
        }

        $template = self::templateAppDatabaseConnectionName();
        if (config("database.connections.{$template}.driver") !== 'pgsql') {
            $cb();

            return;
        }

        $cfg = config("database.connections.{$template}");
        if (! is_array($cfg)) {
            $cb();

            return;
        }

        self::$migrateAdvisoryLockDepth++;

        try {
            $key = hash('sha1', ($cfg['host'] ?? '').'|'.($cfg['port'] ?? '').'|'.($cfg['database'] ?? ''), false);
            $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'propreneur-migrate-fresh-'.$key.'.lock';
            $handle = fopen($path, 'cb');
            if ($handle === false) {
                $cb();

                return;
            }

            try {
                // Blocking flock: concurrent Pest or artisan runs on the same catalog queue here
                // instead of racing LOCK_NB until a short deadline (which fails when another
                // suite holds the lock for a long migrate:fresh).
                if (! flock($handle, LOCK_EX)) {
                    throw new RuntimeException(
                        'Could not acquire migrate:fresh file lock. Close other PHPUnit or artisan '.
                        'processes using the same testing database catalog, then retry.'
                    );
                }

                try {
                    $cb();
                } finally {
                    flock($handle, LOCK_UN);
                }
            } finally {
                fclose($handle);
            }
        } finally {
            self::$migrateAdvisoryLockDepth--;
        }
    }

    public static function rebuildPublicSchemaIfSharedPostgres(): void
    {
        if (! app()->environment('testing')) {
            return;
        }

        $templateName = self::templateAppDatabaseConnectionName();

        if (config("database.connections.{$templateName}.driver") !== 'pgsql') {
            return;
        }

        if (! self::defaultAndCentralSharePhysicalDatabase()) {
            return;
        }

        try {
            $pdo = DB::connection($templateName)->getPdo();
            $pdo->exec('DROP SCHEMA IF EXISTS public CASCADE');
            $pdo->exec('CREATE SCHEMA public');
            $pdo->exec('GRANT ALL ON SCHEMA public TO PUBLIC');
            $pdo->exec('SET search_path TO public');
        } catch (Throwable) {
            // migrate:fresh still performs its own wipe
        }

        self::purgeApplicationDatabaseConnections();
    }

    public static function purgeApplicationDatabaseConnections(): void
    {
        $defaultName = (string) config('database.default');
        $templateName = self::templateAppDatabaseConnectionName();

        foreach (array_unique(['tenant', 'central', $templateName, $defaultName]) as $connection) {
            try {
                DB::purge($connection);
            } catch (Throwable) {
                // Optional connections may be absent from the manager.
            }
        }

        if (! app()->environment('testing') || ! self::defaultAndCentralSharePhysicalDatabase()) {
            return;
        }

        foreach (array_unique(['central', $templateName]) as $connection) {
            try {
                if (config("database.connections.{$connection}.driver") === 'pgsql') {
                    DB::connection($connection)->statement('SET search_path TO public');
                }
            } catch (Throwable) {
                //
            }
        }
    }
}
