<?php

declare(strict_types=1);

return [
    'session_max_hours' => (int) env('REMOTE_ACCESS_SESSION_MAX_HOURS', 4),
    'inactivity_timeout_minutes' => (int) env('REMOTE_ACCESS_INACTIVITY_TIMEOUT_MINUTES', 30),
    'require_reason_override_min_chars' => (int) env('REMOTE_ACCESS_OVERRIDE_REASON_MIN', 50),
    'require_reason_normal_min_chars' => (int) env('REMOTE_ACCESS_NORMAL_REASON_MIN', 0),
    'gdpr_reconfirm_hours' => (int) env('REMOTE_ACCESS_GDPR_RECONFIRM_HOURS', 4),
    'notify_tenant_on_access' => filter_var(env('REMOTE_ACCESS_NOTIFY_ON_ACCESS', true), FILTER_VALIDATE_BOOL),
    'notify_tenant_on_override' => filter_var(env('REMOTE_ACCESS_NOTIFY_ON_OVERRIDE', true), FILTER_VALIDATE_BOOL),
    'notify_tenant_on_end' => filter_var(env('REMOTE_ACCESS_NOTIFY_ON_END', true), FILTER_VALIDATE_BOOL),
    'log_retention_days' => (int) env('REMOTE_ACCESS_LOG_RETENTION_DAYS', 2555),
    'max_concurrent_sessions_per_tenant' => (int) env('REMOTE_ACCESS_MAX_CONCURRENT_PER_TENANT', 1),
    'show_tenant_indicator' => filter_var(env('REMOTE_ACCESS_SHOW_TENANT_INDICATOR', true), FILTER_VALIDATE_BOOL),
    'support_email' => env('REMOTE_ACCESS_SUPPORT_EMAIL', env('MAIL_FROM_ADDRESS', 'support@example.com')),
    'support_phone' => env('REMOTE_ACCESS_SUPPORT_PHONE', ''),
    'entry_token_ttl_minutes' => (int) env('REMOTE_ACCESS_ENTRY_TOKEN_TTL_MINUTES', 10),
];
