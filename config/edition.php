<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Deployment edition
    |--------------------------------------------------------------------------
    |
    | propreneur-v2 is the Business Edition product. Community Edition runs on
    | propreneur-v1. Feature ownership for paid-only modules is documented here
    | for billing, navigation, and upgrade copy.
    |
    */
    'deployment' => env('PROPRENEUR_EDITION', 'business'),

    'labels' => [
        'community' => 'Propreneur Community Edition',
        'business' => 'Propreneur Business Edition',
    ],

    'abbreviations' => [
        'community' => 'Propreneur CE',
        'business' => 'Propreneur BE',
    ],

    /*
    |--------------------------------------------------------------------------
    | Modules owned by Business Edition
    |--------------------------------------------------------------------------
    */
    'business_edition_modules' => [
        'hr_payroll',
        'carina_ai',
        'business_page_cms',
        'booking_calendar',
        'mentoring_os',
    ],

    'upgrade' => [
        'community_product_name' => 'Propreneur Community Edition',
        'message' => 'Try Propreneur Community Edition free, or subscribe to Business Edition for platform-managed Carina, HR and payroll, calendar, mentorship, and frontpage CMS.',
    ],
];
