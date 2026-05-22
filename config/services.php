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

    /*
    | Inbound CRM email webhooks (POST /webhooks/email/inbound).
    | Mailgun: signing key from Mailgun control panel (Settings > Webhooks), or MAILGUN_SECRET.
    | Postmark: server API token used to verify X-Postmark-Signature (HMAC-SHA256 of raw body).
    | Shared secret: optional X-Propreneur-Inbound-Secret header for other providers.
    | require_signature: null = required in production when any credential is set; always skippable in local/testing without credentials.
    */
    'inbound_email_webhook' => [
        'mailgun_signing_key' => env('MAILGUN_WEBHOOK_SIGNING_KEY', env('MAILGUN_SECRET')),
        'postmark_server_token' => env('POSTMARK_SERVER_TOKEN', env('POSTMARK_API_KEY')),
        'shared_secret' => env('INBOUND_EMAIL_WEBHOOK_SECRET'),
        'max_timestamp_skew_seconds' => (int) env('INBOUND_EMAIL_WEBHOOK_MAX_SKEW', 900),
        'require_signature' => env('INBOUND_EMAIL_WEBHOOK_REQUIRE_SIGNATURE'),
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
        'client_id' => env('GOOGLE_CALENDAR_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CALENDAR_CLIENT_SECRET'),
        'access_token' => env('GOOGLE_CALENDAR_ACCESS_TOKEN'),
    ],

    'microsoft_calendar' => [
        'client_id' => env('MICROSOFT_CALENDAR_CLIENT_ID'),
        'client_secret' => env('MICROSOFT_CALENDAR_CLIENT_SECRET'),
        'tenant_id' => env('MICROSOFT_CALENDAR_TENANT_ID', 'common'),
    ],

    'zoho' => [
        'client_id' => env('ZOHO_CLIENT_ID'),
        'client_secret' => env('ZOHO_CLIENT_SECRET'),
        'redirect_uri' => env('ZOHO_REDIRECT_URI'),
        'oauth_scope' => env('ZOHO_OAUTH_SCOPE', 'ZohoBooks.fullaccess.all'),
        'accounts_url' => env('ZOHO_ACCOUNTS_URL', 'https://accounts.zoho.com'),
    ],

    'xero' => [
        'client_id' => env('XERO_CLIENT_ID'),
        'client_secret' => env('XERO_CLIENT_SECRET'),
        'redirect_uri' => env('XERO_REDIRECT_URI'),
        'scopes' => env('XERO_OAUTH_SCOPES', 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access'),
        'default_account_code' => env('XERO_DEFAULT_ACCOUNT_CODE', '200'),
        /** Legacy env-based tokens (optional; OAuth via IntegrationConfig is preferred). */
        'access_token' => env('XERO_ACCESS_TOKEN'),
        'tenant_id' => env('XERO_TENANT_ID'),
    ],

    'freeagent' => [
        'client_id' => env('FREEAGENT_CLIENT_ID'),
        'client_secret' => env('FREEAGENT_CLIENT_SECRET'),
        'redirect_uri' => env('FREEAGENT_REDIRECT_URI'),
        'api_base' => env('FREEAGENT_API_BASE', 'https://api.freeagent.com/v2'),
    ],

    'sage' => [
        'client_id' => env('SAGE_CLIENT_ID'),
        'client_secret' => env('SAGE_CLIENT_SECRET'),
        'redirect_uri' => env('SAGE_REDIRECT_URI'),
        'api_base' => env('SAGE_API_BASE', 'https://api.accounting.sage.com/v3.1'),
        'country' => env('SAGE_COUNTRY', 'gb'),
        'scope' => env('SAGE_OAUTH_SCOPE', 'full_access'),
        'auth_filter' => env('SAGE_AUTH_FILTER', 'apiv3.1'),
    ],

    'quickbooks' => [
        'access_token' => env('QUICKBOOKS_ACCESS_TOKEN'),
        'realm_id' => env('QUICKBOOKS_REALM_ID'),
        'api_base' => env('QUICKBOOKS_API_BASE'),
    ],

    'propertydata' => [
        /** Fallback when no platform key is stored in central platform_settings (integrations group). */
        'key' => (string) (env('PROPERTYDATA_API_KEY') ?: env('PROPERTY_DATA_API_KEY')),
        /** Public site for manual area research (no API key required in browser). */
        'public_research_url' => env('PROPERTYDATA_PUBLIC_URL', 'https://www.propertydata.co.uk'),
        /** Force cURL IPv4 resolution (helps flaky IPv6 networks when calling api.propertydata.co.uk). */
        'http_force_ipv4' => filter_var(env('PROPERTY_DATA_HTTP_FORCE_IPV4', false), FILTER_VALIDATE_BOOL),
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

    /*
    | Carina Remote — Slack Events API (tenant inbound /api/remote/inbound/slack).
    | See docs/CARINA_SLACK_INTEGRATION.md
    */
    'slack_remote' => [
        'bot_token' => env('SLACK_BOT_TOKEN'),
        'signing_secret' => env('SLACK_SIGNING_SECRET'),
    ],

    /*
    | Origins allowed to call POST /api/v1/signup from the static marketing site.
    */
    'marketing_site' => [
        'allowed_origins' => array_values(array_filter([
            'https://propreneur.uk',
            'http://propreneur.uk',
            'https://propreneur.co.uk',
            'http://propreneur.co.uk',
            'http://localhost:8200',
            'http://127.0.0.1:8200',
            env('MARKETING_SITE_ORIGIN'),
        ])),
    ],

    'microsoft_graph' => [
        'client_id' => env('MICROSOFT_GRAPH_CLIENT_ID', ''),
        'client_secret' => env('MICROSOFT_GRAPH_CLIENT_SECRET', ''),
        'tenant_id' => env('MICROSOFT_GRAPH_TENANT_ID', 'common'),
        'access_token' => env('MICROSOFT_GRAPH_ACCESS_TOKEN', ''),
    ],

];
