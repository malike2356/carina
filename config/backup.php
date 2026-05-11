<?php

declare(strict_types=1);

return [
    'disk' => env('BACKUP_DISK', 'local'),

    'root' => env('BACKUP_ROOT', 'platform-backups'),

    'pg_dump_path' => env('BACKUP_PG_DUMP_PATH', 'pg_dump'),

    'psql_path' => env('BACKUP_PSQL_PATH', 'psql'),

    'encryption_key' => env('BACKUP_ENCRYPTION_KEY'),

    'slack_webhook_url' => env('BACKUP_SLACK_WEBHOOK_URL'),

    'allow_automated_restore' => (bool) env('BACKUP_RESTORE_ALLOWED', false),

    'central_database_url' => env('BACKUP_CENTRAL_DATABASE_URL'),

    'include_tenant_databases' => (bool) env('BACKUP_INCLUDE_TENANT_DBS', true),

    'file_paths' => [
        'storage_app' => storage_path('app'),
        'storage_logs' => storage_path('logs'),
    ],
];
