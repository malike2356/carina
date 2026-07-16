<?php

declare(strict_types=1);

return [
    'invite_ttl_hours' => (int) env('TENANT_PORTAL_INVITE_TTL_HOURS', 72),
    'session_ttl_hours' => (int) env('TENANT_PORTAL_SESSION_TTL_HOURS', 24),
];
