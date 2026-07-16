<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Legacy v1.0 MySQL connection name
    |--------------------------------------------------------------------------
    |
    | Must match a key in config/database.php (default: v1_legacy).
    |
    */
    'connection' => env('V1_MIGRATION_DB_CONNECTION', 'v1_legacy'),

    /*
    |--------------------------------------------------------------------------
    | Optional slug -> v1 tenant_id map (when not stored on central Tenant data)
    |--------------------------------------------------------------------------
    |
    | @var array<string, int>
    |
    */
    'tenant_slug_to_v1_id' => collect(json_decode((string) env('V1_MIGRATION_TENANT_MAP_JSON', '{}'), true) ?: [])
        ->mapWithKeys(fn ($v, $k) => [(string) $k => (int) $v])
        ->all(),

    /*
    |--------------------------------------------------------------------------
    | Table names on v1.0 (MySQL)
    |--------------------------------------------------------------------------
    */
    'tables' => [
        'properties' => env('V1_TABLE_PROPERTIES', 'properties'),
        'deals' => env('V1_TABLE_DEALS', 'deals'),
        'contacts' => env('V1_TABLE_CONTACTS', 'contacts'),
        'users' => env('V1_TABLE_USERS', 'users'),
        'documents' => env('V1_TABLE_DEAL_DOCUMENTS', 'deal_documents'),
        'tenancies' => env('V1_TABLE_TENANCIES', 'property_tenancies'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Chunk size for streaming exports
    |--------------------------------------------------------------------------
    */
    'chunk_size' => max(50, min(2000, (int) env('V1_MIGRATION_CHUNK', 500))),

    /*
    |--------------------------------------------------------------------------
    | Cache TTL seconds for status / schema payloads
    |--------------------------------------------------------------------------
    */
    'cache_ttl' => max(60, (int) env('V1_MIGRATION_CACHE_TTL', 600)),

    /*
    |--------------------------------------------------------------------------
    | Redis cache tag prefix (tag invalidation when store supports tags)
    |--------------------------------------------------------------------------
    */
    'cache_tag' => 'v1-migration',
];
