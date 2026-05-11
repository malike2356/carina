<?php

declare(strict_types=1);

return [

    'nav' => [
        'plans_and_billing' => 'Plans and billing',
        'subscriptions' => 'Subscriptions',
    ],

    'subscriptions' => [
        'page_title' => 'Subscriptions',
        'intro' => 'Manage your workspace plan, payment method, and invoices. Checkout returns here after you pay.',
        'section_subscription' => 'Subscription',
        'section_invoices' => 'Invoices',
        'current_period_ends' => 'Current period ends :date.',
        'cancel_at_period_end_hint' => 'Your subscription is set to cancel at the end of this period.',
        'cancel_cta' => 'Cancel at end of period',
        'resume_cta' => 'Resume subscription',
        'invoices_empty' => 'No invoices yet.',
        'invoice_download' => 'Download',
        'invoice_status' => 'Status',
        'invoice_amount' => 'Amount',
        'invoice_date' => 'Date',
        'confirm_cancel' => 'Cancel subscription at the end of the current billing period?',
        'confirm_change_plan' => 'Change plan? Your payment method may be charged a prorated amount.',
        'errors' => [
            'cancel_failed' => 'Could not cancel subscription.',
            'resume_failed' => 'Could not resume subscription.',
            'change_plan_failed' => 'Could not change plan.',
            'invoices_failed' => 'Could not load invoices.',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | After Stripe Checkout returns to the tenant dashboard
    |--------------------------------------------------------------------------
    */
    'checkout' => [
        'success' => 'Payment completed. Your subscription will reflect here shortly after Stripe confirms.',
        'cancelled' => 'Checkout was cancelled. You can choose a plan whenever you are ready.',
    ],

    /*
    |--------------------------------------------------------------------------
    | Trial expired (guest)
    |--------------------------------------------------------------------------
    */
    'trial_expired' => [
        'page_title' => 'Trial ended',
        'heading' => 'Your trial has ended',
        'body' => 'This workspace is on hold until billing is active. Contact support if you need help, or sign in below.',
        'support_cta' => 'Contact support',
        'back_to_sign_in' => 'Back to sign in',
    ],

    /*
    |--------------------------------------------------------------------------
    | Full-width attention banner (subscription needs payment)
    |--------------------------------------------------------------------------
    */
    'attention_banner' => [
        'title' => 'Your plan needs attention',
        'body_admin' => 'Billing status: :status. Update your payment method or settle the invoice so your workspace stays uninterrupted.',
        'body_member' => 'Billing status: :status. Ask a workspace administrator to update payment details.',
        'cta' => 'Open plans and billing',
    ],

    /*
    |--------------------------------------------------------------------------
    | Dashboard billing card (tenant admin)
    |--------------------------------------------------------------------------
    */
    'dashboard' => [
        'card_title' => 'Plans and billing',
        'intro' => 'Choose a plan below, or open Payment and invoices to update your card, download invoices, or change your subscription in Stripe.',
        'intro_plans_unconfigured' => 'Plans are listed, but checkout will open here once each plan has a Stripe price configured. If you already subscribe, use Payment and invoices.',
        'intro_empty_catalog' => 'No plans are published for this workspace yet. If you already have billing with Propreneur, use Payment and invoices.',
        'status_active' => 'Current plan',
        'status_line' => 'Billing status',
        'no_subscription' => 'No active subscription yet. Choose a plan when you are ready.',
        'trial_until' => 'Trial access until :date.',
        'manage_payment' => 'Payment and invoices',
        'price_suffix' => [
            'month' => '/month',
            'year' => '/year',
            'week' => '/week',
            'day' => '/day',
        ],
        'loading' => 'Connecting to billing…',
        'errors' => [
            'checkout_failed' => 'Checkout could not start. Try again or contact support.',
            'checkout_no_url' => 'Billing did not return a checkout link. Try again shortly.',
            'portal_failed' => 'Billing portal could not open. Try again or contact support.',
            'portal_no_url' => 'Billing portal is not available yet.',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Stripe subscription statuses (customer-facing)
    |--------------------------------------------------------------------------
    |
    | Keys match Stripe API status strings. Add or override per locale.
    |
    */
    'subscription_status' => [
        'active' => 'Active',
        'trialing' => 'Trial',
        'past_due' => 'Payment overdue',
        'unpaid' => 'Payment outstanding',
        'incomplete' => 'Checkout not finished',
        'incomplete_expired' => 'Checkout expired',
        'canceled' => 'Canceled',
        'paused' => 'Paused',
    ],

];
