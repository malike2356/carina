<?php

declare(strict_types=1);

return [
    /*
    | When true, LogRequestMiddleware records a row for routes where the middleware is attached.
    */
    'log_http_mutations' => (bool) env('AUDIT_LOG_HTTP_MUTATIONS', false),

    'archive_disk' => env('AUDIT_ARCHIVE_DISK', 'local'),

    'archive_path' => env('AUDIT_ARCHIVE_PATH', 'audit-archives'),
];
