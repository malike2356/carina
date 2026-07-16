<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Presentation demo workspaces
    |--------------------------------------------------------------------------
    |
    | Only tenants whose slug appears here may be reset via platform admin or
    | propreneur:reset-demo-workspace. Comma-separated in PRESENTATION_DEMO_SLUGS.
    |
    */

    'allowlisted_slugs' => array_values(array_filter(array_map(
        static fn (string $slug): string => trim($slug),
        explode(',', (string) env('PRESENTATION_DEMO_SLUGS', 'demo')),
    ))),

    'default_profile' => (string) env('PRESENTATION_DEMO_PROFILE', 'mixed_portfolio'),

    'mark_owner_verified' => (bool) env('PRESENTATION_DEMO_MARK_OWNER_VERIFIED', true),

    'complete_onboarding_deferred' => (bool) env('PRESENTATION_DEMO_ONBOARDING_DEFERRED', true),

    'hide_getting_started_checklist' => (bool) env('PRESENTATION_DEMO_HIDE_GETTING_STARTED', true),

    /*
    | When true, each allowlisted slug is reset nightly (see routes/console.php).
    */
    'auto_reset_enabled' => (bool) env('PRESENTATION_DEMO_AUTO_RESET', false),

    'auto_reset_time' => (string) env('PRESENTATION_DEMO_AUTO_RESET_TIME', '03:30'),

];
