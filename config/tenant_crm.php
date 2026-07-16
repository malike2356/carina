<?php

declare(strict_types=1);

return [
    'auto_tasks' => [
        'enabled' => env('TENANT_CRM_AUTO_TASKS', true),
        'trial_warning_days' => [7, 1],
        'stalled_onboarding_days' => 3,
        'ghost_trial_days' => 7,
        'renewal_window_days' => 30,
    ],
    'ops_digest' => [
        'enabled' => env('TENANT_CRM_OPS_DIGEST', true),
        'opt_in_user_ids' => env('TENANT_CRM_OPS_DIGEST_OPT_IN_USER_IDS', ''),
    ],
];
