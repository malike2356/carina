<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Locales shipped and selectable in the workspace UI
    |--------------------------------------------------------------------------
    */

    'available_locales' => [
        'en' => ['label' => 'English', 'native' => 'English'],
        'fr' => ['label' => 'French', 'native' => 'Français'],
        'es' => ['label' => 'Spanish', 'native' => 'Español'],
        'de' => ['label' => 'German', 'native' => 'Deutsch'],
        'ar' => ['label' => 'Arabic', 'native' => 'العربية'],
        'he' => ['label' => 'Hebrew', 'native' => 'עברית'],
    ],

    /*
    |--------------------------------------------------------------------------
    | RTL locales (html dir, layout hints)
    |--------------------------------------------------------------------------
    */

    'rtl_locales' => ['ar', 'he', 'fa', 'ur'],

    /*
    |--------------------------------------------------------------------------
    | Fallback chain per primary locale (used before app.fallback_locale)
    |--------------------------------------------------------------------------
    |
    | @var array<string, list<string>>
    */

    'fallback_chains' => [
        'fr' => ['en'],
        'es' => ['en'],
        'de' => ['en'],
        'ar' => ['en'],
        'he' => ['en'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Tenant filesystem path for workspace-only overrides (optional)
    |--------------------------------------------------------------------------
    */

    'custom_lang_path' => 'lang/custom',

    /*
    |--------------------------------------------------------------------------
    | Cache TTL for merged DB + file translations (seconds)
    |--------------------------------------------------------------------------
    */

    'translation_cache_ttl' => 600,

    /*
    |--------------------------------------------------------------------------
    | Cache key prefix (tenant-scoped at runtime)
    |--------------------------------------------------------------------------
    */

    'cache_prefix' => 'localization',

];
