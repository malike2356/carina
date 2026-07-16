<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Composer binary for dependency audits
    |--------------------------------------------------------------------------
    |
    | Used by scout:patch-scan. Requires Composer 2.4+ with the "audit" command.
    |
    */
    'composer_binary' => env('SCOUT_COMPOSER_BIN', 'composer'),

    /*
    |--------------------------------------------------------------------------
    | Timeout (seconds) for composer audit
    |--------------------------------------------------------------------------
    */
    'composer_audit_timeout' => (int) env('SCOUT_COMPOSER_AUDIT_TIMEOUT', 180),

    /*
    |--------------------------------------------------------------------------
    | PHPStan (Larastan) for SCOUT SAST
    |--------------------------------------------------------------------------
    */
    'phpstan_binary' => env('SCOUT_PHPSTAN_BIN'),

    'phpstan_config' => env('SCOUT_PHPSTAN_CONFIG'),

    'phpstan_timeout' => (int) env('SCOUT_PHPSTAN_TIMEOUT', 600),

];
