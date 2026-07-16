<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Public launch target (ISO 8601 or null)
    |--------------------------------------------------------------------------
    |
    | Shown in waitlist emails and status API for countdown copy. Null hides
    | launch-specific messaging.
    |
    */
    'launch_at' => env('WAITLIST_LAUNCH_AT'),

    /*
    |--------------------------------------------------------------------------
    | Unconfirmed entry retention
    |--------------------------------------------------------------------------
    |
    | Entries without confirmed_at older than this many days may be removed by
    | waitlist:cleanup-unconfirmed.
    |
    */
    'unconfirmed_retention_days' => (int) env('WAITLIST_UNCONFIRMED_RETENTION_DAYS', 14),

    /*
    |--------------------------------------------------------------------------
    | Referral reward threshold
    |--------------------------------------------------------------------------
    |
    | Number of completed referrals before claimReward marks reward_claimed.
    |
    */
    'referral_reward_threshold' => (int) env('WAITLIST_REFERRAL_REWARD_THRESHOLD', 3),

    /*
    |--------------------------------------------------------------------------
    | Interest scoring weights (answers from signup interests JSON)
    |--------------------------------------------------------------------------
    |
    | Keys are optional in the submitted interests payload.
    |
    */
    'scoring' => [
        'capital_high' => 30,
        'capital_medium' => 15,
        'strategy_per_item' => 5,
        'strategy_cap' => 25,
        'timeline_hot' => 20,
        'timeline_warm' => 10,
        'marketing_phone' => 5,
        'marketing_message' => 5,
        'marketing_plan_operator' => 15,
        'marketing_plan_studio' => 20,
    ],
];
