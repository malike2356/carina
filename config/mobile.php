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

    /*
    |--------------------------------------------------------------------------
    | Android app (sideload APK)
    |--------------------------------------------------------------------------
    |
    | Set MOBILE_ANDROID_APK_PATH on the server (recommended) or MOBILE_ANDROID_APK_URL
    | to an HTTPS URL. Tenant links use route tenant.mobile.android which serves or redirects.
    |
    */
    'android_version' => env('MOBILE_ANDROID_VERSION', '1.0.0'),
    'android_apk_path' => env('MOBILE_ANDROID_APK_PATH'),
    'android_apk_url' => env('MOBILE_ANDROID_APK_URL'),
    'ios_app_url' => env('MOBILE_IOS_APP_URL'),

];
