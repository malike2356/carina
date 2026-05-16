<?php

declare(strict_types=1);

return [
    'rate_limits' => [
        'tenant_hourly' => (int) env('CARINA_RATE_TENANT_HOURLY', 500),
        'tenant_daily' => (int) env('CARINA_RATE_TENANT_DAILY', 5000),
        'user_hourly' => (int) env('CARINA_RATE_USER_HOURLY', 100),
        'user_daily' => (int) env('CARINA_RATE_USER_DAILY', 1000),
    ],

    'redis_ttl_seconds' => [
        'hourly' => 3600,
        'daily' => 86400,
    ],

    'rag' => [
        'chunk_size' => (int) env('CARINA_RAG_CHUNK_SIZE', 1000),
        'chunk_overlap' => (int) env('CARINA_RAG_CHUNK_OVERLAP', 200),
        'max_documents_per_tenant' => (int) env('CARINA_RAG_MAX_DOCUMENTS', 200),
        /** Minimum hybrid relevance score (0-1) before a chunk is ranked; 0 keeps all scored chunks. */
        'min_hybrid_score' => (float) env('CARINA_RAG_MIN_HYBRID_SCORE', 0),
        /** Expected embedding vector size (OpenAI text-embedding-3-small = 1536). */
        'embedding_dimensions' => (int) env('CARINA_EMBEDDING_DIMENSIONS', 1536),
    ],

    'conversation_retention_days' => (int) env('CARINA_CONVERSATION_RETENTION_DAYS', 90),

    /**
     * Root directory for operator-curated Carina masterbrain markdown (default: config paths.brain.masterbrain).
     * Override in tests with a temp directory; leave empty for default. BRAIN_MASTERBRAIN_PATH sets the same default root for all code paths; CARINA_MASTERBRAIN_PATH wins in CarinaKnowledgeTrainingService when set.
     */
    'masterbrain_path' => env('CARINA_MASTERBRAIN_PATH'),

    /**
     * Platform Carina knowledge training (admin UI): security, OCR, ZIP, audit, RAG template tenant.
     */
    'training' => [
        'mime_strict' => filter_var(env('CARINA_TRAINING_MIME_STRICT', true), FILTER_VALIDATE_BOOL),
        /** Absolute path to clamscan binary; when empty, AV scan is skipped. */
        'clamscan_binary' => env('CARINA_TRAINING_CLAMSCAN_BINARY'),
        'pdf_fallback_enabled' => filter_var(env('CARINA_TRAINING_PDF_FALLBACK', true), FILTER_VALIDATE_BOOL),
        'ocr_enabled' => filter_var(env('CARINA_TRAINING_OCR', true), FILTER_VALIDATE_BOOL),
        'pdftotext_binary' => env('CARINA_TRAINING_PDFTOTEXT_BINARY'),
        'pdftoppm_binary' => env('CARINA_TRAINING_PDFTOPPM_BINARY'),
        'tesseract_binary' => env('CARINA_TRAINING_TESSERACT_BINARY'),
        /** Central tenant UUID recommended for internal RAG smoke tests (shown first in UI when set). */
        'template_tenant_id' => env('CARINA_TRAINING_TEMPLATE_TENANT_ID'),
        /** Max extracted bytes from a single ZIP before refusing (defence in depth). */
        'zip_max_uncompressed_bytes' => (int) env('CARINA_TRAINING_ZIP_MAX_UNCOMPRESSED', 25_000_000),
        /** Max number of documents pulled from one ZIP. */
        'zip_max_entries' => (int) env('CARINA_TRAINING_ZIP_MAX_ENTRIES', 40),
    ],
];
