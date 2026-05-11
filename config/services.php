<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
    ],

    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_TOKEN'),
        'from' => env('TWILIO_FROM'),
    ],

    'truelayer' => [
        'client_id' => env('TRUELAYER_CLIENT_ID'),
        'client_secret' => env('TRUELAYER_CLIENT_SECRET'),
        'redirect_uri' => env('TRUELAYER_REDIRECT_URI'),
        'auth_base' => env('TRUELAYER_AUTH_BASE', 'https://auth.truelayer.com'),
        'api_base' => env('TRUELAYER_API_BASE', 'https://api.truelayer.com'),
        'access_token' => env('TRUELAYER_ACCESS_TOKEN'),
    ],

    'zoom' => [
        'access_token' => env('ZOOM_ACCESS_TOKEN'),
    ],

    'google_calendar' => [
        'access_token' => env('GOOGLE_CALENDAR_ACCESS_TOKEN'),
    ],

    'xero' => [
        'access_token' => env('XERO_ACCESS_TOKEN'),
        'tenant_id' => env('XERO_TENANT_ID'),
    ],

    'quickbooks' => [
        'access_token' => env('QUICKBOOKS_ACCESS_TOKEN'),
        'realm_id' => env('QUICKBOOKS_REALM_ID'),
        'api_base' => env('QUICKBOOKS_API_BASE'),
    ],

    'propertydata' => [
        /** Fallback when no platform key is stored in central platform_settings (integrations group). */
        'key' => env('PROPERTYDATA_API_KEY'),
        /** Public site for manual area research (no API key required in browser). */
        'public_research_url' => env('PROPERTYDATA_PUBLIC_URL', 'https://www.propertydata.co.uk'),
    ],

    /**
     * UK MHCLG domestic EPC open data (epc.opendatacommunities.org). Auth: HTTP Basic, Base64(email:api_key).
     * Prefer platform_settings (Admin Platform keys Integrations tab); these env vars are fallbacks.
     */
    'epc_opendata' => [
        'auth_email' => env('EPC_OPENDATA_AUTH_EMAIL'),
        'api_key' => env('EPC_OPENDATA_API_KEY'),
        'base_url' => env('EPC_OPENDATA_BASE_URL', 'https://epc.opendatacommunities.org'),
    ],

    'mapbox' => [
        'token' => env('MAPBOX_TOKEN'),
    ],

    /**
     * When false, sourcing match notifications skip the mail channel (database only).
     */
    'sourcing_match_notifications' => [
        'mail' => filter_var(env('SOURCING_MATCH_NOTIFICATIONS_MAIL', '1'), FILTER_VALIDATE_BOOLEAN),
    ],

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
