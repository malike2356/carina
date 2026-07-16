<?php

declare(strict_types=1);

return [
    'auto_defer_on_bootstrap' => filter_var(env('WORKSPACE_ONBOARDING_AUTO_DEFER', true), FILTER_VALIDATE_BOOL),
    'magic_link_ttl_minutes' => (int) env('WORKSPACE_MAGIC_LOGIN_TTL_MINUTES', 30),
];
