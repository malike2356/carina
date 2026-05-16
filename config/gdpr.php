<?php

declare(strict_types=1);

return [
    'export_disk' => env('GDPR_EXPORT_DISK', 'local'),
    'retention_archive_disk' => env('GDPR_RETENTION_ARCHIVE_DISK', 'local'),
    'breach_log_channel' => env('GDPR_BREACH_LOG_CHANNEL', 'stack'),
    'deletion_cooling_off_hours' => (int) env('GDPR_DELETION_COOLING_OFF_HOURS', 24),
];
