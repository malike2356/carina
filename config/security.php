<?php

declare(strict_types=1);

return [
    // Dedicated inbox for security anomaly emails (super admins still get in-app notifications).
    'alert_email' => env('SECURITY_ALERT_EMAIL'),

    'anomaly_detection' => [
        'enabled' => env('ANOMALY_DETECTION_ENABLED', true),
        'brute_force_threshold' => (int) env('ANOMALY_BRUTE_FORCE_THRESHOLD', 5),
        'credential_stuffing_threshold' => (int) env('ANOMALY_CREDENTIAL_STUFFING_THRESHOLD', 20),
        'data_export_threshold' => (int) env('ANOMALY_DATA_EXPORT_THRESHOLD', 500),
        'carina_calls_threshold' => (int) env('ANOMALY_CARINA_CALLS_THRESHOLD', 50),
        'mass_delete_threshold' => (int) env('ANOMALY_MASS_DELETE_THRESHOLD', 10),
    ],
];
