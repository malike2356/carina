<?php

declare(strict_types=1);

return [
    'analytics_cache_ttl' => (int) env('REPORTING_ANALYTICS_CACHE_TTL', 300),

    'execution_retention_days' => (int) env('REPORTING_EXECUTION_RETENTION_DAYS', 90),
];
