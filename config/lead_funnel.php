<?php

declare(strict_types=1);

return [
    'meta' => [
        'app_id' => env('META_APP_ID'),
        'app_secret' => env('META_APP_SECRET'),
        'webhook_verify_token' => env('META_WEBHOOK_VERIFY_TOKEN'),
        'redirect_uri' => env('META_REDIRECT_URI'),
        'graph_version' => env('META_GRAPH_VERSION', 'v18.0'),
    ],
    'linkedin' => [
        'client_id' => env('LINKEDIN_CLIENT_ID'),
        'client_secret' => env('LINKEDIN_CLIENT_SECRET'),
        'redirect_uri' => env('LINKEDIN_REDIRECT_URI'),
    ],
    'tiktok' => [
        'app_id' => env('TIKTOK_APP_ID'),
        'app_secret' => env('TIKTOK_APP_SECRET'),
        'redirect_uri' => env('TIKTOK_REDIRECT_URI'),
    ],
    'token_encryption_key' => env('INTEGRATION_TOKEN_ENCRYPTION_KEY'),
    'oauth_state_ttl_seconds' => 600,
    'hot_lead_score_threshold' => 120,
    'dead_lead_score_threshold' => 10,

    /**
     * Create CRM contacts immediately for website/landing-page ingest (no queue worker required).
     */
    'sync_landing_page_crm' => env('LEAD_FUNNEL_SYNC_LANDING_PAGE_CRM', true),
];
