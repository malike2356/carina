<?php

declare(strict_types=1);
use App\Services\Deals\Drivers\OnTheMarketListingImportDriver;
use App\Services\Deals\Drivers\OpenRentListingImportDriver;
use App\Services\Deals\Drivers\RightmoveListingImportDriver;
use App\Services\Deals\Drivers\SpareRoomListingImportDriver;
use App\Services\Deals\Drivers\ZooplaListingImportDriver;

return [

    /*
    |--------------------------------------------------------------------------
    | Listing import driver (single URL flow)
    |--------------------------------------------------------------------------
    |
    | url     — Fetch public listing HTML and parse JSON-LD / Open Graph (free).
    | partner — POST the listing URL (or payload) to a paid partner normaliser API.
    | chain   — Try partner when configured; otherwise fall back to url.
    |
    */
    'import_driver' => env('LISTINGS_IMPORT_DRIVER', 'chain'),

    'url' => [
        'timeout' => (int) env('LISTINGS_URL_TIMEOUT', 15),
    ],

    /*
    |--------------------------------------------------------------------------
    | Portal-specific HTTP drivers (used by chain before generic url driver)
    |--------------------------------------------------------------------------
    */
    'portal_drivers' => [
        'rightmove' => RightmoveListingImportDriver::class,
        'zoopla' => ZooplaListingImportDriver::class,
        'onthemarket' => OnTheMarketListingImportDriver::class,
        'openrent' => OpenRentListingImportDriver::class,
        'spareroom' => SpareRoomListingImportDriver::class,
    ],

    'browser_render' => [
        'enabled' => (bool) env('LISTING_BROWSER_RENDER', false),
        'service_url' => env('LISTING_SCRAPING_SERVICE_URL'),
        'fallback_on_failure' => (bool) env('LISTING_BROWSER_RENDER_FALLBACK', true),
    ],

    'user_agents' => [
        'desktop' => env(
            'LISTINGS_HTTP_USER_AGENT',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ),
        'mobile' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ],

    'partner' => [
        'enabled' => (bool) env('LISTINGS_PARTNER_ENABLED', false),
        'base_url' => env('LISTINGS_PARTNER_BASE_URL'),
        'token' => env('LISTINGS_PARTNER_TOKEN'),
        'timeout' => (int) env('LISTINGS_PARTNER_TIMEOUT', 30),
        'import_path' => env('LISTINGS_PARTNER_IMPORT_PATH', '/listings/import'),
        'url_field' => env('LISTINGS_PARTNER_URL_FIELD', 'url'),
        /*
        | How the single-URL import authenticates to your partner adapter.
        | bearer   — Authorization: Bearer {token} (default; Laravel Http::withToken).
        | api_key  — Custom header (see api_key_header) with raw token value.
        */
        'auth_scheme' => env('LISTINGS_PARTNER_AUTH_SCHEME', 'bearer'),
        'api_key_header' => env('LISTINGS_PARTNER_API_KEY_HEADER', 'X-Api-Key'),
    ],

    'chain' => [
        'try_partner_first' => (bool) env('LISTINGS_CHAIN_TRY_PARTNER_FIRST', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Opt-in listing automation (free portal HTML + search URL discovery)
    |--------------------------------------------------------------------------
    |
    | Users create watches under Deal Engine sourcing. Disabled globally when
    | LISTING_AUTOMATION_ENABLED=false. Scheduler gated by LISTING_AUTOMATION_SCHEDULER_ENABLED.
    |
    */
    'automation' => [
        'enabled' => (bool) env('LISTING_AUTOMATION_ENABLED', true),
        'scheduler_enabled' => (bool) env('LISTING_AUTOMATION_SCHEDULER_ENABLED', true),
        'max_urls_per_watch' => (int) env('LISTING_AUTOMATION_MAX_URLS_PER_WATCH', 8),
        'delay_microseconds' => (int) env('LISTING_AUTOMATION_DELAY_MICROSECONDS', 750_000),
        'search_fetch_timeout' => (int) env('LISTING_AUTOMATION_SEARCH_TIMEOUT', 20),
    ],

    /*
    |--------------------------------------------------------------------------
    | Licensed feed / partner batch ingestion (automation plumbing)
    |--------------------------------------------------------------------------
    |
    | Commercial programmes (Rightmove RTDF-class, portal partner APIs, or your
    | own aggregator) supply stable fields, images, and contract-bound use rights.
    | Pipeline (when implemented): poll or receive webhook → normalise → dedupe
    | → upsert Property (+ rightmove_id / zoopla_id) → attach DealAnalysis / images
    | per licence (store copies vs licensed CDN URLs — see ingestion.image_handling).
    |
    | LISTINGS_FEED_POLL_ENABLED gates the scheduler; credentials stay in .env only.
    |
    */
    'ingestion' => [
        'poll_enabled' => (bool) env('LISTINGS_FEED_POLL_ENABLED', false),
        /*
        | Optional HTTP endpoint your side or a vendor exposes for "since cursor"
        | batch JSON. When null, the poll job is a no-op aside from logging skip.
        */
        'batch_poll_url' => env('LISTINGS_FEED_BATCH_POLL_URL'),
        'batch_poll_method' => env('LISTINGS_FEED_BATCH_POLL_METHOD', 'GET'),
        'batch_bearer_token' => env('LISTINGS_FEED_BATCH_BEARER_TOKEN'),
        'batch_timeout' => (int) env('LISTINGS_FEED_BATCH_TIMEOUT', 120),
        /*
        | licensed_cdn — persist partner image URLs only (contract must allow hotlinking).
        | mirror_disk  — download and store under your disk (S3/local); higher storage, clearer compliance.
        */
        'image_handling' => env('LISTINGS_FEED_IMAGE_HANDLING', 'licensed_cdn'),
        /*
        | Dedupe priority when writing Property rows from feed items.
        | Values: portal_ids, postcode_address_hash, source_url
        */
        'dedupe_strategy' => env('LISTINGS_FEED_DEDUPE_STRATEGY', 'portal_ids'),
        'max_items_per_run' => (int) env('LISTINGS_FEED_MAX_ITEMS_PER_RUN', 200),
        /*
        | User id in the tenant DB to own feed-created rows (defaults to first user if unset).
        */
        'default_actor_user_id' => env('LISTINGS_FEED_DEFAULT_ACTOR_USER_ID'),
        /*
        | Initial deal strategy and status for feed-created analyses (btl, hmo, etc.).
        */
        'default_strategy' => env('LISTINGS_FEED_DEFAULT_STRATEGY', 'btl'),
        'deal_status' => env('LISTINGS_FEED_DEAL_STATUS', 'draft'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Commercial programme placeholders (enable when you have a contract)
    |--------------------------------------------------------------------------
    |
    | These blocks document env hooks for paid feeds. No client ships until you
    | wire vendor-specific parsers under App\Services\Deals\ListingFeeds\.
    |
    */
    'commercial' => [
        'rightmove_rtdf' => [
            'enabled' => (bool) env('LISTINGS_RIGHTMOVE_RTDF_ENABLED', false),
            'api_base_url' => env('LISTINGS_RIGHTMOVE_RTDF_BASE_URL'),
            'client_id' => env('LISTINGS_RIGHTMOVE_RTDF_CLIENT_ID'),
            'client_secret' => env('LISTINGS_RIGHTMOVE_RTDF_CLIENT_SECRET'),
            'tenant_scope' => env('LISTINGS_RIGHTMOVE_RTDF_TENANT_SCOPE'),
        ],
        'zoopla_partner' => [
            'enabled' => (bool) env('LISTINGS_ZOOPLA_PARTNER_ENABLED', false),
            'api_base_url' => env('LISTINGS_ZOOPLA_PARTNER_BASE_URL'),
            'api_key' => env('LISTINGS_ZOOPLA_PARTNER_API_KEY'),
        ],
        'onthemarket_partner' => [
            'enabled' => (bool) env('LISTINGS_OTM_PARTNER_ENABLED', false),
            'api_base_url' => env('LISTINGS_OTM_PARTNER_BASE_URL'),
            'client_id' => env('LISTINGS_OTM_PARTNER_CLIENT_ID'),
            'client_secret' => env('LISTINGS_OTM_PARTNER_CLIENT_SECRET'),
        ],
        'aggregator_adapter' => [
            'enabled' => (bool) env('LISTINGS_AGGREGATOR_ADAPTER_ENABLED', false),
            'base_url' => env('LISTINGS_AGGREGATOR_ADAPTER_BASE_URL'),
            'token' => env('LISTINGS_AGGREGATOR_ADAPTER_TOKEN'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Inbound webhook (push feed from partner)
    |--------------------------------------------------------------------------
    |
    | Route registration is a follow-up; this is the shared secret for verifying
    | HMAC or bearer callbacks when you add POST /api/.../listing-feed/webhook.
    |
    */
    'webhook' => [
        'enabled' => (bool) env('LISTINGS_FEED_WEBHOOK_ENABLED', false),
        'signing_secret' => env('LISTINGS_FEED_WEBHOOK_SIGNING_SECRET'),
    ],
];
