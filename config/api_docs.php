<?php

declare(strict_types=1);

/**
 * API documentation contract — mirrors brain/prompts/19-mobile-api.md.
 * Add a row here whenever a mobile-relevant route is added or changed.
 */
return [
    'title' => 'Propreneur v2 API',
    'version' => '2.0.0',

    'servers' => [
        ['url' => 'https://{tenant}.propreneur.uk', 'description' => 'Tenant workspace', 'variables' => ['tenant' => ['default' => 'xelox']]],
        ['url' => 'https://propreneur.uk', 'description' => 'Platform admin'],
    ],

    'include_prefixes' => [
        'tenant.api.',
        'tenant.mobile.',
        'tenant.api.v1.mobile.',
        'tenant.api.mobile.',
    ],

    'include_uri_prefixes' => [
        'api/',
        'accounting/',
        'compliance/',
        'documents/',
        'carina/',
        'vcal/',
        'mentoring-os/',
        'reports/',
        'analytics/',
        'investor/',
        'dashboard/',
        'staff/',
    ],

    'default_mobile_status' => 'pending',

    'security_schemes' => [
        'SanctumPAT' => [
            'type' => 'http',
            'scheme' => 'bearer',
            'description' => 'Sanctum personal access token',
        ],
        'PlatformSession' => [
            'type' => 'apiKey',
            'in' => 'cookie',
            'name' => 'propreneur_session',
            'description' => 'Platform admin session cookie',
        ],
    ],

    // Key: "{METHOD}:{uri}" with Laravel placeholders, e.g. GET:api/v1/mobile/profile
    'mobile_status' => [
        'POST:/api/mobile/v1/token' => 'done',
        'GET:/api/mobile/v1/me' => 'done',
        'DELETE:/api/mobile/v1/token' => 'done',

        'POST:/api/v1/mobile/auth/register' => 'done',
        'POST:/api/v1/mobile/auth/login' => 'done',
        'POST:/api/v1/mobile/auth/biometric' => 'done',
        'POST:/api/v1/mobile/auth/refresh' => 'done',
        'POST:/api/v1/mobile/auth/logout' => 'done',

        'POST:/api/v1/mobile/devices' => 'done',
        'POST:/api/v1/mobile/devices/{id}/push-token' => 'done',
        'DELETE:/api/v1/mobile/devices/{id}' => 'done',

        'POST:/api/v1/mobile/sync' => 'done',
        'GET:/api/v1/mobile/sync/pending' => 'done',
        'POST:/api/v1/mobile/sync/mark-synced' => 'done',

        'GET:/api/v1/mobile/profile' => 'done',
        'PATCH:/api/v1/mobile/profile' => 'done',

        'GET:/api/v1/mobile/properties' => 'done',
        'GET:/api/v1/mobile/properties/sync' => 'done',
        'GET:/api/v1/mobile/properties/{property}' => 'done',
        'POST:/api/v1/mobile/properties' => 'pending',
        'PUT:/api/v1/mobile/properties/{property}' => 'pending',
        'DELETE:/api/v1/mobile/properties/{property}' => 'pending',
        'GET:/api/v1/mobile/properties/{property}/documents' => 'pending',
        'GET:/api/v1/mobile/properties/{property}/tenancies' => 'pending',

        'GET:/api/v1/mobile/deals' => 'done',
        'GET:/api/v1/mobile/deals/{deal}' => 'done',
        'POST:/api/v1/mobile/deals/calculate/{strategy}' => 'done',
        'PATCH:/api/v1/mobile/deals/{deal}' => 'done',
        'POST:/api/v1/mobile/deals' => 'pending',
        'DELETE:/api/v1/mobile/deals/{deal}' => 'pending',
        'GET:/api/v1/mobile/deals/{deal}/refurb' => 'pending',
        'POST:/api/v1/mobile/deals/{deal}/refurb' => 'pending',
        'GET:/api/v1/mobile/deals/{deal}/narrative' => 'pending',

        'GET:/api/v1/mobile/pipeline/stages' => 'done',
        'GET:/api/v1/mobile/pipeline/deals' => 'done',
        'POST:/api/v1/mobile/pipeline/deals/{deal}/move' => 'done',

        'GET:/api/mobile/v1/pipeline/stages' => 'done',
        'POST:/api/mobile/v1/pipeline/stages' => 'done',
        'POST:/api/mobile/v1/pipeline/stages/reorder' => 'done',
        'PUT:/api/mobile/v1/pipeline/stages/{stage}' => 'done',
        'DELETE:/api/mobile/v1/pipeline/stages/{stage}' => 'done',
        'GET:/api/mobile/v1/pipeline/deals' => 'done',
        'GET:/api/mobile/v1/pipeline/deals/{deal}' => 'done',
        'POST:/api/mobile/v1/pipeline/deals' => 'done',
        'PUT:/api/mobile/v1/pipeline/deals/{deal}' => 'done',
        'DELETE:/api/mobile/v1/pipeline/deals/{deal}' => 'done',
        'POST:/api/mobile/v1/pipeline/deals/bulk-move' => 'done',
        'POST:/api/mobile/v1/pipeline/deals/{deal}/move' => 'done',
        'GET:/api/mobile/v1/pipeline/analytics/velocity' => 'done',
        'GET:/api/mobile/v1/pipeline/analytics/conversion' => 'done',
        'GET:/api/mobile/v1/pipeline/analytics/stage-duration' => 'done',
        'GET:/api/mobile/v1/pipeline/analytics/forecast' => 'done',

        'POST:/api/v1/mobile/analytics' => 'done',
        'POST:/api/v1/mobile/crash-report' => 'done',

        'GET:/api/v1/mobile/vcal/bookings' => 'done',
        'GET:/api/v1/mobile/vcal/bookings/{booking}' => 'done',
        'POST:/api/v1/mobile/vcal/bookings/{booking}/approve' => 'done',
        'POST:/api/v1/mobile/vcal/bookings/{booking}/reject' => 'done',
        'POST:/api/v1/mobile/vcal/bookings/{booking}/cancel' => 'done',

        // ── Admin (mobile workspace admin slice) ──────────────────────────
        'GET:/api/v1/mobile/admin/users' => 'done',
        'POST:/api/v1/mobile/admin/users' => 'done',

        // ── Assets / Net worth ────────────────────────────────────────────
        'GET:/api/v1/mobile/assets' => 'done',
        'GET:/api/v1/mobile/assets/allocation' => 'done',
        'GET:/api/v1/mobile/assets/net-worth' => 'done',

        // ── Billing ───────────────────────────────────────────────────────
        'GET:/api/v1/mobile/billing/invoices' => 'done',
        'GET:/api/v1/mobile/billing/invoices/{invoice}' => 'done',
        'GET:/api/v1/mobile/billing/plans' => 'done',
        'GET:/api/v1/mobile/billing/plans/{plan}' => 'done',
        'GET:/api/v1/mobile/billing/portal' => 'done',

        // ── Carina AI (read + write) ──────────────────────────────────────
        'GET:/api/v1/mobile/carina/capabilities' => 'done',
        'GET:/api/v1/mobile/carina/conversations' => 'done',
        'POST:/api/v1/mobile/carina/conversations' => 'done',
        'GET:/api/v1/mobile/carina/conversations/{id}' => 'done',
        'DELETE:/api/v1/mobile/carina/conversations/{id}' => 'done',
        'POST:/api/v1/mobile/carina/conversations/{id}/messages' => 'done',
        'POST:/api/v1/mobile/carina/conversations/{id}/messages/stream' => 'done',
        'POST:/api/v1/mobile/carina/conversations/{id}/agent/confirm' => 'done',
        'POST:/api/v1/mobile/carina/conversations/{id}/documents' => 'done',
        'POST:/api/v1/mobile/carina/speech-transcribe' => 'done',
        'GET:/api/v1/mobile/carina/usage' => 'done',

        // ── Compliance (full CRUD wired) ──────────────────────────────────
        'GET:/api/v1/mobile/compliance/items' => 'done',
        'POST:/api/v1/mobile/compliance/items' => 'done',
        'GET:/api/v1/mobile/compliance/items/{compliance}' => 'done',
        'PUT:/api/v1/mobile/compliance/items/{compliance}' => 'done',
        'DELETE:/api/v1/mobile/compliance/items/{compliance}' => 'done',

        // ── CRM contacts (full CRUD wired) ────────────────────────────────
        'GET:/api/v1/mobile/crm/contacts' => 'done',
        'POST:/api/v1/mobile/crm/contacts' => 'done',
        'GET:/api/v1/mobile/crm/contacts/{contact}' => 'done',
        'PUT:/api/v1/mobile/crm/contacts/{contact}' => 'done',
        'DELETE:/api/v1/mobile/crm/contacts/{contact}' => 'done',
        'GET:/api/v1/mobile/crm/contacts/{contact}/interactions' => 'done',
        'POST:/api/v1/mobile/crm/contacts/{contact}/interactions' => 'done',
        'GET:/api/v1/mobile/crm/contacts/{contact}/investor-score' => 'done',
        'GET:/api/v1/mobile/crm/contacts/{contact}/matched-pipeline-deals' => 'done',

        // ── Document Vault ────────────────────────────────────────────────
        'GET:/api/v1/mobile/documents' => 'done',
        'POST:/api/v1/mobile/documents' => 'done',
        'POST:/api/v1/mobile/documents/scan-cert' => 'done',
        'GET:/api/v1/mobile/documents/{document}' => 'done',
        'PUT:/api/v1/mobile/documents/{document}' => 'done',
        'DELETE:/api/v1/mobile/documents/{document}' => 'done',
        'GET:/api/v1/mobile/documents/{document}/versions' => 'done',
        'POST:/api/v1/mobile/documents/{document}/versions' => 'done',

        // ── Mentoring OS ─────────────────────────────────────────────────
        'GET:/api/v1/mobile/mentoring-os/programmes' => 'done',
        'POST:/api/v1/mobile/mentoring-os/programmes' => 'done',
        'GET:/api/v1/mobile/mentoring-os/programmes/{programme}' => 'done',
        'PUT:/api/v1/mobile/mentoring-os/programmes/{programme}' => 'done',
        'DELETE:/api/v1/mobile/mentoring-os/programmes/{programme}' => 'done',
        'GET:/api/v1/mobile/mentoring-os/programmes/{programme}/cohorts' => 'done',
        'POST:/api/v1/mobile/mentoring-os/programmes/{programme}/cohorts' => 'done',
        'GET:/api/v1/mobile/mentoring-os/mentorships' => 'done',
        'GET:/api/v1/mobile/mentoring-os/mentorships/{mentorship}' => 'done',
        'GET:/api/v1/mobile/mentoring-os/mentorships/{mentorship}/goals' => 'done',
        'POST:/api/v1/mobile/mentoring-os/mentorships/{mentorship}/goals' => 'done',
        'PUT:/api/v1/mobile/mentoring-os/mentorships/{mentorship}/goals/{goal}' => 'done',
        'DELETE:/api/v1/mobile/mentoring-os/mentorships/{mentorship}/goals/{goal}' => 'done',
        'GET:/api/v1/mobile/mentoring-os/mentorships/{mentorship}/session-notes' => 'done',
        'POST:/api/v1/mobile/mentoring-os/mentorships/{mentorship}/session-notes' => 'done',

        // ── Pipeline (deal detail under /api/v1/mobile/) ──────────────────
        'GET:/api/v1/mobile/pipeline/deals/{deal}' => 'done',

        // ── Properties tenancy detail ────────────────────────────────────
        'GET:/api/v1/mobile/properties/{property}/tenancies/{tenancy}' => 'done',

        // ── Version / health ─────────────────────────────────────────────
        'GET:/api/v1/mobile/version' => 'done',
    ],
];
