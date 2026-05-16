<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Mobile REST API (tenant workspace)
    |--------------------------------------------------------------------------
    */

    'allow_self_registration' => (bool) env('MOBILE_ALLOW_SELF_REGISTRATION', false),

    'access_token_expires_minutes' => (int) env('MOBILE_ACCESS_TOKEN_EXPIRES_MINUTES', 60 * 24 * 7),

    'refresh_token_expires_days' => (int) env('MOBILE_REFRESH_TOKEN_EXPIRES_DAYS', 60),

    'device_throttle_per_minute' => (int) env('MOBILE_DEVICE_THROTTLE_PER_MINUTE', 240),

    'push' => [
        'fcm_server_key' => env('FCM_SERVER_KEY'),
        'expo_access_token' => env('EXPO_ACCESS_TOKEN'),
    ],

];
