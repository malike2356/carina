<?php

declare(strict_types=1);

return [
    /*
    | Vision provider slug: openai, anthropic, google (OpenAI-compatible vision).
    | Falls back through cert_scan.provider_priority when the chosen provider has no API key.
    */
    'provider' => env('CERT_SCAN_PROVIDER', 'openai'),

    'provider_priority' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CERT_SCAN_PROVIDER_PRIORITY', 'openai,anthropic,google'))
    ))),

    'vision_model' => [
        'openai' => env('CERT_SCAN_OPENAI_MODEL', 'gpt-4o-mini'),
        'anthropic' => env('CERT_SCAN_ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
        'google' => env('CERT_SCAN_GOOGLE_MODEL', 'gemini-2.0-flash'),
    ],

    'max_scans_per_hour' => (int) env('CERT_SCAN_MAX_PER_HOUR', 10),

    'store_images' => (bool) env('STORE_CERT_SCANS', false),

    'max_upload_kb' => (int) env('CERT_SCAN_MAX_UPLOAD_KB', 10240),

    'allowed_mimes' => ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],

    'certificate_types' => [
        'gas_safety' => 'Gas Safety (CP12)',
        'eicr' => 'EICR',
        'epc' => 'EPC',
        'pat_testing' => 'PAT test',
        'legionella' => 'Legionella assessment',
        'fire_risk_assessment' => 'Fire Risk Assessment',
        'hmo_license' => 'HMO licence',
    ],
];
