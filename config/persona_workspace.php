<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Workspace mode switch - minimum workspace age (days)
    |--------------------------------------------------------------------------
    |
    | Tenant admins see Settings → Workspace mode only after the workspace has
    | existed at least this many days. Set to 0 to disable the rule (show
    | immediately). Overridable in platform admin → Feature flags.
    |
    */
    'mode_switch_min_workspace_age_days' => (int) env('PERSONA_MODE_SWITCH_MIN_DAYS', 0),
];
