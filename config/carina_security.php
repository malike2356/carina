<?php

declare(strict_types=1);

return [
    /*
     * Additional injection patterns to check beyond the built-in list.
     * Loaded from environment so operators can extend without a code deploy.
     * Format: pipe-separated regex patterns.
     */
    'extra_injection_patterns' => env('CARINA_EXTRA_INJECTION_PATTERNS', ''),

    /*
     * When true, quarantined outputs are logged but still returned (monitor mode).
     * When false (default), quarantined outputs are replaced with the safe fallback.
     */
    'output_monitor_only' => env('CARINA_OUTPUT_MONITOR_ONLY', false),

    'upload' => [
        'max_size_mb' => (int) env('UPLOAD_MAX_SIZE_MB', 20),
        'max_archive_uncompressed_mb' => (int) env('UPLOAD_MAX_ARCHIVE_MB', 100),
    ],
];
