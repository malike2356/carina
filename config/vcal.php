<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Guest SMS after booking is confirmed (optional)
    |--------------------------------------------------------------------------
    |
    | Uses tenant Integrations Twilio config when available (SmsService).
    | Disabled by default so local and staging do not send real SMS.
    |
    */
    'sms_on_confirm' => filter_var(env('VCAL_SMS_ON_CONFIRM', false), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Automation / webhooks (future Comms Hub, Zapier-style flows)
    |--------------------------------------------------------------------------
    |
    | Listeners dispatch events; external webhook fan-out can subscribe later.
    |
    */
    'dispatch_automation_events' => filter_var(env('VCAL_DISPATCH_AUTOMATION_EVENTS', true), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Tenant webhook endpoints (Integrations)
    |--------------------------------------------------------------------------
    |
    | When true, viCal dispatches vical.booking.needs_review and
    | vical.booking.confirmed to configured WebhookEndpoint rows.
    |
    */
    'dispatch_integration_webhooks' => filter_var(env('VCAL_DISPATCH_INTEGRATION_WEBHOOKS', true), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Accounting: draft journal on confirmed booking with paid deposit
    |--------------------------------------------------------------------------
    |
    | deposit_recognition=liability: Dr 1000 / Cr 2000 (customer prepayment).
    | deposit_recognition=income: Dr 1000 / Cr 4100 (recognise at payment).
    | Post a follow-up entry when the session is delivered if you use liability.
    |
    */
    'accounting' => [
        'create_deposit_draft_on_confirm' => filter_var(env('VCAL_ACCOUNTING_DEPOSIT_DRAFT', true), FILTER_VALIDATE_BOOLEAN),
        'deposit_recognition' => (static function (): string {
            $v = strtolower(trim((string) env('VCAL_DEPOSIT_RECOGNITION', 'liability')));

            return in_array($v, ['liability', 'income'], true) ? $v : 'liability';
        })(),
    ],

    /*
    |--------------------------------------------------------------------------
    | Comms Hub: optional follow-up sequence for confirmed guests
    |--------------------------------------------------------------------------
    |
    | When communications_hub is enabled for the tenant, enrolls the CRM contact
    | into this sequence slug after VcalBookingConfirmed. Step bodies may use
    | {{workspace.name}}, {{workspace.booking_link}}, {{booking.*}} tokens.
    | When viCal anchors are set: {{booking.mentorship_relationship_id}},
    | {{booking.learning_path_name}}.
    |
    */
    'comms' => [
        'confirmed_guest_sequence_slug' => env('VCAL_COMMS_CONFIRMED_SEQUENCE_SLUG', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | Stripe Connect (optional) for viCal deposits
    |--------------------------------------------------------------------------
    |
    | When deposit_connected_account_id is set (acct_xxx), Checkout Sessions are
    | created on that connected account. application_fee_minor (platform, in
    | minor currency units) is only applied when both are set.
    |
    */
    'stripe' => [
        'deposit_connected_account_id' => env('VCAL_DEPOSIT_STRIPE_CONNECTED_ACCOUNT_ID', ''),
        'deposit_application_fee_minor' => (int) env('VCAL_DEPOSIT_PLATFORM_FEE_MINOR', 0),
    ],
];
