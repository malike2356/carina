<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Scheduler heartbeat
    |--------------------------------------------------------------------------
    |
    | routes/console.php registers an every-minute closure that updates cache.
    | If the host never runs schedule:run or schedule:work, the admin UI stays
    | stale or unknown. Stale threshold in seconds (default three minutes).
    |
    */

    'heartbeat_stale_seconds' => (int) env('PLATFORM_SCHEDULER_HEARTBEAT_STALE_SECONDS', 180),
];
