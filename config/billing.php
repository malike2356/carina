<?php

declare(strict_types=1);

use App\Billing\BillingModule;

$m = static fn (BillingModule $case): string => $case->value;

return [
    /*
    |--------------------------------------------------------------------------
    | Stripe keys (fallback when not stored in platform_settings)
    |--------------------------------------------------------------------------
    |
    | Supports both STRIPE_* and STRIPE_BILLING_* env names (legacy / PropBook).
    |
    */
    'stripe_secret' => env('STRIPE_SECRET') ?: env('STRIPE_BILLING_SECRET_KEY'),
    'stripe_webhook_secret' => env('STRIPE_WEBHOOK_SECRET') ?: env('STRIPE_BILLING_WEBHOOK_SECRET'),
    'stripe_publishable_key' => env('STRIPE_KEY') ?: env('STRIPE_BILLING_PUBLISHABLE_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Stripe Price IDs (override subscription_plans.stripe_price_id when set)
    |--------------------------------------------------------------------------
    */
    'price_investor' => env('STRIPE_PRICE_INVESTOR'),
    'price_operator' => env('STRIPE_PRICE_OPERATOR'),
    'price_academy' => env('STRIPE_PRICE_ACADEMY'),

    'default_trial_days' => (int) env('BILLING_DEFAULT_TRIAL_DAYS', 14),

    'subscription_active_statuses' => ['active', 'trialing'],

    'tenant_billing_api_throttle' => env('BILLING_API_THROTTLE', '60,1'),

    'stripe_webhook_throttle' => env('BILLING_STRIPE_WEBHOOK_THROTTLE', '120,1'),

    'stripe_proration_behavior' => env('STRIPE_PRORATION_BEHAVIOR', 'create_prorations'),

    'webhook_idempotency_ttl_days' => (int) env('BILLING_WEBHOOK_IDEMPOTENCY_TTL_DAYS', 3),

    'entitlements_cache_ttl_seconds' => (int) env('BILLING_ENTITLEMENTS_CACHE_TTL', 120),

    'trial_expiry_warning_days' => (int) env('BILLING_TRIAL_EXPIRY_WARNING_DAYS', 3),

    /*
    |--------------------------------------------------------------------------
    | In-app billing banner (tenant layout)
    |--------------------------------------------------------------------------
    |
    | Subscription statuses that show the workspace-wide alert strip (Stripe
    | statuses). Adjust if you add pause/resume flows.
    |
    */
    'attention_banner_statuses' => ['past_due', 'unpaid', 'incomplete'],

    /*
    |--------------------------------------------------------------------------
    | Tenant billing UI (fragment anchor for dashboard deep-link)
    |--------------------------------------------------------------------------
    */
    'ui' => [
        'workspace_billing_anchor' => env('BILLING_UI_WORKSPACE_ANCHOR', 'workspace-billing'),
        'trial_date_format' => env('BILLING_UI_TRIAL_DATE_FORMAT', 'j F Y'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Currency symbols for plan pricing on the dashboard card (ISO 4217 keys)
    |--------------------------------------------------------------------------
    */
    'currency_symbols' => [
        'GBP' => '£',
        'EUR' => '€',
        'USD' => '$',
    ],

    'trial_module_set' => 'trial_expanded',

    /*
    |--------------------------------------------------------------------------
    | Workspace API access (mobile + Sanctum PAT)
    |--------------------------------------------------------------------------
    |
    | Programmatic API is included in the subscription on Operator and above —
    | not a separate SKU. Investor (and any plan below minimum_plan_sort_order)
    | does not receive API access.
    |
    | Policy: brain/knowledge/103-workspace-api-access-policy.md
    | Enforcement middleware: TBD (see knowledge doc).
    |
    */
    'api_access' => [
        'minimum_plan_slug' => 'operator',
        'minimum_plan_sort_order' => 10,
        'denied_plan_slugs' => ['investor'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Module sets (referenced by plan rows and trial_module_set)
    |--------------------------------------------------------------------------
    */
    'module_sets' => [
        'investor' => [
            $m(BillingModule::DealEngine),
            $m(BillingModule::Crm),
            $m(BillingModule::Pipeline),
            $m(BillingModule::Compliance),
            $m(BillingModule::CarinaAi),
            $m(BillingModule::Accounting),
            $m(BillingModule::ReportingIntelligence),
            $m(BillingModule::Vcal),
            $m(BillingModule::Integrations),
        ],
        'operator' => [
            $m(BillingModule::DealEngine),
            $m(BillingModule::Crm),
            $m(BillingModule::Pipeline),
            $m(BillingModule::Compliance),
            $m(BillingModule::CarinaAi),
            $m(BillingModule::CarinaAgent),
            $m(BillingModule::MultiProperty),
            $m(BillingModule::Integrations),
            $m(BillingModule::ReportingIntelligence),
            $m(BillingModule::Accounting),
            $m(BillingModule::Vcal),
            $m(BillingModule::LeadFunnel),
            $m(BillingModule::HrPayroll),
        ],
        'mentor' => [
            $m(BillingModule::DealEngine),
            $m(BillingModule::Crm),
            $m(BillingModule::Pipeline),
            $m(BillingModule::Compliance),
            $m(BillingModule::CarinaAi),
            $m(BillingModule::CarinaAgent),
            $m(BillingModule::MultiProperty),
            $m(BillingModule::MentoringOs),
            $m(BillingModule::CommunityLearning),
            $m(BillingModule::Integrations),
            $m(BillingModule::ReportingIntelligence),
            $m(BillingModule::Accounting),
            $m(BillingModule::Vcal),
            $m(BillingModule::LeadFunnel),
            $m(BillingModule::HrPayroll),
        ],
        'trial_expanded' => [
            $m(BillingModule::DealEngine),
            $m(BillingModule::Crm),
            $m(BillingModule::Pipeline),
            $m(BillingModule::Compliance),
            $m(BillingModule::CarinaAi),
            $m(BillingModule::CarinaAgent),
            $m(BillingModule::MultiProperty),
            $m(BillingModule::CommunityLearning),
            $m(BillingModule::MentoringOs),
            $m(BillingModule::Integrations),
            $m(BillingModule::ReportingIntelligence),
            $m(BillingModule::Accounting),
            $m(BillingModule::Vcal),
            $m(BillingModule::LeadFunnel),
            $m(BillingModule::HrPayroll),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Stripe Checkout return URLs (tenant subdomain)
    |--------------------------------------------------------------------------
    */
    'checkout' => [
        'return_path' => env('BILLING_CHECKOUT_RETURN_PATH', '/settings/subscriptions'),
        'state_query_param' => env('BILLING_CHECKOUT_STATE_QUERY_PARAM', 'billing'),
        'success_billing_state' => env('BILLING_CHECKOUT_SUCCESS_STATE', 'success'),
        'cancel_billing_state' => env('BILLING_CHECKOUT_CANCEL_STATE', 'cancel'),
        'stripe_session_query_param' => 'session_id',
        'stripe_session_placeholder' => '{CHECKOUT_SESSION_ID}',
    ],

    /*
    |--------------------------------------------------------------------------
    | Trial expired page (guest)
    |--------------------------------------------------------------------------
    */
    'trial_expired' => [
        'support_url' => env('BILLING_SUPPORT_URL'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Stripe Checkout Session – compliance (UK / EU SaaS)
    |--------------------------------------------------------------------------
    |
    | Defaults keep behaviour unchanged. Enable after Stripe Dashboard setup:
    | Tax registrations, Automatic Tax, and (for tax_id_collection) business rules.
    |
    | STRIPE_CHECKOUT_BILLING_ADDRESS: empty (omit) | auto | required
    | STRIPE_CHECKOUT_CUSTOMER_UPDATE_ADDRESS: empty (omit) | auto | never
    |
    */
    'checkout_session_options' => [
        'automatic_tax' => filter_var(env('STRIPE_CHECKOUT_AUTOMATIC_TAX', false), FILTER_VALIDATE_BOOLEAN),
        'billing_address_collection' => env('STRIPE_CHECKOUT_BILLING_ADDRESS'),
        'tax_id_collection_enabled' => filter_var(env('STRIPE_CHECKOUT_TAX_ID_COLLECTION', false), FILTER_VALIDATE_BOOLEAN),
        'customer_update_address' => env('STRIPE_CHECKOUT_CUSTOMER_UPDATE_ADDRESS'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Subscription plan catalogue (source of truth for SubscriptionPlanSeeder)
    |--------------------------------------------------------------------------
    |
    | stripe_price_key: key under this config file (e.g. price_investor).
    | module_set: key under module_sets.
    | limits: null means unlimited for that meter.
    |
    */
    'plans' => [
        [
            'slug' => 'investor',
            'name' => 'Investor',
            'display_name' => 'Investor',
            'price' => '49.00',
            'currency' => 'GBP',
            'interval' => 'month',
            'sort_order' => 5,
            'stripe_price_key' => 'price_investor',
            'module_set' => 'investor',
            'limits' => [
                'properties' => 25,
                'team_seats' => 3,
            ],
        ],
        [
            'slug' => 'operator',
            'name' => 'Operator',
            'display_name' => 'Operator',
            'price' => '99.00',
            'currency' => 'GBP',
            'interval' => 'month',
            'sort_order' => 10,
            'stripe_price_key' => 'price_operator',
            'module_set' => 'operator',
            'limits' => [
                'properties' => 150,
                'team_seats' => 10,
            ],
        ],
        [
            'slug' => 'academy',
            'name' => 'Academy',
            'display_name' => 'Academy',
            'price' => '199.00',
            'currency' => 'GBP',
            'interval' => 'month',
            'sort_order' => 20,
            'stripe_price_key' => 'price_academy',
            'module_set' => 'mentor',
            'limits' => [
                'properties' => null,
                'team_seats' => null,
            ],
        ],
    ],
];
